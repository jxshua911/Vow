import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { NATIVE_OAUTH_REDIRECT } from '@/lib/nativeAuth';
import { userFacingError } from '@/lib/userFacingError';
import { PageHeader } from './AppShell';
import { cancelAllVowNotifications, clearCloudPushRegistration, getNotificationPermission, isRemotePushConfigured, requestNotificationPermission, setupCloudPushNotifications, getNotificationPreferences, setNotificationPreferences } from '@/lib/notifications';

type ProfileSubpage = 'main' | 'quality';

export function ProfilePage({ onLegal }: { onLegal?: () => void }) {
  const { session, displayName, updateDisplayName } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [subpage, setSubpage] = useState<ProfileSubpage>('main');
  const [notificationStatus, setNotificationStatus] = useState<string>('checking');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => getNotificationPreferences().enabled);
  const [notificationError, setNotificationError] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [name, setName] = useState(displayName);
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [signOutError, setSignOutError] = useState('');
  const [qualityAlerts, setQualityAlerts] = useState<Array<{ id: string; alert_type: string; validation_code: string | null; goal_title: string | null; created_at: string; resolved_at: string | null }>>([]);
  const [identities, setIdentities] = useState<Array<{ id: string; provider: string; email?: string }>>([]);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [identityLinking, setIdentityLinking] = useState(false);
  const [identityMessage, setIdentityMessage] = useState('');

  useEffect(() => {
    void getNotificationPermission()
      .then(setNotificationStatus)
      .catch((error) => {
        console.error('[VOW] Notification permission could not be checked:', error);
        setNotificationStatus('denied');
      });
  }, []);

  useEffect(() => {
    let active = true;
    const loadIdentities = async () => {
      if (!session) {
        setIdentities([]);
        setIdentityLoading(false);
        return;
      }
      setIdentityLoading(true);
      const { data, error } = await supabase.auth.getUserIdentities();
      if (!active) return;
      if (error) {
        console.warn('[VOW] Failed to load connected sign-in methods:', error.message);
        setIdentityMessage('Could not load connected sign-in methods.');
        setIdentities([]);
      } else {
        setIdentities((data?.identities || []).map((identity) => ({
          id: identity.id,
          provider: identity.provider,
          email: identity.identity_data?.email,
        })));
      }
      setIdentityLoading(false);
    };
    void loadIdentities();
    const onOAuthSuccess = () => { void loadIdentities(); };
    window.addEventListener('vow:oauth-success', onOAuthSuccess);
    return () => {
      active = false;
      window.removeEventListener('vow:oauth-success', onOAuthSuccess);
    };
  }, [session]);

  async function handleLinkGoogle() {
    if (!session || identityLinking) return;
    setIdentityLinking(true);
    setIdentityMessage('');
    try {
      const options = Capacitor.isNativePlatform()
        ? { redirectTo: NATIVE_OAUTH_REDIRECT, skipBrowserRedirect: true }
        : { redirectTo: window.location.origin };
      const { data, error } = await supabase.auth.linkIdentity({ provider: 'google', options });
      if (error) throw error;
      if (Capacitor.isNativePlatform() && data?.url) {
        const finishedListener = await Browser.addListener('browserFinished', () => {
          setIdentityLinking(false);
          void finishedListener.remove();
        });
        await Browser.open({ url: data.url });
      } else {
        setIdentityMessage('Finish Google sign-in to connect it to this VOW account.');
        setIdentityLinking(false);
      }
    } catch (error) {
      setIdentityMessage(userFacingError(error, 'Could not connect Google. Please try again.'));
      setIdentityLinking(false);
    }
  }
  useEffect(() => { setName(displayName); }, [displayName]);
  useEffect(() => {
    if (!session) return;
    void supabase.from('vow_ai_quality_alerts').select('id,alert_type,validation_code,goal_title,created_at,resolved_at').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(20).then(({ data, error }) => {
      if (error) console.warn('[VOW] AI quality alerts could not be loaded:', error.message);
      setQualityAlerts((data || []) as typeof qualityAlerts);
    });
  }, [session]);

  async function handleEnableNotifications() {
    setRequesting(true);
    setNotificationError('');
    try {
      const status = await requestNotificationPermission();
      setNotificationStatus(status);
      if (status === 'granted') {
        const next = await setNotificationPreferences({ enabled: true });
        setNotificationsEnabled(next.enabled);
        if (Capacitor.getPlatform() === 'android' && isRemotePushConfigured()) {
          try {
            await setupCloudPushNotifications();
          } catch (error) {
            console.error('[VOW] Cloud push could not be enabled:', error);
            setNotificationError('On-device session reminders are enabled, but remote push could not be registered on this device.');
          }
        }
      } else if (status === 'unsupported') {
        setNotificationError('Notifications are not supported on this device.');
      } else {
        setNotificationError('Allow notifications in your device settings to receive VOW session reminders.');
      }
    } catch (error) {
      console.error('[VOW] Enabling notifications failed:', error);
      setNotificationError(userFacingError(error, 'Could not enable notifications. Please try again.'));
    } finally {
      setRequesting(false);
    }
  }

  async function handleDisableNotifications() {
    setNotificationError('');
    try {
      const next = await setNotificationPreferences({ enabled: false });
      setNotificationsEnabled(next.enabled);
    } catch (error) {
      console.error('[VOW] Disabling notifications failed:', error);
      setNotificationError('VOW could not update reminder settings. Please try again.');
    }
  }

  async function handleSaveName() {
    const nextName = name.trim();
    if (!nextName || !session || nextName.length > 80) return;
    setSavingName(true); setNameMessage('');
    const { error } = await updateDisplayName(nextName);
    setNameMessage(error ? error.message : 'Name saved.');
    setSavingName(false);
    if (!error) setEditingName(false);
  }

  async function handleSignOut() {
    setSignOutError('');
    try {
      await cancelAllVowNotifications().catch((error) => {
        console.warn('[VOW] Reminder cleanup before sign out failed:', error);
      });
      await clearCloudPushRegistration();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('[VOW] Sign out failed:', error);
      setSignOutError('VOW could not sign you out. Please try again.');
    }
  }

  async function handleDeleteAccount() {
    if (deleting) return;
    setDeleting(true); setDeleteError('');
    const { data, error } = await supabase.functions.invoke('vow-account-delete', { body: { confirm: true } });
    if (error || !data?.deleted) {
      setDeleteError(data?.error || error?.message || 'VOW could not complete account deletion.');
      setDeleting(false);
      return;
    }
    await cancelAllVowNotifications();
    await clearCloudPushRegistration();
    await supabase.auth.signOut();
    setDeleting(false);
  }
  const notificationsGranted = notificationStatus === 'granted';

  if (subpage === 'quality') return <QualityAlertsPage alerts={qualityAlerts} onBack={() => setSubpage('main')} onResolve={async (id) => {
    const { error } = await supabase.from('vow_ai_quality_alerts').update({ resolved_at: new Date().toISOString() }).eq('id', id).eq('user_id', session?.user?.id || '');
    if (!error) setQualityAlerts((current) => current.map((alert) => alert.id === id ? { ...alert, resolved_at: new Date().toISOString() } : alert));
  }} />;
  return (
    <div className="profile-container">
      <PageHeader title={`Welcome back, ${displayName || 'there'}`} subtitle="Your account and preferences." />
      <div className="profile-section">
        <button onClick={() => window.dispatchEvent(new CustomEvent('vow:navigate', { detail: 'support' }))} className="profile-menu-item w-full text-left"><p className="text-sm text-vow-ink">Support</p><p className="text-xs text-vow-muted mt-1">Report an issue, ask a question, or send feedback.</p></button>
        <button onClick={onLegal} className="profile-menu-item w-full text-left"><p className="text-sm text-vow-ink">Terms & Policies</p><p className="text-xs text-vow-muted mt-1">EULA, copyright and service policies.</p></button>
        <div className="profile-menu-item"><div className="flex items-center justify-between gap-4"><div><p className="text-sm text-vow-ink">Appearance</p><p className="text-xs text-vow-muted mt-1">Switch VOW between light and dark mode.</p></div><button type="button" onClick={toggleTheme} className="vow-btn-soft shrink-0" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? 'Dark mode' : 'Light mode'}</button></div><p className="text-[10px] text-vow-muted mt-2 capitalize">Current mode: {theme}</p></div>
        <div className="profile-menu-item"><div className="flex items-center justify-between gap-4"><div><p className="text-sm text-vow-ink">Notifications</p><p className="text-xs text-vow-muted mt-1">On-device reminders for your scheduled sessions.</p></div>{notificationsGranted && notificationsEnabled && <span className="text-xs text-vow-ink">Enabled</span>}</div><p className="text-[10px] text-vow-muted mt-2 capitalize">Status: {notificationStatus} · {notificationsEnabled ? 'reminders on' : 'reminders off'}</p>{Capacitor.getPlatform() === 'android' && !isRemotePushConfigured() && <p className="text-xs text-vow-muted mt-2">Remote push is not configured in this build; on-device reminders remain available.</p>}{notificationError && <p className="text-xs text-vow-ink mt-2" role="alert">{notificationError}</p>}<div className="flex flex-wrap gap-2 mt-4">{(!notificationsGranted || !notificationsEnabled) && notificationStatus !== 'unsupported' && <button onClick={handleEnableNotifications} disabled={requesting} className="vow-btn-soft disabled:opacity-50">{requesting ? 'Requesting…' : 'Enable reminders'}</button>}{notificationsGranted && notificationsEnabled && <button onClick={() => void handleDisableNotifications()} className="vow-btn-soft">Disable reminders</button>}</div></div>
        <div className="profile-menu-item"><div className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="text-sm text-vow-ink">My name</p><p className="text-xs text-vow-muted mt-1 truncate">{name || 'Not provided'}</p></div><button onClick={() => { setEditingName(true); setNameMessage(''); }} className="vow-btn-soft shrink-0">Change Name</button></div>{editingName && <div className="mt-4 border-t border-vow-border pt-4"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus className="vow-input" placeholder="What should VOW call you?" /><div className="flex gap-2 mt-2"><button onClick={handleSaveName} disabled={savingName || !name.trim()} className="vow-btn-primary disabled:opacity-50">{savingName ? 'Saving…' : 'Save name'}</button><button onClick={() => { setEditingName(false); setName(displayName); }} className="vow-btn-ghost">Cancel</button></div>{nameMessage && <p className="text-xs text-vow-muted mt-2">{nameMessage}</p>}</div>}</div>
        <div className="profile-menu-item">
          <p className="text-sm text-vow-ink">Account email</p>
          <p className="text-xs text-vow-muted mt-1 break-words">{session?.user?.email || 'Not provided'}</p>
          <details className="mt-4 border-t border-vow-border pt-4">
            <summary className="cursor-pointer text-xs text-vow-muted hover:text-vow-ink">Manage sign-in methods</summary>
            <p className="text-xs text-vow-muted mt-3">Connect Google to use it alongside your email sign-in.</p>
            {identityLoading ? <p className="text-xs text-vow-muted mt-3">Checking connected methods…</p> : <div className="mt-4 space-y-2">
              {identities.map((identity) => <div key={identity.id} className="flex items-center justify-between gap-3 text-xs border border-vow-border px-3 py-2">
                <span className="text-vow-ink capitalize">{identity.provider === 'email' ? 'Email' : identity.provider}</span>
                <span className="text-vow-muted truncate">{identity.email || session?.user?.email || 'Connected'}</span>
              </div>)}
              {!identities.some((identity) => identity.provider === 'google') && <button type="button" onClick={() => void handleLinkGoogle()} disabled={identityLinking} className="vow-btn-soft mt-2 disabled:opacity-50">{identityLinking ? 'Connecting…' : 'Connect Google'}</button>}
              {identities.some((identity) => identity.provider === 'google') && <p className="text-xs text-vow-ink mt-2">Google is connected to this VOW account.</p>}
              {identityMessage && <p className="text-xs text-vow-muted mt-2" role="status">{identityMessage}</p>}
            </div>}
          </details>
        </div>
        <div className="profile-menu-item"><button type="button" onClick={() => void handleSignOut()} className="text-sm text-vow-muted hover:text-vow-ink">Sign out</button>{signOutError && <p role="alert" className="text-xs text-vow-ink mt-2">{signOutError}</p>}</div>
        <button onClick={() => { setDeleteError(''); setConfirmDelete(true); }} className="profile-menu-item w-full flex items-center justify-between gap-4 text-left"><div><p className="text-sm text-vow-ink">Delete account</p><p className="text-xs text-vow-muted mt-1">Permanently delete your VOW account and associated account data.</p></div><span className="text-lg leading-none text-vow-muted">›</span></button>
      </div>
      {confirmDelete && <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="delete-account-title"><div className="bg-vow-bg border border-vow-border p-6 max-w-sm w-full"><h2 id="delete-account-title" className="vow-heading text-xl text-vow-ink mb-2">Delete your VOW account?</h2><p className="text-sm text-vow-muted leading-relaxed mb-6">Your account will be scheduled for permanent deletion in 14 days. You can sign back in during that period to cancel the deletion. After 14 days, the deletion becomes permanent.</p>{deleteError && <p role="alert" className="text-xs text-vow-ink mb-4 border-l-2 border-vow-ink pl-3">{deleteError}</p>}<div className="flex gap-3"><button onClick={() => setConfirmDelete(false)} disabled={deleting} className="vow-btn-ghost flex-1">Keep account</button><button onClick={() => void handleDeleteAccount()} disabled={deleting} className="vow-btn-primary flex-1">{deleting ? 'Scheduling deletion…' : 'Schedule deletion'}</button></div></div></div>}
    </div>
  );
}

