import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from './AppShell';
import { getNotificationPermission, requestNotificationPermission, syncUpcomingSessionNotifications, getNotificationPreferences, setNotificationPreferences, type NotificationPreferences } from '@/lib/notifications';
import { ConnectPage } from './Connect';
import { ArrowLeft } from 'lucide-react';

function getDisplayName(session: ReturnType<typeof useAuth>['session']) {
  const metadata = session?.user?.user_metadata as Record<string, unknown> | undefined;
  const fullName = typeof metadata?.full_name === 'string' ? metadata.full_name : typeof metadata?.name === 'string' ? metadata.name : '';
  if (fullName.trim()) return fullName.trim();
  const emailName = session?.user?.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  return emailName || '';
}

type ProfileSubpage = 'main' | 'connect' | 'shared';

export function ProfilePage({ onLegal }: { onLegal?: () => void }) {
  const { session } = useAuth();
  const [subpage, setSubpage] = useState<ProfileSubpage>('main');
  const [notificationStatus, setNotificationStatus] = useState<string>('checking');
  const [requesting, setRequesting] = useState(false);
  const [name, setName] = useState(() => getDisplayName(session));
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState('');
  const [notificationPreferences, setNotificationPreferencesState] = useState<NotificationPreferences>(() => getNotificationPreferences());
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => { getNotificationPermission().then(setNotificationStatus); }, []);
  useEffect(() => { setName(getDisplayName(session)); }, [session]);

  async function handleEnableNotifications() {
    setRequesting(true);
    const status = await requestNotificationPermission();
    setNotificationStatus(status);
    if (status === 'granted' && session) {
      const { data } = await supabase.from('sessions').select('*').eq('user_id', session.user.id).eq('status', 'scheduled').gte('scheduled_at', new Date().toISOString()).order('scheduled_at', { ascending: true });
      if (data) await syncUpcomingSessionNotifications(data);
    }
    setRequesting(false);
  }

  async function updateNotificationPreference(key: keyof NotificationPreferences, value: boolean) {
    const next = { ...notificationPreferences, [key]: value };
    setNotificationPreferencesState(next);
    await setNotificationPreferences(next);
    if (session && notificationStatus === 'granted') {
      const { data } = await supabase.from('sessions').select('*').eq('user_id', session.user.id).eq('status', 'scheduled').gte('scheduled_at', new Date().toISOString()).order('scheduled_at', { ascending: true });
      if (data) await syncUpcomingSessionNotifications(data);
    }
  }

  async function handleSaveName() {
    const nextName = name.trim();
    if (!nextName || !session || nextName.length > 80) return;
    setSavingName(true); setNameMessage('');
    const { error } = await supabase.auth.updateUser({ data: { ...session.user.user_metadata, full_name: nextName, name: nextName } });
    setNameMessage(error ? error.message : 'Name saved.');
    setSavingName(false);
    if (!error) setEditingName(false);
  }

  async function handleSignOut() { setConfirmSignOut(false); await supabase.auth.signOut(); }
  const notificationsEnabled = notificationStatus === 'granted';

  if (subpage === 'connect') return <ConnectPage onBack={() => setSubpage('main')} />;
  if (subpage === 'shared') return <SharedInformationPage session={session} onBack={() => setSubpage('main')} />;

  return (
    <div>
      <PageHeader title={`Welcome back, ${name || 'there'}`} subtitle="Your account and preferences." />
      <div className="border border-vow-border divide-y divide-vow-border">
        <button onClick={() => setSubpage('connect')} className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-vow-border/20 transition-colors"><div><p className="text-sm text-vow-ink">Connect</p><p className="text-xs text-vow-muted mt-1">Manage calendars and other services connected to VOW.</p></div><span className="text-lg leading-none text-vow-muted" aria-hidden="true">›</span></button>
        <button onClick={() => setSubpage('shared')} className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-vow-border/20 transition-colors"><div><p className="text-sm text-vow-ink">Account information</p><p className="text-xs text-vow-muted mt-1">See the account details and calendar connections currently available to VOW.</p></div><span className="text-lg leading-none text-vow-muted" aria-hidden="true">›</span></button>
        <button onClick={onLegal} className="w-full text-left p-5 hover:bg-vow-border/20 transition-colors"><p className="text-sm text-vow-ink">Terms & Policies</p><p className="text-xs text-vow-muted mt-1">Privacy, connected services, security and service terms.</p></button>
        <div className="p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-sm text-vow-ink">Notifications</p><p className="text-xs text-vow-muted mt-1">Android reminders for scheduled VOW sessions.</p></div>{notificationsEnabled && <span className="text-xs text-vow-ink">Enabled</span>}</div><p className="text-[10px] text-vow-muted mt-2 capitalize">Status: {notificationStatus}</p><div className="mt-4 space-y-3 border-t border-vow-border pt-4"><label className="flex items-center justify-between gap-4 text-xs text-vow-ink"><span><span className="block">Sound</span><span className="block text-[10px] text-vow-muted mt-0.5">Play the Android default notification sound.</span></span><input type="checkbox" checked={notificationPreferences.sound} onChange={(e) => updateNotificationPreference('sound', e.target.checked)} disabled={!notificationsEnabled} className="h-4 w-4" /></label><label className="flex items-center justify-between gap-4 text-xs text-vow-ink"><span><span className="block">Vibration</span><span className="block text-[10px] text-vow-muted mt-0.5">Use Android notification vibration.</span></span><input type="checkbox" checked={notificationPreferences.vibration} onChange={(e) => updateNotificationPreference('vibration', e.target.checked)} disabled={!notificationsEnabled} className="h-4 w-4" /></label></div><div className="flex flex-wrap gap-2 mt-4">{!notificationsEnabled && notificationStatus !== 'unsupported' && <button onClick={handleEnableNotifications} disabled={requesting} className="border border-vow-ink px-3 py-2 text-xs text-vow-ink disabled:opacity-50">{requesting ? 'Requesting…' : 'Enable notifications'}</button>}{notificationsEnabled && <span className="border border-vow-border px-3 py-2 text-xs text-vow-muted">Scheduled reminders active</span>}</div></div>
        <div className="p-5"><div className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="text-sm text-vow-ink">My name</p><p className="text-xs text-vow-muted mt-1 truncate">{name || 'Not provided'}</p></div><button onClick={() => { setEditingName(true); setNameMessage(''); }} className="shrink-0 text-xs text-vow-ink border border-vow-border px-3 py-2 hover:border-vow-ink transition-colors">Change Name</button></div>{editingName && <div className="mt-4 border-t border-vow-border pt-4"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus className="vow-input" placeholder="What should VOW call you?" /><div className="flex gap-2 mt-2"><button onClick={handleSaveName} disabled={savingName || !name.trim()} className="vow-btn-primary disabled:opacity-50">{savingName ? 'Saving…' : 'Save name'}</button><button onClick={() => { setEditingName(false); setName(getDisplayName(session)); }} className="vow-btn-ghost">Cancel</button></div>{nameMessage && <p className="text-xs text-vow-muted mt-2">{nameMessage}</p>}</div>}</div>
        <div className="p-5"><p className="text-sm text-vow-ink">Account email</p><p className="text-xs text-vow-muted mt-1 break-words">{session?.user?.email || 'Not provided'}</p></div>
        <button onClick={() => setConfirmSignOut(true)} className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-vow-border/20 transition-colors"><div><p className="text-sm text-vow-ink">Sign out</p><p className="text-xs text-vow-muted mt-1">Sign out of this VOW account.</p></div><span className="text-lg leading-none text-vow-muted" aria-hidden="true">›</span></button>
      </div>
      {confirmSignOut && <div className="fixed inset-0 bg-black/20 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-label="Confirm sign out"><div className="bg-white border border-vow-border p-6 max-w-sm w-full"><h2 className="vow-heading text-lg text-vow-ink mb-2">Are you sure you want to sign out?</h2><p className="text-sm text-vow-muted leading-relaxed mb-6">You can sign back in whenever you are ready.</p><div className="flex gap-3"><button onClick={() => setConfirmSignOut(false)} className="vow-btn-ghost flex-1">Cancel</button><button onClick={handleSignOut} className="vow-btn-primary flex-1">Sign out</button></div></div></div>}
    </div>
  );
}

