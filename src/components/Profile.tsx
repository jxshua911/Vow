import { registerPlugin } from '@capacitor/core';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { PageHeader } from './AppShell';
import { getNotificationPermission, requestNotificationPermission, syncUpcomingSessionNotifications, getNotificationPreferences, setNotificationPreferences } from '@/lib/notifications';
import { getEntitlementSnapshot } from '@/lib/entitlements';
import { VOW_LANGUAGES, LANGUAGE_STORAGE_KEY, languageName } from '@/lib/i18n';

type ProfileSubpage = 'main' | 'shared' | 'customise' | 'language';
type IconColour = 'white' | 'black' | 'gold' | 'blue';

type VowIconPlugin = {
  setColour(options: { colour: IconColour }): Promise<{ colour: IconColour }>;
  setCustom(options: { background: string; foreground: string }): Promise<{ background: string; foreground: string; shortcut?: boolean }>;
};
const VowIcon = registerPlugin<VowIconPlugin>('VowIcon');

const ICON_OPTIONS: Array<{ value: IconColour; label: string; foreground: string; background: string }> = [
  { value: 'white', label: 'White', foreground: '#111111', background: '#ffffff' },
  { value: 'black', label: 'Black', foreground: '#ffffff', background: '#111111' },
  { value: 'gold', label: 'Gold', foreground: '#d4af37', background: '#111111' },
  { value: 'blue', label: 'Blue', foreground: '#3b82f6', background: '#111111' },
];

