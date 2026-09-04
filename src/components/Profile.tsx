import { registerPlugin } from '@capacitor/core';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { PageHeader } from './AppShell';
import { getNotificationPermission, requestNotificationPermission, syncUpcomingSessionNotifications } from '@/lib/notifications';
import { ConnectPage } from './Connect';

type ProfileSubpage = 'main' | 'connect' | 'shared' | 'customise';
type IconColour = 'white' | 'black' | 'gold' | 'blue' | 'red' | 'green' | 'purple' | 'orange' | 'pink' | 'teal';

type VowIconPlugin = { setColour(options: { colour: IconColour }): Promise<{ colour: IconColour }> };
const VowIcon = registerPlugin<VowIconPlugin>('VowIcon');

const ICON_OPTIONS: Array<{ value: IconColour; label: string; foreground: string; background: string }> = [
  { value: 'white', label: 'White', foreground: '#111111', background: '#ffffff' },
  { value: 'black', label: 'Black', foreground: '#ffffff', background: '#111111' },
  { value: 'gold', label: 'Gold', foreground: '#d4af37', background: '#111111' },
  { value: 'blue', label: 'Blue', foreground: '#3b82f6', background: '#111111' },
  { value: 'red', label: 'Red', foreground: '#ef4444', background: '#111111' },
  { value: 'green', label: 'Green', foreground: '#22c55e', background: '#111111' },
  { value: 'purple', label: 'Purple', foreground: '#a855f7', background: '#111111' },
  { value: 'orange', label: 'Orange', foreground: '#f97316', background: '#111111' },
  { value: 'pink', label: 'Pink', foreground: '#ec4899', background: '#111111' },
  { value: 'teal', label: 'Teal', foreground: '#14b8a6', background: '#111111' },
];

export function ProfilePage({ onLegal }: { onLegal?: () => void }) {
  const { session, displayName, updateDisplayName } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [subpage, setSubpage] = useState<ProfileSubpage>('main');
  const [notificationStatus, setNotificationStatus] = useState<string>('checking');
  const [requesting, setRequesting] = useState(false);
  const [name, setName] = useState(displayName);
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<IconColour>('white');
  const [iconMessage, setIconMessage] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => { getNotificationPermission().then(setNotificationStatus); }, []);
  useEffect(() => { setName(displayName); }, [displayName]);
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      setSelectedIcon('white');
      return;
    }

    const scopedKey = `vow:icon-colour:${userId}`;
    const stored = localStorage.getItem(scopedKey);
    const legacy = localStorage.getItem('vow:icon-colour');
    const validColours = new Set<IconColour>(ICON_OPTIONS.map((option) => option.value));

    if (stored && validColours.has(stored as IconColour)) {
      setSelectedIcon(stored as IconColour);
      return;
    }

    if (legacy && validColours.has(legacy as IconColour)) {
      localStorage.setItem(scopedKey, legacy);
      localStorage.removeItem('vow:icon-colour');
      setSelectedIcon(legacy as IconColour);
      return;
    }

    setSelectedIcon('white');
  }, [session?.user.id]);

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

  async function handleIconChange(colour: IconColour) {
    setIconMessage('');
    setSelectedIcon(colour);
    if (session?.user.id) {
      localStorage.setItem(`vow:icon-colour:${session.user.id}`, colour);
    }
    try {
      await VowIcon.setColour({ colour });
      setIconMessage(`${colour[0].toUpperCase()}${colour.slice(1)} VOW icon selected.`);
    } catch {
      setIconMessage('Icon preference saved. The launcher icon will update on Android when native icon switching is available.');
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

  async function handleSignOut() { setConfirmSignOut(false); await supabase.auth.signOut(); }
  const notificationsEnabled = notificationStatus === 'granted';

  if (subpage === 'connect') return <ConnectPage onBack={() => setSubpage('main')} />;
  if (subpage === 'shared') return <SharedInformationPage session={session} displayName={displayName} onBack={() => setSubpage('main')} />;
  if (subpage === 'customise') return <CustomisePage selectedIcon={selectedIcon} message={iconMessage} onIconChange={handleIconChange} onBack={() => setSubpage('main')} />;

  return (
    <div>
      <PageHeader title={`Welcome back, ${displayName || 'there'}`} subtitle="Your account and preferences." />
      <div className="border border-vow-border divide-y divide-vow-border">
        <button onClick={() => setSubpage('connect')} className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-vow-surface/40 transition-colors"><div><p className="text-sm text-vow-ink">Connect</p><p className="text-xs text-vow-muted mt-1">Manage calendars and other services connected to VOW.</p></div><span className="text-lg leading-none text-vow-muted">›</span></button>
        <button onClick={() => setSubpage('customise')} className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-vow-surface/40 transition-colors"><div><p className="text-sm text-vow-ink">Customise</p><p className="text-xs text-vow-muted mt-1">Personalise your VOW icon and app experience.</p></div><span className="text-lg leading-none text-vow-muted">›</span></button>
        <button onClick={() => setSubpage('shared')} className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-vow-surface/40 transition-colors"><div><p className="text-sm text-vow-ink">Account information</p><p className="text-xs text-vow-muted mt-1">See the account details and calendar connections currently available to VOW.</p></div><span className="text-lg leading-none text-vow-muted">›</span></button>
        <button onClick={onLegal} className="w-full text-left p-5 hover:bg-vow-surface/40 transition-colors"><p className="text-sm text-vow-ink">Terms & Policies</p><p className="text-xs text-vow-muted mt-1">Privacy, connected services, security and service terms.</p></button>
        <div className="p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-sm text-vow-ink">Appearance</p><p className="text-xs text-vow-muted mt-1">Switch VOW between light and dark mode.</p></div><button type="button" onClick={toggleTheme} className="vow-btn-soft shrink-0" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? 'Dark mode' : 'Light mode'}</button></div><p className="text-[10px] text-vow-muted mt-2 capitalize">Current mode: {theme}</p></div>
        <div className="p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-sm text-vow-ink">Notifications</p><p className="text-xs text-vow-muted mt-1">Turn on reminders for your scheduled VOW sessions.</p></div>{!notificationsEnabled && notificationStatus !== 'unsupported' && <button onClick={handleEnableNotifications} disabled={requesting} className="vow-btn-soft shrink-0 disabled:opacity-50">{requesting ? 'Enabling…' : 'Enable notifications'}</button>}</div></div>
        <div className="p-5"><div className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="text-sm text-vow-ink">My name</p><p className="text-xs text-vow-muted mt-1 truncate">{name || 'Not provided'}</p></div><button onClick={() => { setEditingName(true); setNameMessage(''); }} className="vow-btn-soft shrink-0">Change Name</button></div>{editingName && <div className="mt-4 border-t border-vow-border pt-4"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus className="vow-input" placeholder="What should VOW call you?" /><div className="flex gap-2 mt-2"><button onClick={handleSaveName} disabled={savingName || !name.trim()} className="vow-btn-primary disabled:opacity-50">{savingName ? 'Saving…' : 'Save name'}</button><button onClick={() => { setEditingName(false); setName(displayName); }} className="vow-btn-ghost">Cancel</button></div>{nameMessage && <p className="text-xs text-vow-muted mt-2">{nameMessage}</p>}</div>}</div>
        <div className="p-5"><p className="text-sm text-vow-ink">Account email</p><p className="text-xs text-vow-muted mt-1 break-words">{session?.user?.email || 'Not provided'}</p></div>
        <button onClick={() => setConfirmSignOut(true)} className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-vow-surface/40 transition-colors"><div><p className="text-sm text-vow-ink">Sign out</p><p className="text-xs text-vow-muted mt-1">Sign out of this VOW account.</p></div><span className="text-lg leading-none text-vow-muted">›</span></button>
      </div>
      {confirmSignOut && <div className="fixed inset-0 bg-black/20 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true"><div className="bg-vow-bg border border-vow-border p-6 max-w-sm w-full"><h2 className="vow-heading text-lg text-vow-ink mb-2">Are you sure you want to sign out?</h2><p className="text-sm text-vow-muted leading-relaxed mb-6">You can sign back in whenever you are ready.</p><div className="flex gap-3"><button onClick={() => setConfirmSignOut(false)} className="vow-btn-ghost flex-1">Cancel</button><button onClick={handleSignOut} className="vow-btn-primary flex-1">Sign out</button></div></div></div>}
    </div>
  );
}

