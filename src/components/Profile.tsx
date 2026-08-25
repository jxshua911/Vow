import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from './AppShell';
import { getNotificationPermission, requestNotificationPermission, scheduleTestNotification } from '@/lib/notifications';

export function ProfilePage({ onLegal }: { onLegal?: () => void }) {
  const { data: session } = { data: null as any };
  const [notificationStatus, setNotificationStatus] = useState<string>('checking');
  const [requesting, setRequesting] = useState(false);
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    getNotificationPermission().then(setNotificationStatus);
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user?.email || ''));
  }, []);

  async function handleEnableNotifications() {
    setRequesting(true);
    const status = await requestNotificationPermission();
    setNotificationStatus(status);
    setRequesting(false);
  }

  async function handleTestNotification() {
    setRequesting(true);
    await scheduleTestNotification();
    setRequesting(false);
  }

  async function handleSignOut() { await supabase.auth.signOut(); }
  const notificationsEnabled = notificationStatus === 'granted';

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your account and preferences." />
      <div className="space-y-6">
        <div className="border border-vow-border p-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 border border-vow-border flex items-center justify-center text-lg" aria-hidden="true">○</div>
            <div className="min-w-0"><p className="text-xs text-vow-muted uppercase tracking-wide mb-1">Account</p><p className="text-sm text-vow-ink truncate">{email}</p></div>
          </div>
        </div>
        <div className="border border-vow-border p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 border border-vow-border flex items-center justify-center text-lg" aria-hidden="true">⌁</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2"><h2 className="text-sm font-medium text-vow-ink">Notifications</h2>{notificationsEnabled && <span className="text-xs text-vow-ink">Enabled</span>}</div>
              <p className="text-xs text-vow-muted mt-1 leading-relaxed">VOW can remind you about goals, planned sessions and reviews. Permission is requested only when you choose to enable it.</p>
              <p className="text-[10px] text-vow-muted mt-2 capitalize">Status: {notificationStatus}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {!notificationsEnabled && notificationStatus !== 'unsupported' && <button onClick={handleEnableNotifications} disabled={requesting} className="border border-vow-ink px-3 py-2 text-xs text-vow-ink disabled:opacity-50">{requesting ? 'Requesting…' : 'Enable notifications'}</button>}
                {notificationsEnabled && <button onClick={handleTestNotification} disabled={requesting} className="border border-vow-border px-3 py-2 text-xs text-vow-muted hover:text-vow-ink hover:border-vow-ink disabled:opacity-50">{requesting ? 'Sending…' : 'Send test notification'}</button>}
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
