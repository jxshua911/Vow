import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from './AppShell';
import { getNotificationPermission, requestNotificationPermission } from '@/lib/notifications';

function getDisplayName(session: ReturnType<typeof useAuth>['session']) {
  const metadata = session?.user?.user_metadata as Record<string, unknown> | undefined;
  const fullName = typeof metadata?.full_name === 'string' ? metadata.full_name : typeof metadata?.name === 'string' ? metadata.name : '';
  if (fullName.trim()) return fullName.trim();
  const emailName = session?.user?.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  return emailName || '';
}

export function ProfilePage({ onLegal }: { onLegal?: () => void }) {
  const { session } = useAuth();
  const [notificationStatus, setNotificationStatus] = useState<string>('checking');
  const [requesting, setRequesting] = useState(false);
  const [name, setName] = useState(() => getDisplayName(session));
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState('');

  useEffect(() => { getNotificationPermission().then(setNotificationStatus); }, []);
  useEffect(() => { setName(getDisplayName(session)); }, [session]);

  async function handleEnableNotifications() {
    setRequesting(true);
    const status = await requestNotificationPermission();
    setNotificationStatus(status);
    setRequesting(false);
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

  return (
    <div>
      <PageHeader title={`Welcome back, ${name || 'there'}`} subtitle="Your account and preferences." />
      <div className="space-y-6">
        <div className="border border-vow-border p-5 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 border border-vow-border flex items-center justify-center text-lg" aria-hidden="true">○</div>
            <div className="min-w-0"><p className="text-xs text-vow-muted uppercase tracking-wide mb-1">Account email</p><p className="text-sm text-vow-ink truncate">{session?.user?.email}</p></div>
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
        <div className="border border-vow-border p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 border border-vow-border flex items-center justify-center text-lg" aria-hidden="true">⌁</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2"><h2 className="text-sm font-medium text-vow-ink">Notifications</h2>{notificationsEnabled && <span className="text-xs text-vow-ink">Enabled</span>}</div>
              <p className="text-xs text-vow-muted mt-1 leading-relaxed">VOW reminders use your device's notification system. When enabled, supported reminders can use sound and vibration according to your device settings.</p>
              <p className="text-[10px] text-vow-muted mt-2 capitalize">Status: {notificationStatus}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {!notificationsEnabled && notificationStatus !== 'unsupported' && <button onClick={handleEnableNotifications} disabled={requesting} className="border border-vow-ink px-3 py-2 text-xs text-vow-ink disabled:opacity-50">{requesting ? 'Requesting…' : 'Enable notifications'}</button>}
                {notificationsEnabled && <span className="border border-vow-border px-3 py-2 text-xs text-vow-muted">Sound + vibration enabled</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="border border-vow-border divide-y divide-vow-border">
          <button onClick={onLegal} className="w-full text-left p-5 text-sm text-vow-ink hover:bg-vow-border/20 transition-colors">Terms & Policies<span className="block text-xs text-vow-muted mt-1">Privacy, connected services, security and service terms.</span></button>
        </div>
        <button onClick={handleSignOut} className="w-full flex items-center justify-center gap-2 border border-vow-border py-3 text-sm text-vow-muted hover:text-vow-ink hover:border-vow-ink transition-colors"><span aria-hidden="true">↪</span>Sign out</button>
      </div>
    </div>
  );
}
