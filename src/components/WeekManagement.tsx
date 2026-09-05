import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Goal, Session } from '@/types/database';
import { formatDate, formatTime, weekRange, toDateString } from '@/lib/dates';

export function WeekManagement() {
  const { session } = useAuth();
  const [draftGoals, setDraftGoals] = useState<Goal[]>([]);
  const [editableSessions, setEditableSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { start, end } = weekRange();

  const load = useCallback(async () => {
    if (!session) return;
    const startKey = toDateString(start);
    const endKey = toDateString(end);
    const [goalsRes, sessionsRes] = await Promise.all([
      supabase.from('goals').select('*').eq('user_id', session.user.id).eq('status', 'draft').order('created_at', { ascending: false }),
      supabase.from('sessions').select('*').eq('user_id', session.user.id).in('status', ['scheduled', 'moved', 'skipped']).gte('scheduled_at', `${startKey}T00:00:00`).lte('scheduled_at', `${endKey}T23:59:59`).order('scheduled_at', { ascending: true }),
    ]);
    setDraftGoals((goalsRes.data || []) as Goal[]);
    setEditableSessions((sessionsRes.data || []) as Session[]);
    setLoading(false);
  }, [session, start, end]);

  useEffect(() => { load(); }, [load]);

  async function deleteDraftGoal(goal: Goal) {
    if (!session) return;
    if (!confirm(`Delete “${goal.outcome}”? This permanently removes the draft goal and anything attached to it.`)) return;
    setDeleting(`goal:${goal.id}`);
    const { error } = await supabase.from('goals').delete().eq('id', goal.id).eq('user_id', session.user.id).eq('status', 'draft');
    if (!error) setDraftGoals((items) => items.filter((item) => item.id !== goal.id));
    setDeleting(null);
  }

  async function deleteSession(item: Session) {
    if (!session) return;
    if (!confirm(`Delete “${item.title}” from this week? This removes the scheduled session.`)) return;
    setDeleting(`session:${item.id}`);
    const { error } = await supabase.from('sessions').delete().eq('id', item.id).eq('user_id', session.user.id).in('status', ['scheduled', 'moved', 'skipped']);
    if (!error) {
      setEditableSessions((items) => items.filter((current) => current.id !== item.id));
      await supabase.from('goal_plan_items').delete().eq('goal_id', item.goal_id).eq('user_id', session.user.id).eq('scheduled_at', item.scheduled_at);
    }
    setDeleting(null);
  }

  if (loading || (!draftGoals.length && !editableSessions.length)) return null;

  return (
    <section className="mt-10 pt-8 border-t border-vow-border">
      <div className="mb-5">
        <p className="vow-label">Edit this week</p>
        <p className="text-xs text-vow-muted mt-1 leading-relaxed">Remove draft goals or scheduled sessions you no longer want.</p>
      </div>
      <div className="space-y-6">
        {draftGoals.length > 0 && <div><p className="text-xs font-medium text-vow-ink mb-3">Draft goals</p><div className="border-t border-vow-border">{draftGoals.map((goal) => <div key={goal.id} className="py-4 border-b border-vow-border flex items-center gap-4"><div className="min-w-0 flex-1"><p className="text-sm text-vow-ink break-words">{goal.outcome}</p><p className="text-[10px] text-vow-muted mt-1">Draft</p></div><button onClick={() => deleteDraftGoal(goal)} disabled={deleting === `goal:${goal.id}`} className="vow-btn-ghost min-h-11 shrink-0 text-xs">{deleting === `goal:${goal.id}` ? 'Deleting…' : 'Delete'}</button></div>)}</div></div>}
        {editableSessions.length > 0 && <div><p className="text-xs font-medium text-vow-ink mb-3">Sessions you can remove</p><div className="border-t border-vow-border">{editableSessions.map((item) => <div key={item.id} className="py-4 border-b border-vow-border flex items-center gap-4"><div className="min-w-0 flex-1"><p className="text-sm text-vow-ink break-words">{item.title}</p><p className="text-xs text-vow-muted mt-1">{formatDate(item.scheduled_at)} · {formatTime(item.scheduled_at)} · {item.status}</p></div><button onClick={() => deleteSession(item)} disabled={deleting === `session:${item.id}`} className="vow-btn-ghost min-h-11 shrink-0 text-xs">{deleting === `session:${item.id}` ? 'Deleting…' : 'Delete'}</button></div>)}</div></div>}
      </div>
    </section>
  );
}
