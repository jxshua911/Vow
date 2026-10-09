import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Goal } from '@/types/database';
import { syncUserUpcomingSessionNotifications } from '@/lib/notifications';

export function GoalHistoryActions() {
  const { session } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from('goals').select('*').eq('user_id', session.user.id).in('status', ['completed','abandoned']).order('created_at', { ascending: false });
    setGoals((data || []) as Goal[]);
    setLoading(false);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function deleteGoal(goal: Goal) {
    if (!confirm(`Delete “${goal.outcome}”? This permanently removes the goal and its dependent milestones and sessions.`)) return;
    setDeleting(goal.id);
    const { error: deleteError } = await supabase.from('goals').delete().eq('id', goal.id).eq('user_id', session!.user.id);
    if (deleteError) {
      setError(`Could not delete "${goal.outcome}". ${deleteError.message}`.trim());
    } else {
      setGoals((current) => current.filter((item) => item.id !== goal.id));
      setError(null);
      try {
        await syncUserUpcomingSessionNotifications(session!.user.id);
      } catch (syncError) {
        console.warn('[VOW] Notification sync after goal deletion failed:', syncError);
      }
    }
    setDeleting(null);
  }

  if (loading || goals.length === 0) return null;

  return (
    <section className="mt-12 border-t border-vow-border pt-8">
      <h2 className="vow-label mb-2">Goal history</h2>
      <p className="text-xs text-vow-muted mb-4">Completed and abandoned goals stay here until you choose to permanently delete them.</p>
      {error && <p className="text-sm text-vow-ink leading-relaxed border-l-2 border-vow-ink pl-3 mb-4">{error}</p>}
      <div className="border-t border-vow-border">
        {goals.map((goal) => (
          <div key={goal.id} className="border-b border-vow-border py-4 flex items-center gap-4">
            <div className="min-w-0 flex-1"><p className="text-sm text-vow-ink truncate">{goal.outcome}</p><p className="text-[10px] text-vow-muted mt-1 capitalize">{goal.status}</p></div>
            <button onClick={() => deleteGoal(goal)} disabled={deleting === goal.id} className="text-xs text-vow-muted hover:text-vow-ink disabled:opacity-50">{deleting === goal.id ? 'Deleting…' : 'Delete'}</button>
          </div>
        ))}
      </div>
    </section>
  );
}