function SharedInformationPage({ session, onBack }: { session: ReturnType<typeof useAuth>['session']; onBack: () => void }) {
  const name = getDisplayName(session);
  const phone = session?.user?.phone || '';
  const email = session?.user?.email || '';
  const phoneCalendarConnected = localStorage.getItem('vow:native-calendar-sync') === 'true';
  const googleCalendarConnected = localStorage.getItem('vow:connections')?.includes('google-calendar') === true;
  const rows = [
    { label: 'Name', value: name || 'Not provided' },
    { label: 'Email', value: email || 'Not provided' },
    { label: 'Phone number', value: phone || 'Not provided' },
    { label: 'Google Calendar', value: googleCalendarConnected ? 'Connected' : 'Not connected' },
    { label: 'Phone Calendar', value: phoneCalendarConnected ? 'Connected' : 'Not connected' },
  ];
  return <div><button onClick={onBack} className="text-sm text-vow-muted hover:text-vow-ink mb-6 flex items-center gap-1 transition-colors"><ArrowLeft className="w-4 h-4" />Back to profile</button><PageHeader title="Account information" subtitle="A clear view of the account details and calendar connections currently available to VOW." /><div className="border border-vow-border divide-y divide-vow-border">{rows.map((row) => <div key={row.label} className="p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"><p className="text-xs text-vow-muted uppercase tracking-wide">{row.label}</p><p className="text-sm text-vow-ink sm:text-right break-words max-w-md">{row.value}</p></div>)}</div></div>;
}
