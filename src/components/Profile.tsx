import { useEffect, useState } from 'react';
import { ArrowRight, Check, LogOut, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { UserSettings } from '@/types/database';
import { PageHeader } from './AppShell';

export function ProfilePage() {
  const { session } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle().then(({ data }) => {
      setSettings(data as UserSettings | null);
      setLoading(false);
    });
  }, [session]);

  async function save() {
    if (!session || !settings) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    const { data, error: saveError } = await supabase
      .from('user_settings')
      .upsert({ ...settings, user_id: session.user.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select()
      .single();
    if (saveError) setError(saveError.message);
    else setSettings(data as UserSettings);
    setSaving(false);
    setSaved(!saveError);
    window.setTimeout(() => setSaved(false), 1800);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (loading) return <ProfileSkeleton />;

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your account and coaching preferences." />

      <div className="max-w-xl space-y-10">
        <section className="border-t border-vow-border pt-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 border border-vow-border flex items-center justify-center">
              <UserRound className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="vow-label">Account</p>
              <p className="text-sm text-vow-ink truncate">{session?.user.email}</p>
            </div>
          </div>
        </section>

        {settings && (
          <section className="space-y-6">
            <div>
              <label className="vow-label block mb-2">Timezone</label>
              <input className="vow-input" value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} />
            </div>
            <div>
              <label className="vow-label block mb-2">Preferred session times</label>
              <input className="vow-input" value={settings.preferred_session_times ?? ''} onChange={(e) => setSettings({ ...settings, preferred_session_times: e.target.value || null })} placeholder="e.g. mornings" />
            </div>
            <div>
              <label className="vow-label block mb-2">Notification frequency</label>
              <select className="vow-input" value={settings.notification_frequency} onChange={(e) => setSettings({ ...settings, notification_frequency: e.target.value })}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
            <div>
              <label className="vow-label block mb-2">Coaching tone</label>
              <select className="vow-input" value={settings.coaching_tone} onChange={(e) => setSettings({ ...settings, coaching_tone: e.target.value })}>
                <option value="direct">Direct</option>
                <option value="balanced">Balanced</option>
                <option value="gentle">Gentle</option>
              </select>
            </div>
          </section>
        )}

        {error && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">{error}</p>}

        <div className="flex flex-wrap gap-3 pt-2">
          <button onClick={save} disabled={saving || !settings} className="vow-btn-primary">
            {saved ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save changes'}
          </button>
          <button onClick={signOut} className="vow-btn-ghost">
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-8 max-w-xl">
      <div className="border-b border-vow-border pb-6 space-y-3">
        <div className="h-8 w-32 bg-vow-border/60" />
        <div className="h-4 w-64 bg-vow-border/40" />
      </div>
      <div className="h-16 bg-vow-border/30" />
      <div className="h-12 bg-vow-border/30" />
      <div className="h-12 bg-vow-border/30" />
    </div>
  );
}