export function ProfilePage({ onLegal, onUpgrade }: { onLegal?: () => void; onUpgrade?: () => void }) {
  const { session, displayName, updateDisplayName } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [subpage, setSubpage] = useState<ProfileSubpage>('main');
  const [notificationStatus, setNotificationStatus] = useState<string>('checking');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => getNotificationPreferences().enabled);
  const [requesting, setRequesting] = useState(false);
  const [name, setName] = useState(displayName);
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<IconColour>(() => (localStorage.getItem('vow:icon-colour') as IconColour) || 'white');
  const [customBackground, setCustomBackground] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vow:custom-icon') || '').background || '#ffffff'; } catch { return '#ffffff'; }
  });
  const [customForeground, setCustomForeground] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vow:custom-icon') || '').foreground || '#3b82f6'; } catch { return '#3b82f6'; }
  });
  const [iconMessage, setIconMessage] = useState('');
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [premium, setPremium] = useState(false);
  const [language, setLanguage] = useState(() => localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en');
  const [languageSaving, setLanguageSaving] = useState(false);
  const [languageMessage, setLanguageMessage] = useState('');

  useEffect(() => { getNotificationPermission().then(setNotificationStatus); }, []);
  useEffect(() => { setName(displayName); }, [displayName]);
  useEffect(() => { getEntitlementSnapshot().then(snapshot => setPremium(Boolean(snapshot && snapshot.plan === 'premium'))).catch(() => setPremium(false)); }, []);

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

  async function handleIconChange(colour: IconColour) {
    setIconMessage('');
    setSelectedIcon(colour);
    localStorage.setItem('vow:icon-colour', colour);
    localStorage.removeItem('vow:custom-icon');
    try {
      await VowIcon.setColour({ colour });
      setIconMessage(`${colour[0].toUpperCase()}${colour.slice(1)} VOW icon selected.`);
    } catch {
      setIconMessage('Icon preference saved. The launcher will update when Android applies the selected icon.');
    }
  }

  async function handleCustomIconChange(background: string, foreground: string) {
    setCustomBackground(background);
    setCustomForeground(foreground);
    setIconMessage('');
    localStorage.setItem('vow:custom-icon', JSON.stringify({ background, foreground }));
    try {
      await VowIcon.setCustom({ background, foreground });
      setIconMessage('Custom VOW icon created. Android may ask you to confirm the launcher shortcut.');
    } catch {
      setIconMessage('Custom icon preview saved. Native launcher shortcut could not be created on this device.');
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

  async function handleDeleteAccount() {
    if (deleting) return;
    setDeleting(true); setDeleteError('');
    const { data, error } = await supabase.functions.invoke('vow-account-delete', { body: { confirm: true } });
    if (error || !data?.deleted) {
      setDeleteError(data?.error || error?.message || 'VOW could not complete account deletion.');
      setDeleting(false);
      return;
    }
    await supabase.auth.signOut();
    setDeleting(false);
  }
  const notificationsGranted = notificationStatus === 'granted';

  if (subpage === 'shared') return <SharedInformationPage session={session} displayName={displayName} onBack={() => setSubpage('main')} />;
  if (subpage === 'customise') return <CustomisePage premium={premium} selectedIcon={selectedIcon} customBackground={customBackground} customForeground={customForeground} message={iconMessage} onIconChange={handleIconChange} onCustomIconChange={handleCustomIconChange} onBack={() => setSubpage('main')} onUpgrade={onUpgrade} />;
  if (subpage === 'language') return <LanguagePage language={language} saving={languageSaving} message={languageMessage} onChange={async (next) => {
    setLanguageSaving(true); setLanguageMessage(''); setLanguage(next); localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    if (session) {
      const { error } = await supabase.from('user_settings').update({ preferred_language: next }).eq('user_id', session.user.id);
      setLanguageMessage(error ? 'Language saved on this device. Account sync will retry later.' : `${languageName(next)} selected.`);
    } else setLanguageMessage(`${languageName(next)} selected.`);
    setLanguageSaving(false);
  }} onBack={() => setSubpage('main')} />;

  return (
    <div>
      <PageHeader title={`Welcome back, ${displayName || 'there'}`} subtitle="Your account and preferences." />
      <div className="border border-vow-border divide-y divide-vow-border">
        <button onClick={() => premium ? setSubpage('customise') : onUpgrade?.()} className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-vow-surface/40 transition-colors"><div><p className="text-sm text-vow-ink">Customise</p><p className="text-xs text-vow-muted mt-1">{premium ? 'Personalise your VOW icon and app experience.' : 'Premium feature — personalise your VOW icon and app experience.'}</p></div><span className="text-lg leading-none text-vow-muted">›</span></button>
        <button onClick={() => setSubpage('shared')} className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-vow-surface/40 transition-colors"><div><p className="text-sm text-vow-ink">Account information</p><p className="text-xs text-vow-muted mt-1">See the account details and calendar connections currently available to VOW.</p></div><span className="text-lg leading-none text-vow-muted">›</span></button>
        <button onClick={() => setSubpage('language')} className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-vow-surface/40 transition-colors"><div><p className="text-sm text-vow-ink">Language</p><p className="text-xs text-vow-muted mt-1">Choose the language VOW uses for the app and AI coaching.</p></div><span className="text-sm text-vow-muted">{VOW_LANGUAGES.find((item) => item.code === language)?.flag || '🌐'}</span></button>
        <button onClick={onLegal} className="w-full text-left p-5 hover:bg-vow-surface/40 transition-colors"><p className="text-sm text-vow-ink">Terms & Policies</p><p className="text-xs text-vow-muted mt-1">EULA, copyright and service policies.</p></button>
        <div className="p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-sm text-vow-ink">Appearance</p><p className="text-xs text-vow-muted mt-1">Switch VOW between light and dark mode.</p></div><button type="button" onClick={toggleTheme} className="vow-btn-soft shrink-0" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? 'Dark mode' : 'Light mode'}</button></div><p className="text-[10px] text-vow-muted mt-2 capitalize">Current mode: {theme}</p></div>
        <div className="p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-sm text-vow-ink">Notifications</p><p className="text-xs text-vow-muted mt-1">VOW reminders use sound and vibration automatically when notifications are allowed.</p></div>{notificationsGranted && notificationsEnabled && <span className="text-xs text-vow-ink">Enabled</span>}</div><p className="text-[10px] text-vow-muted mt-2 capitalize">Status: {notificationStatus} · {notificationsEnabled ? 'reminders on' : 'reminders off'}</p><div className="flex flex-wrap gap-2 mt-4">{(!notificationsGranted || !notificationsEnabled) && notificationStatus !== 'unsupported' && <button onClick={handleEnableNotifications} disabled={requesting} className="vow-btn-soft disabled:opacity-50">{requesting ? 'Requesting…' : 'Enable notifications'}</button>}{notificationsGranted && notificationsEnabled && <button onClick={() => void handleDisableNotifications()} className="vow-btn-soft">Disable reminders</button>}</div></div>
        <div className="p-5"><div className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="text-sm text-vow-ink">My name</p><p className="text-xs text-vow-muted mt-1 truncate">{name || 'Not provided'}</p></div><button onClick={() => { setEditingName(true); setNameMessage(''); }} className="vow-btn-soft shrink-0">Change Name</button></div>{editingName && <div className="mt-4 border-t border-vow-border pt-4"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus className="vow-input" placeholder="What should VOW call you?" /><div className="flex gap-2 mt-2"><button onClick={handleSaveName} disabled={savingName || !name.trim()} className="vow-btn-primary disabled:opacity-50">{savingName ? 'Saving…' : 'Save name'}</button><button onClick={() => { setEditingName(false); setName(displayName); }} className="vow-btn-ghost">Cancel</button></div>{nameMessage && <p className="text-xs text-vow-muted mt-2">{nameMessage}</p>}</div>}</div>
        <div className="p-5"><p className="text-sm text-vow-ink">Account email</p><p className="text-xs text-vow-muted mt-1 break-words">{session?.user?.email || 'Not provided'}</p></div>
        <button onClick={() => setConfirmSignOut(true)} className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-vow-surface/40 transition-colors"><div><p className="text-sm text-vow-ink">Sign out</p><p className="text-xs text-vow-muted mt-1">Sign out of this VOW account.</p></div><span className="text-lg leading-none text-vow-muted">›</span></button>
        <button onClick={() => { setDeleteError(''); setConfirmDelete(true); }} className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-vow-surface/40 transition-colors"><div><p className="text-sm text-vow-ink">Delete account</p><p className="text-xs text-vow-muted mt-1">Permanently delete your VOW account and associated account data.</p></div><span className="text-lg leading-none text-vow-muted">›</span></button>
      </div>
      {confirmDelete && <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="delete-account-title"><div className="bg-vow-bg border border-vow-border p-6 max-w-sm w-full"><h2 id="delete-account-title" className="vow-heading text-xl text-vow-ink mb-2">Delete your VOW account?</h2><p className="text-sm text-vow-muted leading-relaxed mb-6">This is permanent. Your VOW account will be deleted and you will be signed out. This action cannot be undone.</p>{deleteError && <p role="alert" className="text-xs text-vow-ink mb-4 border-l-2 border-vow-ink pl-3">{deleteError}</p>}<div className="flex gap-3"><button onClick={() => setConfirmDelete(false)} disabled={deleting} className="vow-btn-ghost flex-1">Keep account</button><button onClick={() => void handleDeleteAccount()} disabled={deleting} className="vow-btn-primary flex-1">{deleting ? 'Deleting…' : 'Delete account'}</button></div></div></div>}
      {confirmSignOut && <div className="fixed inset-0 bg-black/20 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true"><div className="bg-vow-bg border border-vow-border p-6 max-w-sm w-full"><h2 className="vow-heading text-lg text-vow-ink mb-2">Are you sure you want to sign out?</h2><p className="text-sm text-vow-muted leading-relaxed mb-6">You can sign back in whenever you are ready.</p><div className="flex gap-3"><button onClick={() => setConfirmSignOut(false)} className="vow-btn-ghost flex-1">Cancel</button><button onClick={handleSignOut} className="vow-btn-primary flex-1">Sign out</button></div></div></div>}
    </div>
  );
}


function LanguagePage({ language, saving, message, onChange, onBack }: { language: string; saving: boolean; message: string; onChange: (language: string) => void; onBack: () => void }) {
  return <div><button onClick={onBack} className="text-sm text-vow-muted hover:text-vow-ink mb-6">← Back to profile</button><PageHeader title="Language" subtitle="VOW can adapt its coaching language to you." /><section className="border border-vow-border p-5"><div className="mb-5"><p className="vow-label mb-1">App language</p><p className="text-xs text-vow-muted">Languages are shown with a representative flag. A language is not limited to one country.</p></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{VOW_LANGUAGES.map((item) => <button key={item.code} disabled={saving} onClick={() => onChange(item.code)} aria-pressed={language === item.code} className={`flex items-center gap-3 border p-3 text-left transition-colors ${language === item.code ? 'border-vow-ink bg-vow-surface/60' : 'border-vow-border hover:border-vow-muted'}`}><span className="text-xl" aria-hidden="true">{item.flag}</span><span><span className="block text-sm text-vow-ink">{item.nativeName}</span><span className="block text-[11px] text-vow-muted">{item.name}</span></span>{language === item.code && <span className="ml-auto text-xs text-vow-ink">✓</span>}</button>)}</div>{message && <p className="text-xs text-vow-muted mt-4" role="status">{message}</p>}</section></div>;
}

function CustomisePage({ premium, selectedIcon, customBackground, customForeground, message, onIconChange, onCustomIconChange, onBack, onUpgrade }: {
  premium: boolean;
  selectedIcon: IconColour;
  customBackground: string;
  customForeground: string;
  message: string;
  onIconChange: (colour: IconColour) => void;
  onCustomIconChange: (background: string, foreground: string) => void;
  onBack: () => void;
  onUpgrade?: () => void;
}) {
  if (!premium) return <div><button onClick={onBack} className="text-sm text-vow-muted hover:text-vow-ink mb-6">← Back to profile</button><PageHeader title="Customise" subtitle="Custom app icons are a Premium feature." /><div className="border border-vow-border p-6"><p className="text-sm text-vow-ink mb-2">VOW icon customisation</p><p className="text-sm text-vow-muted leading-relaxed mb-5">Choose a preset or create your own launcher icon after upgrading to VOW Premium.</p><button onClick={onUpgrade} className="vow-btn-primary">View Premium</button></div></div>;

  const customActive = Boolean(localStorage.getItem('vow:custom-icon'));
  return <div>
    <button onClick={onBack} className="text-sm text-vow-muted hover:text-vow-ink mb-6">← Back to profile</button>
    <PageHeader title="Customise" subtitle="Make VOW feel like yours." />
    <section className="border border-vow-border p-5">
      <div className="mb-5"><p className="vow-label mb-1">App icon</p><p className="text-xs text-vow-muted">Pick a preset, or create your own colour combination.</p></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ICON_OPTIONS.map((option) => <button key={option.value} onClick={() => onIconChange(option.value)} aria-pressed={selectedIcon === option.value && !customActive} className={`border p-3 transition-colors ${selectedIcon === option.value && !customActive ? 'border-vow-ink bg-vow-surface/60' : 'border-vow-border hover:border-vow-muted'}`}><span className="mx-auto w-16 h-16 rounded-xl flex items-center justify-center" style={{ background: option.background }}><span style={{ color: option.foreground, fontSize: 54, lineHeight: 0.8, fontWeight: 800, fontFamily: 'Arial, sans-serif' }}>&gt;</span></span><span className="block text-xs text-vow-ink mt-3">{option.label}</span></button>)}
      </div>
      <div className={`border-t border-vow-border mt-6 pt-6 ${customActive ? 'border-vow-ink' : ''}`}>
        <div className="flex items-start justify-between gap-4 mb-4"><div><p className="vow-label mb-1">Customise icon</p><p className="text-xs text-vow-muted">Choose the background and VOW logo colours independently.</p></div><span className="text-[10px] border border-vow-border px-2 py-1 text-vow-muted">PREMIUM</span></div>
        <div className="flex flex-col sm:flex-row gap-5">
          <div className="shrink-0"><p className="text-xs text-vow-muted mb-2">Live preview</p><span className="w-28 h-28 rounded-2xl flex items-center justify-center border border-vow-border" style={{ background: customBackground }}><span style={{ color: customForeground, fontSize: 92, lineHeight: 0.8, fontWeight: 800, fontFamily: 'Arial, sans-serif' }}>&gt;</span></span></div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-xs text-vow-muted">Background colour<input aria-label="Icon background colour" type="color" value={customBackground} onChange={(e) => void onCustomIconChange(e.target.value, customForeground)} className="mt-2 block w-full h-12 border border-vow-border bg-transparent cursor-pointer" /></label>
            <label className="text-xs text-vow-muted">VOW logo colour<input aria-label="VOW logo colour" type="color" value={customForeground} onChange={(e) => void onCustomIconChange(customBackground, e.target.value)} className="mt-2 block w-full h-12 border border-vow-border bg-transparent cursor-pointer" /></label>
          </div>
        </div>
        {message && <p className="text-xs text-vow-muted mt-4" role="status">{message}</p>}
      </div>
    </section>
  </div>;
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
