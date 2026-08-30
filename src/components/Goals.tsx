import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Goal, Milestone, Session, GoalStatus } from '@/types/database';
import { decomposeGoal, type DecomposedGoal } from '@/lib/decompose';
import { addDays, toDateString, formatTime, formatDate, formatRelative } from '@/lib/dates';
import { syncUpcomingSessionNotifications } from '@/lib/notifications';
import { PageHeader, NewButton } from './AppShell';
import { Lock, Plus, Check, Circle, CheckCircle2, SkipForward, Move, Pause, ChevronDown, ArrowLeft, Calendar, Clock } from 'lucide-react';

const GOAL_DURATIONS = [
  { value: '1w', label: '1 week' },
  { value: '2w', label: '2 weeks' },
  { value: '3w', label: '3 weeks' },
  { value: '1m', label: '1 month' },
  { value: '2m', label: '2 months' },
] as const;
type GoalDuration = (typeof GOAL_DURATIONS)[number]['value'];

function durationDeadline(start: Date, value: GoalDuration) {
  const deadline = new Date(start);
  if (value === '1w') deadline.setDate(deadline.getDate() + 7);
  else if (value === '2w') deadline.setDate(deadline.getDate() + 14);
  else if (value === '3w') deadline.setDate(deadline.getDate() + 21);
  else deadline.setMonth(deadline.getMonth() + (value === '1m' ? 1 : 2));
  deadline.setHours(23, 59, 59, 999);
  return deadline;
}

function durationLabel(value: GoalDuration) {
  return GOAL_DURATIONS.find((duration) => duration.value === value)?.label ?? '1 month';
}

export function GoalsPage() {
  const { session } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const loadGoals = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase.from('goals').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    setGoals(data || []);
    setLoading(false);
  }, [session]);
  useEffect(() => { loadGoals(); }, [loadGoals]);

  if (selectedGoalId) return <GoalDetail goalId={selectedGoalId} onBack={() => { setSelectedGoalId(null); loadGoals(); }} />;
  if (showCreate) return <CreateGoal userId={session!.user.id} onCreated={() => { setShowCreate(false); loadGoals(); }} onCancel={() => setShowCreate(false)} />;

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
  return <div><h2 className="vow-label mb-4">{title}</h2><div className="border-t border-vow-border">{goals.map((g) => <button key={g.id} onClick={() => onSelect(g.id)} className="w-full text-left border-b border-vow-border py-5 group flex items-start justify-between gap-4 hover:opacity-70 transition-opacity"><div className="flex-1 min-w-0"><div className={`text-base font-medium mb-1 ${statusColors[g.status]}`}>{g.outcome}</div>{g.why_it_matters && <div className="text-xs text-vow-muted italic mb-2">"{g.why_it_matters}"</div>}<div className="flex items-center gap-4 text-xs text-vow-muted"><span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{g.deadline ? formatRelative(g.deadline) : 'No deadline'}</span><span className="flex items-center gap-1"><Clock className="w-3 h-3" />{g.weekly_commitment_target}x/week</span></div></div><ArrowLeft className="w-4 h-4 text-vow-border rotate-180 mt-1 group-hover:text-vow-ink transition-colors" /></button>)}</div></div>;
}

