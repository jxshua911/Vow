import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from './AppShell';
import { getNotificationPermission, requestNotificationPermission, syncUpcomingSessionNotifications, getNotificationPreferences, setNotificationPreferences, type NotificationPreferences } from '@/lib/notifications';
import { ConnectPage } from './Connect';
import { ArrowLeft, ChevronRight } from 'lucide-react';

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
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState('');
  const [notificationPreferences, setNotificationPreferencesState] = useState<NotificationPreferences>(() => getNotificationPreferences());

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
  }

  async function handleSignOut() { await supabase.auth.signOut(); }
  const notificationsEnabled = notificationStatus === 'granted';

  if (subpage === 'connect') return <ConnectPage onBack={() => setSubpage('main')} />;
  if (subpage === 'shared') return <SharedInformationPage session={session} onBack={() => setSubpage('main')} />;

  return (
    <div>
      <PageHeader title={`Welcome back, ${name || 'there'}`} subtitle="Your account and preferences." />
      <div className="space-y-6">
        <div className="border border-vow-border p-5 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 border border-vow-border flex items-center justify-center text-lg" aria-hidden="true">○</div>
            <div className="min-w-0"><p className="text-xs text-vow-muted uppercase tracking-wide mb-1">Account email</p><p className="text-sm text-vow-ink truncate">{session?.user?.email || 'Not provided'}</p></div>
          </div>
          <div className="border-t border-vow-border pt-5">
            <label htmlFor="vow-name" className="block text-xs text-vow-muted uppercase tracking-wide mb-2">Your name</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input id="vow-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="min-h-11 flex-1 border border-vow-border bg-transparent px-3 text-sm text-vow-ink outline-none focus:border-vow-ink" placeholder="What should VOW call you?" />
              <button onClick={handleSaveName} disabled={savingName || !name.trim()} className="min-h-11 border border-vow-ink px-4 text-xs text-vow-ink disabled:opacity-50">{savingName ? 'Saving…' : 'Save name'}</button>
            </div>
            {nameMessage && <p className="text-xs text-vow-muted mt-2">{nameMessage}</p>}
          </div>
        </div>

        <div className="border border-vow-border divide-y divide-vow-border">
          <button onClick={() => setSubpage('connect')} className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-vow-border/20 transition-colors"><div><p className="text-sm text-vow-ink">Connect</p><p className="text-xs text-vow-muted mt-1">Manage calendars and other services connected to VOW.</p></div><ChevronRight className="w-4 h-4 text-vow-muted shrink-0" /></button>
          <button onClick={() => setSubpage('shared')} className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-vow-border/20 transition-colors"><div><p className="text-sm text-vow-ink">Information shared with VOW</p><p className="text-xs text-vow-muted mt-1">See the account and connection information currently available to VOW.</p></div><ChevronRight className="w-4 h-4 text-vow-muted shrink-0" /></button>
          <button onClick={onLegal} className="w-full text-left p-5 hover:bg-vow-border/20 transition-colors"><p className="text-sm text-vow-ink">Terms & Policies</p><p className="text-xs text-vow-muted mt-1">Privacy, connected services, security and service terms.</p></button>
        </div>

        <div className="border border-vow-border p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 border border-vow-border flex items-center justify-center text-lg" aria-hidden="true">⌁</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2"><h2 className="text-sm font-medium text-vow-ink">Notifications</h2>{notificationsEnabled && <span className="text-xs text-vow-ink">Enabled</span>}</div>
              <p className="text-xs text-vow-muted mt-1 leading-relaxed">VOW uses Android's notification system for scheduled reminders. Sound and vibration are optional and start off.</p>
              <p className="text-[10px] text-vow-muted mt-2 capitalize">Status: {notificationStatus}</p>
              <div className="mt-5 space-y-3 border-t border-vow-border pt-4">
                <label className="flex items-center justify-between gap-4 text-xs text-vow-ink">
                  <span><span className="block">Sound</span><span className="block text-[10px] text-vow-muted mt-0.5">Play the Android default notification sound.</span></span>
                  <input type="checkbox" checked={notificationPreferences.sound} onChange={(e) => updateNotificationPreference('sound', e.target.checked)} disabled={!notificationsEnabled} className="h-4 w-4" />
                </label>
                <label className="flex items-center justify-between gap-4 text-xs text-vow-ink">
                  <span><span className="block">Vibration</span><span className="block text-[10px] text-vow-muted mt-0.5">Use Android notification vibration.</span></span>
                  <input type="checkbox" checked={notificationPreferences.vibration} onChange={(e) => updateNotificationPreference('vibration', e.target.checked)} disabled={!notificationsEnabled} className="h-4 w-4" />
                </label>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {!notificationsEnabled && notificationStatus !== 'unsupported' && <button onClick={handleEnableNotifications} disabled={requesting} className="border border-vow-ink px-3 py-2 text-xs text-vow-ink disabled:opacity-50">{requesting ? 'Requesting…' : 'Enable notifications'}</button>}
                {notificationsEnabled && <span className="border border-vow-border px-3 py-2 text-xs text-vow-muted">Scheduled reminders active</span>}
              </div>
            </div>
          </div>
        </div>

        <button onClick={handleSignOut} className="w-full flex items-center justify-center gap-2 border border-vow-border py-3 text-sm text-vow-muted hover:text-vow-ink hover:border-vow-ink transition-colors"><span aria-hidden="true">↪</span>Sign out</button>
      </div>
    </div>
  );
}

function SharedInformationPage({ session, onBack }: { session: ReturnType<typeof useAuth>['session']; onBack: () => void }) {
  const metadata = session?.user?.user_metadata as Record<string, unknown> | undefined;
  const name = getDisplayName(session);
  const phone = session?.user?.phone || '';
  const email = session?.user?.email || '';
  const providerNames = (session?.user?.identities || []).map((identity) => identity.provider).filter(Boolean);
  const phoneCalendarEnabled = localStorage.getItem('vow:native-calendar-sync') === 'true';
  const googleCalendarConnected = localStorage.getItem('vow:connections')?.includes('google-calendar') === true;
  const rows = [
    { label: 'Name', value: name || 'Not provided' },
    { label: 'Email', value: email || 'Not provided' },
    { label: 'Phone number', value: phone || 'Not provided' },
    { label: 'Sign-in provider', value: providerNames.length ? providerNames.join(', ') : 'Email/password' },
    { label: 'Phone calendar', value: phoneCalendarEnabled ? 'Connected — VOW can add scheduled sessions to your device calendar' : 'Not connected' },
    { label: 'Google Calendar', value: googleCalendarConnected ? 'Connected' : 'Not connected' },
  ];
  void metadata;

  return <div>
    <button onClick={onBack} className="text-sm text-vow-muted hover:text-vow-ink mb-6 flex items-center gap-1 transition-colors"><ArrowLeft className="w-4 h-4" />Back to profile</button>
    <PageHeader title="Information shared with VOW" subtitle="A transparent view of account details and connections currently available to the app." />
    <div className="border border-vow-border divide-y divide-vow-border">
      {rows.map((row) => <div key={row.label} className="p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"><p className="text-xs text-vow-muted uppercase tracking-wide">{row.label}</p><p className="text-sm text-vow-ink sm:text-right break-words max-w-md">{row.value}</p></div>)}
    </div>
    <p className="text-xs text-vow-muted leading-relaxed mt-5">VOW only shows information that is available through your account or the connections you have enabled. Disconnecting a service changes what VOW can access from that service; existing device-calendar events are not automatically deleted.</p>
  </div>;
}
