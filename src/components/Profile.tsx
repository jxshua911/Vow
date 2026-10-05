import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { NATIVE_OAUTH_REDIRECT } from '@/lib/nativeAuth';
import { userFacingError } from '@/lib/userFacingError';
import { PageHeader } from './AppShell';
import { cancelAllVowNotifications, clearCloudPushRegistration, getNotificationPermission, requestNotificationPermission, syncUpcomingSessionNotifications, getNotificationPreferences, setNotificationPreferences } from '@/lib/notifications';

type ProfileSubpage = 'main' | 'shared' | 'quality';

export function ProfilePage({ onLegal, onUpgrade }: { onLegal?: () => void; onUpgrade?: () => void }) {
  const { session, displayName, updateDisplayName } = useAuth();
  void onUpgrade;
  const { theme, toggleTheme } = useTheme();
  const [subpage, setSubpage] = useState<ProfileSubpage>('main');
  const [notificationStatus, setNotificationStatus] = useState<string>('checking');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => getNotificationPreferences().enabled);
  const [requesting, setRequesting] = useState(false);
  const [name, setName] = useState(displayName);
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [qualityAlerts, setQualityAlerts] = useState<Array<{ id: string; alert_type: string; validation_code: string | null; goal_title: string | null; created_at: string; resolved_at: string | null }>>([]);
  const [identities, setIdentities] = useState<Array<{ id: string; provider: string; email?: string }>>([]);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [identityLinking, setIdentityLinking] = useState(false);
  const [identityMessage, setIdentityMessage] = useState('');

  useEffect(() => { getNotificationPermission().then(setNotificationStatus); }, []);

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
    try {
      const status = await requestNotificationPermission();
      setNotificationStatus(status);
      if (status === 'granted') {
        const next = await setNotificationPreferences({ enabled: true });
        setNotificationsEnabled(next.enabled);
        if (session) {
          const { data } = await supabase.from('sessions').select('*').eq('user_id', session.user.id).eq('status', 'scheduled').gte('scheduled_at', new Date().toISOString()).order('scheduled_at', { ascending: true });
          if (data) await syncUpcomingSessionNotifications(data);
        }
      }
    } finally {
      setRequesting(false);
    }
  }

  async function handleDisableNotifications() {
    const next = await setNotificationPreferences({ enabled: false });
    setNotificationsEnabled(next.enabled);
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

  async function handleSignOut() { setConfirmSignOut(false); await cancelAllVowNotifications(); await clearCloudPushRegistration(); await supabase.auth.signOut(); }

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

  if (subpage === 'shared') return <SharedInformationPage session={session} displayName={displayName} onBack={() => setSubpage('main')} />;
  if (subpage === 'quality') return <QualityAlertsPage alerts={qualityAlerts} onBack={() => setSubpage('main')} onResolve={async (id) => {
    const { error } = await supabase.from('vow_ai_quality_alerts').update({ resolved_at: new Date().toISOString() }).eq('id', id).eq('user_id', session?.user?.id || '');
    if (!error) setQualityAlerts((current) => current.map((alert) => alert.id === id ? { ...alert, resolved_at: new Date().toISOString() } : alert));
  }} />;
  return (
    <div className="profile-container">
      <PageHeader title={`Welcome back, ${displayName || 'there'}`} subtitle="Your account and preferences." />
      <div className="profile-section">
        <button onClick={() => setSubpage('shared')} className="profile-menu-item w-full flex items-center justify-between gap-4 text-left"><div><p className="text-sm text-vow-ink">Account information</p><p className="text-xs text-vow-muted mt-1">See the account details and calendar connections currently available to VOW.</p></div><span className="text-lg leading-none text-vow-muted">›</span></button>
        <button onClick={() => window.dispatchEvent(new CustomEvent('vow:navigate', { detail: 'support' }))} className="profile-menu-item w-full text-left"><p className="text-sm text-vow-ink">Support</p><p className="text-xs text-vow-muted mt-1">Report an issue, ask a question, or send feedback.</p></button>
        <button onClick={onLegal} className="profile-menu-item w-full text-left"><p className="text-sm text-vow-ink">Terms & Policies</p><p className="text-xs text-vow-muted mt-1">EULA, copyright and service policies.</p></button>
        <div className="profile-menu-item"><div className="flex items-center justify-between gap-4"><div><p className="text-sm text-vow-ink">Appearance</p><p className="text-xs text-vow-muted mt-1">Switch VOW between light and dark mode.</p></div><button type="button" onClick={toggleTheme} className="vow-btn-soft shrink-0" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? 'Dark mode' : 'Light mode'}</button></div><p className="text-[10px] text-vow-muted mt-2 capitalize">Current mode: {theme}</p></div>
        <div className="profile-menu-item"><div className="flex items-center justify-between gap-4"><div><p className="text-sm text-vow-ink">Notifications</p><p className="text-xs text-vow-muted mt-1">VOW reminders use sound and vibration automatically when notifications are allowed.</p></div>{notificationsGranted && notificationsEnabled && <span className="text-xs text-vow-ink">Enabled</span>}</div><p className="text-[10px] text-vow-muted mt-2 capitalize">Status: {notificationStatus} · {notificationsEnabled ? 'reminders on' : 'reminders off'}</p><div className="flex flex-wrap gap-2 mt-4">{(!notificationsGranted || !notificationsEnabled) && notificationStatus !== 'unsupported' && <button onClick={handleEnableNotifications} disabled={requesting} className="vow-btn-soft disabled:opacity-50">{requesting ? 'Requesting…' : 'Enable notifications'}</button>}{notificationsGranted && notificationsEnabled && <button onClick={() => void handleDisableNotifications()} className="vow-btn-soft">Disable reminders</button>}</div></div>
        <div className="profile-menu-item"><div className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="text-sm text-vow-ink">My name</p><p className="text-xs text-vow-muted mt-1 truncate">{name || 'Not provided'}</p></div><button onClick={() => { setEditingName(true); setNameMessage(''); }} className="vow-btn-soft shrink-0">Change Name</button></div>{editingName && <div className="mt-4 border-t border-vow-border pt-4"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus className="vow-input" placeholder="What should VOW call you?" /><div className="flex gap-2 mt-2"><button onClick={handleSaveName} disabled={savingName || !name.trim()} className="vow-btn-primary disabled:opacity-50">{savingName ? 'Saving…' : 'Save name'}</button><button onClick={() => { setEditingName(false); setName(displayName); }} className="vow-btn-ghost">Cancel</button></div>{nameMessage && <p className="text-xs text-vow-muted mt-2">{nameMessage}</p>}</div>}</div>
        <div className="profile-menu-item">
          <p className="text-sm text-vow-ink">Account email</p>
          <p className="text-xs text-vow-muted mt-1 break-words">{session?.user?.email || 'Not provided'}</p>
          <div className="mt-5 border-t border-vow-border pt-5">
            <p className="text-sm text-vow-ink">Sign-in methods</p>
            <p className="text-xs text-vow-muted mt-1">Email and Google can be connected to the same VOW account, so your goals and progress stay under one user identity.</p>
            {identityLoading ? <p className="text-xs text-vow-muted mt-3">Checking connected methods…</p> : <div className="mt-4 space-y-2">
              {identities.map((identity) => <div key={identity.id} className="flex items-center justify-between gap-3 text-xs border border-vow-border px-3 py-2">
                <span className="text-vow-ink capitalize">{identity.provider === 'email' ? 'Email' : identity.provider}</span>
                <span className="text-vow-muted truncate">{identity.email || session?.user?.email || 'Connected'}</span>
              </div>)}
              {!identities.some((identity) => identity.provider === 'google') && <button type="button" onClick={() => void handleLinkGoogle()} disabled={identityLinking} className="vow-btn-soft mt-2 disabled:opacity-50">{identityLinking ? 'Connecting…' : 'Connect Google'}</button>}
              {identities.some((identity) => identity.provider === 'google') && <p className="text-xs text-vow-ink mt-2">Google is connected to this VOW account.</p>}
              {identityMessage && <p className="text-xs text-vow-muted mt-2" role="status">{identityMessage}</p>}
            </div>}
          </div>
        </div>
        <button onClick={() => setConfirmSignOut(true)} className="profile-menu-item w-full flex items-center justify-between gap-4 text-left"><div><p className="text-sm text-vow-ink">Sign out</p><p className="text-xs text-vow-muted mt-1">Sign out of this VOW account.</p></div><span className="text-lg leading-none text-vow-muted">›</span></button>
        <button onClick={() => { setDeleteError(''); setConfirmDelete(true); }} className="profile-menu-item w-full flex items-center justify-between gap-4 text-left"><div><p className="text-sm text-vow-ink">Delete account</p><p className="text-xs text-vow-muted mt-1">Permanently delete your VOW account and associated account data.</p></div><span className="text-lg leading-none text-vow-muted">›</span></button>
      </div>
      {confirmDelete && <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="delete-account-title"><div className="bg-vow-bg border border-vow-border p-6 max-w-sm w-full"><h2 id="delete-account-title" className="vow-heading text-xl text-vow-ink mb-2">Delete your VOW account?</h2><p className="text-sm text-vow-muted leading-relaxed mb-6">Your account will be scheduled for permanent deletion in 14 days. You can sign back in during that period to cancel the deletion. After 14 days, the deletion becomes permanent.</p>{deleteError && <p role="alert" className="text-xs text-vow-ink mb-4 border-l-2 border-vow-ink pl-3">{deleteError}</p>}<div className="flex gap-3"><button onClick={() => setConfirmDelete(false)} disabled={deleting} className="vow-btn-ghost flex-1">Keep account</button><button onClick={() => void handleDeleteAccount()} disabled={deleting} className="vow-btn-primary flex-1">{deleting ? 'Scheduling deletion…' : 'Schedule deletion'}</button></div></div></div>}
      {confirmSignOut && <div className="fixed inset-0 bg-black/20 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true"><div className="bg-vow-bg border border-vow-border p-6 max-w-sm w-full"><h2 className="vow-heading text-lg text-vow-ink mb-2">Are you sure you want to sign out?</h2><p className="text-sm text-vow-muted leading-relaxed mb-6">You can sign back in whenever you are ready.</p><div className="flex gap-3"><button onClick={() => setConfirmSignOut(false)} className="vow-btn-ghost flex-1">Cancel</button><button onClick={handleSignOut} className="vow-btn-primary flex-1">Sign out</button></div></div></div>}
    </div>
  );
}


