import { useCallback, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { userFacingError } from '@/lib/userFacingError';
import { getEntitlementSnapshot, type EntitlementSnapshot } from '@/lib/entitlements';
import { PageHeader } from './AppShell';
import {
  cancelAllVowNotifications,
  clearCloudPushRegistration,
  isRemotePushConfigured,
  requestNotificationPermission,
  getNotificationPermission,
  getNotificationPreferences,
  setupCloudPushNotifications,
  setNotificationPreferences,
} from '@/lib/notifications';

export function ProfilePage({ onLegal }: { onLegal?: () => void }) {
  const { session, displayName, updateDisplayName } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [name, setName] = useState(displayName);
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => getNotificationPreferences().enabled);
  const [entitlement, setEntitlement] = useState<EntitlementSnapshot | null>(null);
  const [notificationError, setNotificationError] = useState('');
  const [updatingNotifications, setUpdatingNotifications] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [signOutError, setSignOutError] = useState('');

  useEffect(() => { setName(displayName); }, [displayName]);

  const refreshNotificationState = useCallback(async () => {
    const preferences = getNotificationPreferences();
    if (!Capacitor.isNativePlatform()) {
      setNotificationsEnabled(preferences.enabled);
      return;
    }
    try {
      const permission = await getNotificationPermission();
      // The operating system is authoritative: if permission has been revoked
      // in Android settings, the in-app switch must not remain visually on.
      setNotificationsEnabled(preferences.enabled && permission === 'granted');
    } catch (error) {
      console.warn('[VOW] Could not refresh notification permission state:', error);
      setNotificationsEnabled(preferences.enabled);
    }
  }, []);

  useEffect(() => {
    void refreshNotificationState();
    const onFocus = () => { void refreshNotificationState(); };
    window.addEventListener('focus', onFocus);
    const resumeListener = CapacitorApp.addListener('resume', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      resumeListener.then((handle) => handle.remove());
    };
  }, [refreshNotificationState]);

  useEffect(() => {
    let active = true;
    void getEntitlementSnapshot().then((snapshot) => {
      if (active) setEntitlement(snapshot);
    });
    const handleEntitlementChange = (event: Event) => {
      setEntitlement((event as CustomEvent<EntitlementSnapshot | null>).detail ?? null);
    };
    window.addEventListener('vow:entitlement-changed', handleEntitlementChange);
    return () => {
      active = false;
      window.removeEventListener('vow:entitlement-changed', handleEntitlementChange);
    };
  }, []);

  async function handleSaveName() {
    const nextName = name.trim();
    if (!nextName || !session || nextName.length > 80) return;
    setSavingName(true);
    setNameMessage('');
    try {
      const { error } = await updateDisplayName(nextName);
      if (error) throw error;
      setNameMessage('Name saved.');
      setEditingName(false);
    } catch (error) {
      console.error('[VOW] Display name could not be saved:', error);
      setNameMessage(userFacingError(error, 'Could not save your name. Please try again.'));
    } finally {
      setSavingName(false);
    }
  }

  async function handleEnableNotifications() {
    setUpdatingNotifications(true);
    setNotificationError('');
    try {
      const permission = await requestNotificationPermission();
      if (permission !== 'granted') {
        setNotificationError(permission === 'unsupported'
          ? 'Session reminders are not available on this device.'
          : 'Allow notifications in your device settings to receive session reminders.');
        return;
      }
      // Do not send users into Android's separate Alarms & reminders
      // settings page just to enable ordinary session notifications.
      const preferences = await setNotificationPreferences({ enabled: true });
      setNotificationsEnabled(preferences.enabled && permission === 'granted');
      await refreshNotificationState();
      if (Capacitor.getPlatform() === 'android' && isRemotePushConfigured()) {
        try {
          await setupCloudPushNotifications();
        } catch (error) {
          console.error('[VOW] Remote push registration failed; local reminders remain enabled:', error);
        }
      }
    } catch (error) {
      console.error('[VOW] Enabling session reminders failed:', error);
      void refreshNotificationState();
      setNotificationError(getNotificationPreferences().enabled
        ? 'Notifications are enabled, but reminders could not be fully synced. Try again in a moment.'
        : 'Could not enable session reminders. Please try again.');
    } finally {
      setUpdatingNotifications(false);
    }
  }

  async function handleDisableNotifications() {
    setUpdatingNotifications(true);
    setNotificationError('');
    try {
      const preferences = await setNotificationPreferences({ enabled: false });
      setNotificationsEnabled(preferences.enabled);
      await refreshNotificationState();
    } catch (error) {
      console.error('[VOW] Disabling session reminders failed:', error);
      setNotificationError('Could not update reminder settings. Please try again.');
    } finally {
      setUpdatingNotifications(false);
    }
  }

  async function handleSignOut() {
    setSignOutError('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      void Promise.all([cancelAllVowNotifications(), clearCloudPushRegistration()])
        .catch((error) => console.warn('[VOW] Post-sign-out reminder cleanup failed:', error));
    } catch (error) {
      console.error('[VOW] Sign out failed:', error);
      setSignOutError('Could not sign out. Please try again.');
    }
  }

  async function handleDeleteAccount() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const { data, error } = await supabase.functions.invoke('vow-account-delete', { body: { confirm: true } });
      if (error) throw error;
      if (!data?.deleted) throw new Error(data?.error || 'Account deletion was not completed.');
      await supabase.auth.signOut({ scope: 'local' });
      void Promise.all([cancelAllVowNotifications(), clearCloudPushRegistration()])
        .catch((cleanupError) => console.warn('[VOW] Post-deletion reminder cleanup failed:', cleanupError));
    } catch (error) {
      console.error('[VOW] Account deletion failed:', error);
      setDeleteError(userFacingError(error, 'Could not complete account deletion. Please try again.'));
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Profile" />
      <section className="divide-y divide-vow-border">
        <div className="py-6">
          <h2 className="vow-label mb-2">Personalization</h2>
          <div className="divide-y divide-vow-border">
            <div className="py-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-vow-ink">My Name</p>
                  {!editingName && <p className="text-xs text-vow-muted mt-1 truncate">{displayName || 'Add your name'}</p>}
                </div>
                {!editingName && <button type="button" onClick={() => { setEditingName(true); setNameMessage(''); }} className="text-xs text-vow-muted underline underline-offset-4 hover:text-vow-ink">Edit</button>}
              </div>
              {editingName && <div className="mt-3">
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoFocus className="vow-input" placeholder="Your name" aria-label="Your name" />
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => void handleSaveName()} disabled={savingName || !name.trim()} className="vow-btn-primary disabled:opacity-50">{savingName ? 'Saving…' : 'Save'}</button>
                  <button type="button" onClick={() => { setEditingName(false); setName(displayName); }} className="vow-btn-ghost">Cancel</button>
                </div>
              </div>}
              {nameMessage && <p className="text-xs text-vow-muted mt-2" role="status">{nameMessage}</p>}
            </div>

            <div className="py-5 flex items-center justify-between gap-4">
              <div><p className="text-sm text-vow-ink">Appearance</p><p className="text-xs text-vow-muted mt-1">Choose light or dark mode.</p></div>
              <button type="button" onClick={toggleTheme} className="vow-btn-soft shrink-0" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? 'Dark mode' : 'Light mode'}</button>
            </div>

            <div className="py-5">
              <div className="flex items-center justify-between gap-4">
                <div><p className="text-sm text-vow-ink">Notifications</p><p className="text-xs text-vow-muted mt-1">Session reminders</p></div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationsEnabled}
                  aria-label="Session reminders"
                  disabled={updatingNotifications}
                  onClick={() => void (notificationsEnabled ? handleDisableNotifications() : handleEnableNotifications())}
                  className={`relative h-7 w-12 shrink-0 rounded-full border border-vow-border p-1 transition-colors disabled:opacity-50 ${notificationsEnabled ? 'bg-vow-ink' : 'bg-vow-surface'}`}
                >
                  <span className={`absolute left-1 top-1 h-5 w-5 rounded-full shadow-sm transition-transform ${notificationsEnabled ? 'translate-x-5 bg-vow-bg' : 'translate-x-0 bg-vow-muted'}`} />
                </button>
              </div>
              {updatingNotifications && <p className="text-xs text-vow-muted mt-2" role="status">Updating session reminders…</p>}
              {notificationError && <p className="text-xs text-vow-muted mt-2" role="alert">{notificationError}</p>}
            </div>
          </div>
        </div>

        <div className="py-6">
          <h2 className="vow-label mb-2">Legal &amp; Support</h2>
          <div className="divide-y divide-vow-border">
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('vow:navigate', { detail: 'support' }))} className="w-full py-5 text-left">
              <p className="text-sm text-vow-ink">Support</p>
            </button>

            {onLegal && <button type="button" onClick={onLegal} className="w-full py-5 text-left">
              <p className="text-sm text-vow-ink">Terms and Policies</p>
            </button>}
          </div>
        </div>

        <div className="py-6">
          <h2 className="vow-label mb-2">My Account</h2>
          {entitlement?.plan === 'premium' && <div className="border border-vow-border rounded-xl p-4 mb-4 flex items-center justify-between gap-3"><div><p className="text-sm text-vow-ink">✦ Premium · Active</p><p className="text-xs text-vow-muted mt-1">Your Premium benefits are active.</p></div><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('vow:navigate', { detail: 'upgrade' }))} className="text-xs text-vow-ink underline underline-offset-4 shrink-0">Manage</button></div>}
          <div className="border border-vow-border rounded-xl p-4 mb-4">
            <p className="text-xs text-vow-muted">Signed in as</p>
            <p className="text-sm text-vow-ink mt-1 break-all">{session?.user?.email || 'Account email unavailable'}</p>
            <div className="flex items-center justify-between gap-3 mt-4">
              <p className="text-xs text-vow-muted">Current plan</p>
              {entitlement ? <span className="border border-vow-border rounded-full px-3 py-1 text-xs text-vow-ink">{entitlement.plan === 'premium' ? '✦ Premium · Active' : 'Free'}</span> : <span className="text-xs text-vow-muted">Checking…</span>}
            </div>
          </div>
          <h2 className="vow-label mb-2">Account settings</h2>
          <div className="divide-y divide-vow-border">
            <div className="py-5">
              {!confirmDelete
                ? <button type="button" onClick={() => { setDeleteError(''); setConfirmDelete(true); }} className="text-sm text-vow-muted hover:text-vow-ink">Delete Account</button>
                : <div>
                  <p className="text-sm text-vow-ink mb-1">Delete your account?</p>
                  <p className="text-xs text-vow-muted mb-3">This permanently deletes your account and associated data. This action cannot be undone.</p>
                  {deleteError && <p className="text-xs text-vow-muted mb-3" role="alert">{deleteError}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting} className="vow-btn-ghost">Keep account</button>
                    <button type="button" onClick={() => void handleDeleteAccount()} disabled={deleting} className="text-sm text-vow-ink underline underline-offset-4 disabled:opacity-50">{deleting ? 'Deleting…' : 'Confirm deletion'}</button>
                  </div>
                </div>}
            </div>

            <div className="py-5">
              <button type="button" onClick={() => void handleSignOut()} className="text-sm text-vow-muted underline underline-offset-4 hover:text-vow-ink">Sign Out</button>
              {signOutError && <p role="alert" className="text-xs text-vow-muted mt-2">{signOutError}</p>}
            </div>
          </div>
        </div>

      </section>
    </div>
  );
}