function QualityAlertsPage({ alerts, onBack, onResolve }: {
  alerts: Array<{ id: string; alert_type: string; validation_code: string | null; goal_title: string | null; created_at: string; resolved_at: string | null }>;
  onBack: () => void;
  onResolve: (id: string) => void;
}) {
  const open = alerts.filter(alert => !alert.resolved_at);
  return <div>
    <button onClick={onBack} className="text-sm text-vow-muted hover:text-vow-ink mb-6">← Back to profile</button>
    <PageHeader title="AI quality alerts" subtitle="VOW records plan-quality failures so generic output can be investigated instead of silently accepted." />
    <section className="border border-vow-border divide-y divide-vow-border">
      {!alerts.length && <div className="p-6"><p className="text-sm text-vow-ink">No quality alerts recorded.</p><p className="text-xs text-vow-muted mt-2">When VOW blocks a generic or repetitive plan, it will appear here.</p></div>}
      {alerts.map((alert) => <div key={alert.id} className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-sm font-medium text-vow-ink">{alert.alert_type === 'generic_plan_blocked' ? 'Generic plan blocked' : alert.alert_type === 'repetitive_plan_blocked' ? 'Repetitive plan blocked' : 'Plan quality issue'}</p>
          <p className="text-xs text-vow-muted mt-1">{alert.goal_title || 'Unnamed goal'} · {alert.validation_code || 'quality check'}</p></div>
          {!alert.resolved_at && <button onClick={() => onResolve(alert.id)} className="text-xs text-vow-ink underline underline-offset-4 shrink-0">Mark seen</button>}
        </div>
        <p className="text-[11px] text-vow-muted mt-3">{new Date(alert.created_at).toLocaleString()}</p>
      </div>)}
    </section>
    {open.length > 0 && <p className="text-xs text-vow-muted mt-4">{open.length} unresolved alert{open.length === 1 ? '' : 's'}.</p>}
  </div>;
}
