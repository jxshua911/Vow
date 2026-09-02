import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Goal, Milestone, Session, GoalStatus } from '@/types/database';
import { addDays, formatTime, formatDate, formatRelative } from '@/lib/dates';
import { PageHeader, NewButton } from './AppShell';
import { GoalPlanner } from './GoalPlanner';
import { GoalReferenceList } from './GoalReferenceList';
import { Plus, Check, Circle, CheckCircle2, SkipForward, Move, Pause, ChevronDown, ArrowLeft, Calendar, Clock } from 'lucide-react';

export function GoalsPage() {
  const { session } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const loadGoals = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from('goals').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    setGoals(data || []); setLoading(false);
  }, [session]);
  useEffect(() => { loadGoals(); }, [loadGoals]);

  if (selectedGoalId) return <GoalDetail goalId={selectedGoalId} onBack={() => { setSelectedGoalId(null); loadGoals(); }} />;
  if (showCreate) return <GoalPlanner userId={session!.user.id} onCreated={() => { setShowCreate(false); loadGoals(); }} onCancel={() => setShowCreate(false)} />;

  const activeGoals = goals.filter((g) => g.status === 'active' || g.status === 'locked');
  const draftGoals = goals.filter((g) => g.status === 'draft');
  const completedGoals = goals.filter((g) => g.status === 'completed' || g.status === 'abandoned');
  const goalCtaLabel = goals.length > 0 ? 'New Goal' : 'Create Goal';
  return <div>
    <PageHeader title="Goals" subtitle="Lock in commitments. Track honestly. Adjust when the plan is wrong." action={<NewButton onClick={() => setShowCreate(true)} label={goalCtaLabel} />} />
    {loading ? <div className="text-vow-muted text-sm">Loading...</div> : goals.length === 0 ? <div className="border border-vow-border p-16 text-center"><p className="vow-heading text-xl text-vow-ink mb-2">No goals yet</p><p className="text-vow-muted text-sm">Create your first commitment and let VOW map the work into your calendar.</p></div> : <div className="space-y-12">{activeGoals.length > 0 && <GoalSection title="Active" goals={activeGoals} onSelect={setSelectedGoalId} />}{draftGoals.length > 0 && <GoalSection title="Drafts" goals={draftGoals} onSelect={setSelectedGoalId} />}{completedGoals.length > 0 && <GoalSection title="Completed & Abandoned" goals={completedGoals} onSelect={setSelectedGoalId} />}</div>}
  </div>;
}

function GoalSection({ title, goals, onSelect }: { title: string; goals: Goal[]; onSelect: (id: string) => void }) {
  const statusColors: Record<GoalStatus, string> = { draft: 'text-vow-muted', locked: 'text-vow-ink', active: 'text-vow-ink', completed: 'text-vow-success', abandoned: 'text-vow-muted line-through' };
  return <div><h2 className="vow-label mb-4">{title}</h2><div className="border-t border-vow-border">{goals.map((g) => <button key={g.id} onClick={() => onSelect(g.id)} className="w-full text-left border-b border-vow-border py-5 group flex items-start justify-between gap-4 hover:bg-vow-surface/30 transition-colors"><div className="flex-1 min-w-0"><div className={`text-base font-medium mb-1 ${statusColors[g.status]}`}>{g.outcome}</div>{g.why_it_matters && <div className="text-xs text-vow-muted italic mb-2">"{g.why_it_matters}"</div>}<div className="flex items-center gap-4 text-xs text-vow-muted"><span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{g.deadline ? formatRelative(g.deadline) : 'No deadline'}</span><span className="flex items-center gap-1"><Clock className="w-3 h-3" />{g.weekly_commitment_target}x/week</span></div></div><ArrowLeft className="w-4 h-4 text-vow-border rotate-180 mt-1 group-hover:text-vow-ink transition-colors" /></button>)}</div></div>;
}