function CreateGoal({ userId, onCreated, onCancel }: { userId: string; onCreated: () => void; onCancel: () => void }) {
  const [rawInput, setRawInput] = useState('');
  const [decomposed, setDecomposed] = useState<DecomposedGoal | null>(null);
  const [aiPlan, setAiPlan] = useState('');
  const [planning, setPlanning] = useState(false);
  const [whyItMatters, setWhyItMatters] = useState('');
  const [weeklyTarget, setWeeklyTarget] = useState(3);
  const [duration, setDuration] = useState<GoalDuration | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function preparePlan() {
    const input = rawInput.trim();
    if (!input || !duration || planning) return;
    setPlanning(true); setError(null); setAiPlan('');
    try {
      const { data, error: aiError } = await supabase.functions.invoke('vow-goal-ai', {
        body: { goal: { title: input, outcome: input, status: 'draft' }, message: `I am considering committing to this for ${durationLabel(duration)}: "${input}". Help me make this a strict SMART goal: Specific, Measurable, Achievable, Relevant, and Time-bound. Before I lock it in, explain what success should be measured by, what it will realistically take, what resources or habits it may require, what my week could look like, likely trade-offs, and what I should clarify before committing. Keep it practical and concise.`, scope: 'goal-commitment-planning' },
      });
      if (aiError) throw aiError;
      if (data?.error) throw new Error(data.error);
      setAiPlan(data?.text || 'VOW AI could not return an assessment, so the structured planner will continue without it.');
    } catch {
      setAiPlan('VOW AI is unavailable right now. The structured planner can still map the commitment into milestones and calendar sessions.');
    } finally {
      setDecomposed(decomposeGoal(input));
      setPlanning(false);
    }
  }

  async function handleCreate() {
    if (!decomposed) return;
    setSaving(true); setError(null);
    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (!duration) throw new Error('Choose a goal duration before locking it in.');
      const deadline = durationDeadline(now, duration);
      const totalDays = Math.max(1, Math.round((deadline.getTime() - now.getTime()) / 86400000));
      const deadlineStr = toDateString(deadline);
      const { data: goalData, error: goalErr } = await supabase.from('goals').insert({ user_id: userId, title: decomposed.outcome, outcome: decomposed.outcome, why_it_matters: whyItMatters || null, start_date: toDateString(now), duration, deadline: deadlineStr, status: 'active', weekly_commitment_target: weeklyTarget }).select().single();
      if (goalErr) throw goalErr;
      const milestoneCount = decomposed.milestones.length;
      const milestoneRows = decomposed.milestones.map((m, i) => {
        const milestoneDate = new Date(now.getTime() + (deadline.getTime() - now.getTime()) * ((i + 1) / milestoneCount));
        return { goal_id: goalData.id, title: m.title, description: m.description, sort_order: i, deadline: toDateString(milestoneDate), status: i === 0 ? 'in_progress' : 'pending' as const };
      });
      const { data: milestoneData, error: milestoneErr } = await supabase.from('milestones').insert(milestoneRows).select().order('sort_order');
      if (milestoneErr) throw milestoneErr;
      const weeks = Math.max(1, Math.min(52, Math.ceil(totalDays / 7)));
      const plannedStartMs = now.getTime();
      const dayOffsets = [1, 3, 5, 2, 4, 6, 0];
      const sessions: Array<Record<string, unknown>> = [];
      for (let week = 0; week < weeks; week += 1) {
        for (let slot = 0; slot < weeklyTarget; slot += 1) {
          const sessionDate = addDays(now, week * 7 + dayOffsets[slot % dayOffsets.length] + 1);
          sessionDate.setHours(9, 0, 0, 0);
          if (sessionDate > deadline) continue;
          const progress = Math.min(0.999, Math.max(0, (sessionDate.getTime() - plannedStartMs) / Math.max(1, deadline.getTime() - plannedStartMs)));
          const milestoneIndex = Math.min((milestoneData || []).length - 1, Math.floor(progress * (milestoneData || []).length));
          const milestone = (milestoneData || [])[Math.max(0, milestoneIndex)];
          sessions.push({ goal_id: goalData.id, milestone_id: milestone?.id ?? null, user_id: userId, title: milestone?.title || decomposed.outcome, scheduled_at: sessionDate.toISOString(), duration_minutes: decomposed.suggestedSessionDuration, status: 'scheduled' });
        }
      }
      const { data: createdSessions, error: sessionErr } = sessions.length ? await supabase.from('sessions').insert(sessions).select('*') : { data: [], error: null };
      if (sessionErr) throw sessionErr;
      if (createdSessions) await syncUpcomingSessionNotifications(createdSessions as Session[]);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create goal.');
    } finally { setSaving(false); }
  }

  return <div><PageHeader title="New Goal" subtitle="VOW will pressure-test the commitment, make it SMART, decompose the work, and place the resulting routine into your calendar." /><div className="max-w-2xl">
    {!decomposed ? <><div className="mb-5"><label className="vow-label block mb-2">Goal duration (required)</label><select value={duration} onChange={(e) => setDuration(e.target.value as GoalDuration)} className="vow-input"><option value="">Select duration</option><option value="1w">1 week</option><option value="2w">2 weeks</option><option value="3w">3 weeks</option><option value="1m">1 month</option><option value="2m">2 months</option></select></div><textarea value={rawInput} onChange={(e) => setRawInput(e.target.value)} rows={4} className="vow-input resize-none mb-4" placeholder="e.g. I want to get better at running" autoFocus /><div className="flex gap-3"><button onClick={onCancel} className="vow-btn-ghost">Cancel</button><button onClick={preparePlan} disabled={!rawInput.trim() || !duration || planning} className="vow-btn-primary flex-1">{planning ? 'Thinking it through…' : 'Plan with VOW AI'}</button></div></> : <>
      {aiPlan && <div className="border border-vow-border p-5 mb-6"><p className="vow-label mb-2">VOW AI assessment</p><p className="text-sm leading-relaxed whitespace-pre-wrap text-vow-ink">{aiPlan}</p></div>}
      <div className="border border-vow-border p-5 mb-6"><p className="vow-label mb-3">Strict SMART goal</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-vow-muted"><div><span className="text-vow-ink font-medium">Specific</span> — define the exact outcome.</div><div><span className="text-vow-ink font-medium">Measurable</span> — know what success looks like.</div><div><span className="text-vow-ink font-medium">Achievable</span> — match the commitment to your available time.</div><div><span className="text-vow-ink font-medium">Relevant</span> — connect it to why it matters.</div><div><span className="text-vow-ink font-medium">Time-bound</span> — choose a fixed completion window.</div></div></div>
      <div className="border-t border-vow-border pt-4 mb-6"><p className="vow-label mb-1">Outcome</p><p className="text-vow-ink font-medium">{decomposed.outcome}</p><p className="text-xs text-vow-muted mt-2">This commitment will become a calendar routine rather than a one-off task.</p></div>
      <div className="mb-6"><label className="vow-label block mb-2">Duration</label><select value={duration} onChange={(e) => setDuration(e.target.value as GoalDuration)} className="vow-input"><option value="1w">1 week</option><option value="2w">2 weeks</option><option value="3w">3 weeks</option><option value="1m">1 month</option><option value="2m">2 months</option></select><p className="text-xs text-vow-muted mt-2">Every goal must have a fixed time boundary. This sets the deadline and controls how VOW spreads milestones and calendar sessions.</p><p className="text-xs text-vow-ink mt-2">Deadline: {duration ? formatDate(toDateString(durationDeadline(new Date(), duration))) : 'Choose a duration'}</p></div>
      <div className="border-t border-vow-border pt-4 mb-6"><p className="vow-label mb-4">Milestones</p><div className="space-y-4">{decomposed.milestones.map((m, i) => <div key={i} className="flex gap-4"><span className="text-vow-muted text-sm font-mono pt-0.5">{String(i + 1).padStart(2, '0')}</span><div><p className="text-sm text-vow-ink font-medium">{m.title}</p><p className="text-xs text-vow-muted mt-1">{m.description}</p></div></div>)}</div></div>
      <div className="mb-6"><label className="vow-label block mb-2">Sessions per week</label><input type="number" min={1} max={14} value={weeklyTarget} onChange={(e) => setWeeklyTarget(Math.min(14, Math.max(1, parseInt(e.target.value, 10) || 1)))} className="vow-input" /><p className="text-xs text-vow-muted mt-2">VOW will spread these sessions across the selected duration and advance the calendar routine as milestones change.</p></div>
      <div className="mb-6"><label className="vow-label block mb-2">Why does this matter to you?</label><textarea value={whyItMatters} onChange={(e) => setWhyItMatters(e.target.value)} rows={2} className="vow-input resize-none" placeholder="Your coach will reference this when motivation dips." /></div>
      {error && <p className="text-sm text-vow-ink mb-4 border-l-2 border-vow-ink pl-3">{error}</p>}
      <div className="flex gap-3"><button onClick={() => { setDecomposed(null); setAiPlan(''); }} className="vow-btn-ghost">Back</button><button onClick={handleCreate} disabled={saving || !duration} className="vow-btn-primary flex-1"><Lock className="w-4 h-4" />{saving ? 'Building calendar…' : `Lock in ${durationLabel(duration)} goal`}</button></div>
    </>}</div></div>;
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
  const load = useCallback(async () => { const [goalRes, msRes, sessRes] = await Promise.all([supabase.from('goals').select('*').eq('id', goalId).maybeSingle(), supabase.from('milestones').select('*').eq('goal_id', goalId).order('sort_order'), supabase.from('sessions').select('*').eq('goal_id', goalId).order('scheduled_at', { ascending: true })]); setGoal(goalRes.data as Goal | null); setMilestones(msRes.data || []); setSessions(sessRes.data || []); setLoading(false); }, [goalId]);
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
    <div className="mb-10"><div className="flex items-center justify-between mb-4"><h2 className="vow-label">Milestones</h2><button onClick={() => setExpandedMilestone(expandedMilestone ? null : milestones[0]?.id || null)} className="text-xs text-vow-muted">{expandedMilestone ? 'Collapse' : 'Expand'}</button></div><div className="border-t border-vow-border">{milestones.map((ms) => { const Icon = ms.status === 'completed' ? CheckCircle2 : Circle; return <div key={ms.id} className="border-b border-vow-border py-4"><button className="w-full text-left flex items-start gap-3" onClick={() => setExpandedMilestone(expandedMilestone === ms.id ? null : ms.id)}><Icon className="w-4 h-4 mt-0.5" /><div className="flex-1"><p className="text-sm text-vow-ink">{ms.title}</p><p className="text-xs text-vow-muted mt-1">{formatDate(ms.deadline)}</p>{expandedMilestone === ms.id && <p className="text-xs text-vow-muted mt-2">{ms.description}</p>}</div><ChevronDown className={`w-4 h-4 transition-transform ${expandedMilestone === ms.id ? 'rotate-180' : ''}`} /></button><button onClick={() => toggleMilestoneStatus(ms)} className="text-xs text-vow-muted ml-7 mt-2">{ms.status === 'completed' ? 'Mark pending' : 'Mark completed'}</button></div>; })}</div></div>
    <div className="mb-10"><div className="flex items-center justify-between mb-4"><h2 className="vow-label">Sessions & routine</h2><button onClick={() => setShowAddSession(!showAddSession)} className="vow-btn-ghost"><Plus className="w-4 h-4" />Add session</button></div><div className="border-t border-vow-border">{sessions.map((sess) => { const Icon = statusIcons[sess.status] || Circle; return <div key={sess.id} className="border-b border-vow-border py-4 flex items-center gap-4"><Icon className="w-4 h-4 text-vow-muted" /><div className="flex-1"><p className="text-sm text-vow-ink">{sess.title}</p><p className="text-xs text-vow-muted mt-1">{formatDate(sess.scheduled_at)} · {formatTime(sess.scheduled_at)} · {sess.duration_minutes} min</p></div>{sess.status === 'scheduled' && <div className="flex gap-2"><button onClick={() => updateSessionStatus(sess.id, 'completed')} className="text-xs text-vow-muted hover:text-vow-ink">Complete</button><button onClick={() => updateSessionStatus(sess.id, 'skipped')} className="text-xs text-vow-muted hover:text-vow-ink">Skip</button><button onClick={() => moveSession(sess)} className="text-xs text-vow-muted hover:text-vow-ink">Move</button></div>}</div>; })}</div></div>
    {showAddSession && <div className="border border-vow-border p-5 mb-8"><p className="text-sm text-vow-ink mb-2">Add session</p><p className="text-xs text-vow-muted">New commitments are generated through the goal routine so the calendar stays coherent. Manual session creation can be added from the planner.</p><button onClick={() => setShowAddSession(false)} className="vow-btn-ghost mt-4">Close</button></div>}
    <div className="border-t border-vow-border pt-6 mt-10 flex flex-wrap gap-3"><button onClick={completeGoal} className="vow-btn-primary"><Check className="w-4 h-4" />Complete goal</button><button onClick={() => setShowPauseModal(true)} className="vow-btn-ghost"><Pause className="w-4 h-4" />Pause</button><button onClick={abandonGoal} className="vow-btn-ghost">Abandon</button></div>
    {showPauseModal && <div className="fixed inset-0 bg-black/20 flex items-center justify-center p-4 z-50"><div className="bg-white border border-vow-border p-6 max-w-md w-full"><h2 className="vow-heading text-lg text-vow-ink mb-2">Pause goal</h2><p className="text-sm text-vow-muted mb-4">Why are you pausing?</p><div className="space-y-2">{['Schedule changed','Need to adjust the plan','Taking a short break'].map((reason) => <button key={reason} onClick={() => handlePause(reason)} className="w-full text-left border border-vow-border px-4 py-3 text-sm hover:bg-black/5">{reason}</button>)}</div><button onClick={() => setShowPauseModal(false)} className="vow-btn-ghost mt-4">Cancel</button></div></div>}
  </div>;
}