function SharedInformationPage({ session, displayName, onBack }: { session: ReturnType<typeof useAuth>['session']; displayName: string; onBack: () => void }) {
  const name = displayName;
  const email = session?.user?.email || '';
  const phoneCalendarConnected = localStorage.getItem('vow:native-calendar-sync') === 'true';
  const googleCalendarConnected = localStorage.getItem('vow:connections')?.includes('google-calendar') === true;
  const rows = [
    { label: 'Name', value: name || 'Not provided' },
    { label: 'Email', value: email || 'Not provided' },
    { label: 'Google Calendar', value: googleCalendarConnected ? 'Connected' : 'Not connected' },
    { label: 'Phone Calendar', value: phoneCalendarConnected ? 'Connected' : 'Not connected' },
  ];
  return <div><button onClick={onBack} className="text-sm text-vow-muted hover:text-vow-ink mb-6">← Back to profile</button><PageHeader title="Account information" subtitle="A clear view of the account details and calendar connections currently available to VOW." /><div className="border border-vow-border divide-y divide-vow-border">{rows.map((row) => <div key={row.label} className="p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"><p className="text-xs text-vow-muted uppercase tracking-wide">{row.label}</p><p className="text-sm text-vow-ink sm:text-right break-words max-w-md">{row.value}</p></div>)}</div></div>;
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