function CustomisePage({ selectedIcon, message, onIconChange, onBack }: { selectedIcon: IconColour; message: string; onIconChange: (colour: IconColour) => void; onBack: () => void }) {
  return <div><button onClick={onBack} className="text-sm text-vow-muted hover:text-vow-ink mb-6 flex items-center gap-1 transition-colors">← Back to profile</button><PageHeader title="Customise" subtitle="Make VOW feel like yours without adding noise." /><section className="border border-vow-border p-5"><div className="mb-5"><p className="vow-label mb-1">VOW Icon</p><p className="text-xs text-vow-muted">Choose from a wider range of launcher colours.</p></div><div className="grid grid-cols-2 sm:grid-cols-5 gap-3">{ICON_OPTIONS.map((option) => <button key={option.value} onClick={() => onIconChange(option.value)} aria-pressed={selectedIcon === option.value} className={`border p-3 transition-colors ${selectedIcon === option.value ? 'border-vow-ink bg-vow-surface/60' : 'border-vow-border hover:border-vow-muted'}`}><span className="mx-auto w-16 h-16 rounded-xl flex items-center justify-center" style={{ background: option.background }}><span style={{ color: option.foreground, fontSize: 54, lineHeight: 0.8, fontWeight: 800, fontFamily: 'Arial, sans-serif' }}>&gt;</span></span><span className="block text-xs text-vow-ink mt-3">{option.label}</span></button>)}</div>{message && <p className="text-xs text-vow-muted mt-4">{message}</p>}</section></div>;
}

function SharedInformationPage({ session, displayName, onBack }: { session: ReturnType<typeof useAuth>['session']; displayName: string; onBack: () => void }) {
  const name = displayName;
  const email = session?.user?.email || '';
  const userId = session?.user?.id;
  const phoneCalendarConnected = Boolean(userId && localStorage.getItem(`vow:native-calendar-sync:${userId}`) === 'true');
  const googleCalendarConnected = Boolean(userId && localStorage.getItem(`vow:connections:${userId}`) && localStorage.getItem(`vow:connections:${userId}`)?.includes('google-calendar'));
  const rows = [
    { label: 'Name', value: name || 'Not provided' },
    { label: 'Email', value: email || 'Not provided' },
    { label: 'Google Calendar', value: googleCalendarConnected ? 'Connected' : 'Not connected' },
    { label: 'Phone Calendar', value: phoneCalendarConnected ? 'Connected' : 'Not connected' },
  ];
  return <div><button onClick={onBack} className="text-sm text-vow-muted hover:text-vow-ink mb-6 flex items-center gap-1 transition-colors">← Back to profile</button><PageHeader title="Account information" subtitle="A clear view of the account details and calendar connections currently available to VOW." /><div className="border border-vow-border divide-y divide-vow-border">{rows.map((row) => <div key={row.label} className="p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"><p className="text-xs text-vow-muted uppercase tracking-wide">{row.label}</p><p className="text-sm text-vow-ink sm:text-right break-words max-w-md">{row.value}</p></div>)}</div></div>;
}