function GoalDetail({ goalId, onBack }: { goalId: string; onBack: () => void }) {
  const { session } = useAuth();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSession, setShowAddSession] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [goalRes, msRes, sessRes] = await Promise.all([
      supabase.from('goals').select('*').eq('id', goalId).maybeSingle(),
      supabase.from('milestones').select('*').eq('goal_id', goalId).order('sort_order'),
      supabase.from('sessions').select('*').eq('goal_id', goalId).order('scheduled_at', { ascending: true }),
    ]);
    setGoal(goalRes.data as Goal | null); setMilestones(msRes.data || []); setSessions(sessRes.data || []); setLoading(false);
  }, [goalId]);
  useEffect(() => { load(); }, [load]);
  async function updateSessionStatus(sessId: string, status: Session['status']) { const updates: Partial<Session> = { status, updated_at: new Date().toISOString() }; if (status === 'completed') updates.completed_at = new Date().toISOString(); await supabase.from('sessions').update(updates).eq('id', sessId); load(); }
  async function moveSession(sess: Session) { const newDate = addDays(new Date(sess.scheduled_at), 1); await supabase.from('sessions').update({ scheduled_at: newDate.toISOString(), moved_count: sess.moved_count + 1, status: 'moved', updated_at: new Date().toISOString() }).eq('id', sess.id); load(); }
  async function toggleMilestoneStatus(ms: Milestone) { const newStatus = ms.status === 'completed' ? 'pending' : 'completed'; await supabase.from('milestones').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', ms.id); load(); }
  async function abandonGoal() { if (!confirm('Mark this goal as abandoned? This records the outcome so VOW can learn from the pattern.')) return; await supabase.from('goals').update({ status: 'abandoned', updated_at: new Date().toISOString() }).eq('id', goalId); onBack(); }
  async function completeGoal() { await supabase.from('goals').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', goalId); onBack(); }
  async function handlePause(context: string) { if (!session) return; await supabase.from('user_settings').upsert({ user_id: session.user.id, pause_context: context || null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }); setShowPauseModal(false); }
  if (loading) return <div className="text-vow-muted text-sm">Loading...</div>;
  if (!goal) return <div className="text-vow-muted text-sm">Goal not found.</div>;
  const completedSessions = sessions.filter((s) => s.status === 'completed').length;
  const totalSessions = sessions.length;
  const pct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  const movedCount = sessions.filter((s) => s.moved_count > 0).reduce((sum, s) => sum + s.moved_count, 0);
  const statusIcons: Record<string, typeof CheckCircle2> = { completed: CheckCircle2, scheduled: Circle, skipped: SkipForward, moved: Move };
  return <div>
    <button onClick={onBack} className="text-sm text-vow-muted hover:text-vow-ink mb-6 flex items-center gap-1 transition-colors"><ArrowLeft className="w-4 h-4" />Back to goals</button>
    <div className="border-t border-vow-border pt-8 mb-8"><div className="flex items-start justify-between gap-4 mb-4"><h1 className="vow-heading text-2xl text-vow-ink">{goal.outcome}</h1><span className="text-xs uppercase tracking-wide text-vow-muted">{goal.status}</span></div>{goal.why_it_matters && <p className="text-sm text-vow-muted italic mb-6">"{goal.why_it_matters}"</p>}<div className="grid grid-cols-3 gap-4 border-t border-vow-border pt-4"><div><p className="vow-label">Progress</p><p className="text-lg text-vow-ink mt-1">{pct}%</p></div><div><p className="vow-label">Sessions</p><p className="text-lg text-vow-ink mt-1">{completedSessions}/{totalSessions}</p></div><div><p className="vow-label">Moved</p><p className="text-lg text-vow-ink mt-1">{movedCount}</p></div></div></div>
    <GoalReferenceList goalId={goalId} />
    <div className="mb-10"><div className="flex items-center justify-between mb-4"><h2 className="vow-label">Milestones</h2><button onClick={() => setExpandedMilestone(expandedMilestone ? null : milestones[0]?.id || null)} className="vow-btn-soft text-xs">{expandedMilestone ? 'Collapse' : 'Expand'}</button></div><div className="border-t border-vow-border">{milestones.map((ms) => { const Icon = ms.status === 'completed' ? CheckCircle2 : Circle; return <div key={ms.id} className="border-b border-vow-border py-4"><button className="w-full text-left flex items-start gap-3" onClick={() => setExpandedMilestone(expandedMilestone === ms.id ? null : ms.id)}><Icon className="w-4 h-4 mt-0.5" /><div className="flex-1"><p className="text-sm text-vow-ink">{ms.title}</p><p className="text-xs text-vow-muted mt-1">{formatDate(ms.deadline)}</p>{expandedMilestone === ms.id && <p className="text-xs text-vow-muted mt-2">{ms.description}</p>}</div><ChevronDown className={`w-4 h-4 transition-transform ${expandedMilestone === ms.id ? 'rotate-180' : ''}`} /></button><button onClick={() => toggleMilestoneStatus(ms)} className="vow-btn-soft text-xs ml-7 mt-2">{ms.status === 'completed' ? 'Mark pending' : 'Mark completed'}</button></div>; })}</div></div>
    <div className="mb-10"><div className="flex items-center justify-between mb-4"><h2 className="vow-label">Sessions & routine</h2><button onClick={() => setShowAddSession(!showAddSession)} className="vow-btn-ghost"><Plus className="w-4 h-4" />Add session</button></div><div className="border-t border-vow-border">{sessions.map((sess) => { const Icon = statusIcons[sess.status] || Circle; return <div key={sess.id} className="border-b border-vow-border py-4 flex items-center gap-4"><Icon className="w-4 h-4 text-vow-muted" /><div className="flex-1"><p className="text-sm text-vow-ink">{sess.title}</p><p className="text-xs text-vow-muted mt-1">{formatDate(sess.scheduled_at)} · {formatTime(sess.scheduled_at)} · {sess.duration_minutes} min</p></div>{sess.status === 'scheduled' && <div className="flex gap-2"><button onClick={() => updateSessionStatus(sess.id, 'completed')} className="vow-btn-soft text-xs">Complete</button><button onClick={() => updateSessionStatus(sess.id, 'skipped')} className="vow-btn-soft text-xs">Skip</button><button onClick={() => moveSession(sess)} className="vow-btn-soft text-xs">Move</button></div>}</div>; })}</div></div>
    {showAddSession && <div className="border border-vow-border p-5 mb-8"><p className="text-sm text-vow-ink mb-2">Add session</p><p className="text-xs text-vow-muted">New commitments are generated through the goal routine so the calendar stays coherent. Manual session creation can be added from the planner.</p><button onClick={() => setShowAddSession(false)} className="vow-btn-ghost mt-4">Close</button></div>}
    <div className="border-t border-vow-border pt-6 mt-10 flex flex-wrap gap-3"><button onClick={completeGoal} className="vow-btn-primary"><Check className="w-4 h-4" />Complete goal</button><button onClick={() => setShowPauseModal(true)} className="vow-btn-ghost"><Pause className="w-4 h-4" />Pause</button><button onClick={abandonGoal} className="vow-btn-ghost">Abandon</button></div>
    {showPauseModal && <div className="fixed inset-0 bg-black/20 flex items-center justify-center p-4 z-50"><div className="bg-vow-bg border border-vow-border p-6 max-w-md w-full"><h2 className="vow-heading text-lg text-vow-ink mb-2">Pause goal</h2><p className="text-sm text-vow-muted mb-4">Why are you pausing?</p><div className="space-y-2">{['Schedule changed','Need to adjust the plan','Taking a short break'].map((reason) => <button key={reason} onClick={() => handlePause(reason)} className="w-full text-left border border-vow-border px-4 py-3 text-sm hover:bg-vow-surface">{reason}</button>)}</div><button onClick={() => setShowPauseModal(false)} className="vow-btn-ghost mt-4">Cancel</button></div></div>}
  </div>;
}
