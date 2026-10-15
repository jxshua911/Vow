import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Goal, Milestone, Session, GoalStatus } from '@/types/database';
import { formatTime, formatDate, formatRelative } from '@/lib/dates';
import { PageHeader, NewButton } from './AppShell';
import { GoalPlanner } from './GoalPlanner';
import { GoalAI } from './GoalAI';
import { cancelReminder, notificationId, syncUpcomingSessionNotifications } from '@/lib/notifications';
import { Capacitor } from '@capacitor/core';
import { deleteSessionFromNativeCalendar } from '@/lib/nativeCalendar';
import { GoalResources } from './GoalResources';
import { GoalReferenceList } from './GoalReferenceList';
import { Check, Circle, CheckCircle2, SkipForward, Move, Pause, ChevronDown, ArrowLeft, Calendar, Clock } from '@/lib/ui-icons';

export function GoalsPage() {
  const { session } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [resumeDraftId, setResumeDraftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const loadGoals = useCallback(async () => {
    if (!session) { setLoading(false); return; }
    const cacheKey = `vow:offline-goals:${session.user.id}`;
    let cached: Goal[] = [];
    try {
      const raw = localStorage.getItem(cacheKey);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) cached = parsed as Goal[];
    } catch { /* Ignore an unavailable or invalid cache. */ }
    if (cached.length) { setGoals(cached); setLoading(false); }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setGoals(cached);
      setLoading(false);
      return;
    }
    if (!cached.length) setLoading(true);
    const { data, error } = await supabase.from('goals').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    if (data && !error) {
      const freshGoals = data as Goal[];
      setGoals(freshGoals);
      try { localStorage.setItem(cacheKey, JSON.stringify(freshGoals)); } catch { /* Offline cache is best-effort. */ }
      // Warm the local detail cache while connected so a later offline visit can
      // open each saved goal with its milestones and sessions already available.
      if (freshGoals.length > 0) {
        void (async () => {
          try {
            const ids = freshGoals.map((goal) => goal.id);
            const [milestoneResult, sessionResult] = await Promise.all([
              supabase.from('milestones').select('*').in('goal_id', ids).order('sort_order'),
              supabase.from('sessions').select('*').eq('user_id', session.user.id).order('scheduled_at', { ascending: true }),
            ]);
            const milestones = (milestoneResult.data || []) as Milestone[];
            const sessions = (sessionResult.data || []) as Session[];
            for (const goal of freshGoals) {
              try {
                localStorage.setItem(`vow:offline-goal-detail:${session.user.id}:${goal.id}`, JSON.stringify(goal));
                localStorage.setItem(`vow:offline-milestones:${session.user.id}:${goal.id}`, JSON.stringify(milestones.filter((item) => item.goal_id === goal.id)));
                localStorage.setItem(`vow:offline-sessions:${session.user.id}:${goal.id}`, JSON.stringify(sessions.filter((item) => item.goal_id === goal.id)));
              } catch { /* Device storage is best-effort. */ }
            }
          } catch (cacheError) {
            console.warn('[VOW] Could not warm offline goal details:', cacheError);
          }
        })();
      }
    } else if (!cached.length) {
      setGoals([]);
    }
    setLoading(false);
  }, [session]);
  useEffect(() => {
    const handleOnline = () => { setOnline(true); void loadGoals(); };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, [loadGoals]);
  useEffect(() => { void loadGoals(); }, [loadGoals]);

  useEffect(() => {
    if (!selectedGoalId) return;
    const handleHardwareBack = (event: Event) => {
      event.preventDefault();
      setSelectedGoalId(null);
      void loadGoals();
    };
    window.addEventListener('vow:hardware-back', handleHardwareBack);
    return () => window.removeEventListener('vow:hardware-back', handleHardwareBack);
  }, [selectedGoalId, loadGoals]);

  if (selectedGoalId) return <GoalDetail goalId={selectedGoalId} readOnly={!online} onBack={() => { setSelectedGoalId(null); loadGoals(); }} onContinueDraft={() => { if (!online) return; setResumeDraftId(selectedGoalId); setSelectedGoalId(null); setShowCreate(true); }} />;
  if (showCreate && !online) return <div><PageHeader title="Goals" /><p className="text-sm text-vow-muted mb-4">Plan creation needs an internet connection. Your saved goals and plans remain available offline.</p><button onClick={() => setShowCreate(false)} className="vow-btn-ghost">Back to saved goals</button></div>;
  if (showCreate && online) return <GoalPlanner
    userId={session?.user.id || ''}
    resumeDraftId={resumeDraftId}
    onCreated={() => { setShowCreate(false); setResumeDraftId(null); loadGoals(); }}
    onCancel={() => { setShowCreate(false); setResumeDraftId(null); }}
  />;
  if (!session) return <div><PageHeader title="Goals" /><div className="text-vow-muted text-sm">Please sign in to view your goals.</div></div>;

  const activeGoals = goals.filter((g) => g.status === 'active' || g.status === 'locked');
  const draftGoals = goals.filter((g) => g.status === 'draft');
  const completedGoals = goals.filter((g) => g.status === 'completed' || g.status === 'abandoned');
  const goalCtaLabel = goals.length > 0 ? 'New Goal' : 'Create Goal';
  return <div>
    <PageHeader title="Goals" subtitle="Lock in commitments. Track honestly. Adjust when the plan is wrong." action={online ? <NewButton onClick={() => setShowCreate(true)} label={goalCtaLabel} /> : undefined} />
    {!online && <p className="text-xs text-vow-muted border-l-2 border-vow-border pl-3 mb-6">Offline mode · saved goals and sessions are read-only. Reconnect to create plans or change progress.</p>}
    {loading ? <div className="text-vow-muted text-sm">Loading...</div> : goals.length === 0 ? <div className="border border-vow-border p-16 text-center"><p className="vow-heading text-xl text-vow-ink mb-2">No goals yet</p><p className="text-vow-muted text-sm">Create your first commitment and let VOW map the work into your calendar.</p></div> : <div className="space-y-12">{activeGoals.length > 0 && <GoalSection title="Active" goals={activeGoals} onSelect={setSelectedGoalId} />}{draftGoals.length > 0 && <GoalSection title="Drafts" goals={draftGoals} onSelect={setSelectedGoalId} />}{completedGoals.length > 0 && <GoalSection title="Completed & Abandoned" goals={completedGoals} onSelect={setSelectedGoalId} />}</div>}
  </div>;
}

function GoalSection({ title, goals, onSelect }: { title: string; goals: Goal[]; onSelect: (id: string) => void }) {
  const statusColors: Record<GoalStatus, string> = { draft: 'text-vow-muted', locked: 'text-vow-ink', active: 'text-vow-ink', completed: 'text-vow-success', abandoned: 'text-vow-muted line-through' };
  return <div><h2 className="vow-label mb-4">{title}</h2><div className="border-t border-vow-border">{goals.map((g) => <button key={g.id} onClick={() => onSelect(g.id)} className="w-full text-left border-b border-vow-border py-5 group flex items-start justify-between gap-4 hover:bg-vow-surface/30 transition-colors"><div className="flex-1 min-w-0"><div className={`text-base font-medium mb-1 ${statusColors[g.status]}`}>{g.outcome}</div>{g.why_it_matters && <div className="text-xs text-vow-muted italic mb-2">"{g.why_it_matters}"</div>}<div className="flex items-center gap-4 text-xs text-vow-muted"><span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{g.deadline ? formatRelative(g.deadline) : 'No deadline'}</span><span className="flex items-center gap-1"><Clock className="w-3 h-3" />{g.weekly_commitment_target}x/week</span></div></div><ArrowLeft className="w-4 h-4 text-vow-border rotate-180 mt-1 group-hover:text-vow-ink transition-colors" /></button>)}</div></div>;
}

function GoalDetail({ goalId, onBack, onContinueDraft, readOnly }: { goalId: string; onBack: () => void; onContinueDraft: () => void; readOnly: boolean }) {
  const { session } = useAuth();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSession, setShowAddSession] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editScheduledAt, setEditScheduledAt] = useState('');
  const [editDurationMinutes, setEditDurationMinutes] = useState('');
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);
  const [unansweredQuestions, setUnansweredQuestions] = useState<string[]>([]);
  const load = useCallback(async () => {
    const userId = session?.user.id;
    const goalKey = userId ? `vow:offline-goal-detail:${userId}:${goalId}` : '';
    const milestonesKey = userId ? `vow:offline-milestones:${userId}:${goalId}` : '';
    const sessionsKey = userId ? `vow:offline-sessions:${userId}:${goalId}` : '';
    let cachedGoal: Goal | null = null;
    let cachedMilestones: Milestone[] = [];
    let cachedSessions: Session[] = [];
    try {
      if (goalKey) {
        const raw = localStorage.getItem(goalKey);
        if (raw) cachedGoal = JSON.parse(raw) as Goal;
      }
      if (!cachedGoal && userId) {
        const rawGoals = localStorage.getItem(`vow:offline-goals:${userId}`);
        const parsedGoals: unknown = rawGoals ? JSON.parse(rawGoals) : [];
        if (Array.isArray(parsedGoals)) cachedGoal = (parsedGoals as Goal[]).find((item) => item.id === goalId) || null;
      }
      if (milestonesKey) {
        const raw = localStorage.getItem(milestonesKey);
        if (raw) { const parsed: unknown = JSON.parse(raw); if (Array.isArray(parsed)) cachedMilestones = parsed as Milestone[]; }
      }
      if (sessionsKey) {
        const raw = localStorage.getItem(sessionsKey);
        if (raw) { const parsed: unknown = JSON.parse(raw); if (Array.isArray(parsed)) cachedSessions = parsed as Session[]; }
      }
    } catch { /* Continue with any cache values successfully read. */ }

    if (cachedGoal || cachedMilestones.length || cachedSessions.length) {
      setGoal(cachedGoal); setMilestones(cachedMilestones); setSessions(cachedSessions);
      setLoading(false);
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setGoal(cachedGoal);
      setMilestones(cachedMilestones);
      setSessions(cachedSessions);
      setUnansweredQuestions([]);
      setLoading(false);
      return;
    }

    const [goalRes, msRes, sessRes] = await Promise.all([
      supabase.from('goals').select('*').eq('id', goalId).maybeSingle(),
      supabase.from('milestones').select('*').eq('goal_id', goalId).order('sort_order'),
      supabase.from('sessions').select('*').eq('goal_id', goalId).order('scheduled_at', { ascending: true }),
    ]);
    const resolvedGoal = (goalRes.data as Goal | null) || cachedGoal;
    const resolvedMilestones = (msRes.data as Milestone[] | null) || cachedMilestones;
    const resolvedSessions = (sessRes.data as Session[] | null) || cachedSessions;
    setGoal(resolvedGoal);
    setMilestones(resolvedMilestones);
    setSessions(resolvedSessions);
    if (userId) {
      try {
        if (resolvedGoal) localStorage.setItem(goalKey, JSON.stringify(resolvedGoal));
        localStorage.setItem(milestonesKey, JSON.stringify(resolvedMilestones));
        localStorage.setItem(sessionsKey, JSON.stringify(resolvedSessions));
      } catch { /* Offline cache is best-effort. */ }
    }
    if (resolvedGoal?.status === 'draft' && !goalRes.error) {
      const { data: clarificationRows } = await supabase.from('goal_clarification_answers').select('question,answer,question_order').eq('goal_id', goalId).order('question_order', { ascending: true });
      setUnansweredQuestions(((clarificationRows || []) as Array<{ question: string; answer: string | null }>).filter((row) => !row.answer?.trim()).map((row) => row.question));
    } else {
      setUnansweredQuestions([]);
    }
    setLoading(false);
  }, [goalId, session?.user.id]);
  useEffect(() => { load(); }, [load]);
  async function updateSessionStatus(sessId: string, status: Session['status']) {
    const updates: Partial<Session> = { status, updated_at: new Date().toISOString() };
    if (status === 'completed') updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from('sessions').update(updates).eq('id', sessId);
    if (!error && status !== 'scheduled') await cancelReminder(notificationId(sessId));
    await load();
  }

  async function deleteSession(sess: Session) {
    if (!session || !confirm('Delete this session from VOW and remove its linked phone-calendar event?')) return;
    const { error } = await supabase.from('sessions').delete().eq('id', sess.id).eq('user_id', session.user.id);
    if (error) {
      console.error('[VOW] Could not delete session:', error);
      alert('Could not delete this session. Please try again.');
      return;
    }
    await cancelReminder(notificationId(sess.id));
    if (Capacitor.isNativePlatform()) {
      try {
        await deleteSessionFromNativeCalendar(sess);
      } catch (calendarError) {
        console.error('[VOW] Session deleted but native calendar cleanup failed:', calendarError);
        alert('The session was deleted from VOW, but its phone-calendar event could not be removed. Check calendar permission and remove the leftover event from your calendar.');
      }
    }
    await load();
  }
  function openSessionEditor(sess: Session) {
    const localDate = new Date(sess.scheduled_at);
    const localValue = new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditingSession(sess);
    setEditScheduledAt(localValue);
    setEditDurationMinutes(String(sess.duration_minutes));
  }
  async function saveSessionChanges() {
    if (!editingSession || !session) return;
    const nextDate = new Date(editScheduledAt);
    const nextDuration = Number(editDurationMinutes);
    if (!Number.isFinite(nextDate.getTime()) || !Number.isInteger(nextDuration) || nextDuration < 5 || nextDuration > 1440) {
      alert('Choose a valid date and time, and a duration between 5 minutes and 24 hours.');
      return;
    }
    const previousDate = editingSession.scheduled_at;
    const nextIso = nextDate.toISOString();
    const dateChanged = new Date(previousDate).getTime() !== nextDate.getTime();
    const { error } = await supabase.from('sessions').update({
      scheduled_at: nextIso,
      duration_minutes: nextDuration,
      moved_count: editingSession.moved_count + (dateChanged ? 1 : 0),
      status: 'scheduled',
      updated_at: new Date().toISOString(),
    }).eq('id', editingSession.id).eq('user_id', session.user.id);
    if (error) {
      console.error('[VOW] Could not adjust session:', error);
      alert('Could not save this schedule change. Please try again.');
      return;
    }
    if (dateChanged) {
      const { error: historyError } = await supabase.from('vow_session_moves').insert({
        user_id: session.user.id,
        session_id: editingSession.id,
        from_date: previousDate,
        to_date: nextIso,
      });
      if (historyError) console.error('[VOW] Schedule adjusted but move history could not be recorded:', historyError);
    }
    await cancelReminder(notificationId(editingSession.id));
    await syncUpcomingSessionNotifications([{
      ...editingSession,
      scheduled_at: nextIso,
      duration_minutes: nextDuration,
      moved_count: editingSession.moved_count + (dateChanged ? 1 : 0),
      status: 'scheduled',
    } as Session]);
    setEditingSession(null);
    await load();
  }
  async function toggleMilestoneStatus(ms: Milestone) { const newStatus = ms.status === 'completed' ? 'pending' : 'completed'; await supabase.from('milestones').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', ms.id); load(); }
  async function abandonGoal() {
    if (!confirm('Mark this goal as abandoned? This records the outcome so VOW can learn from the pattern.')) return;
    await supabase.from('goals').update({ status: 'abandoned', updated_at: new Date().toISOString() }).eq('id', goalId);
    await Promise.all(sessions.filter(s => s.status === 'scheduled' && new Date(s.scheduled_at).getTime() > Date.now()).map(s => cancelReminder(notificationId(s.id))));
    onBack();
  }
  async function completeGoal() {
    await supabase.from('goals').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', goalId);
    await Promise.all(sessions.filter(s => s.status === 'scheduled' && new Date(s.scheduled_at).getTime() > Date.now()).map(s => cancelReminder(notificationId(s.id))));
    onBack();
  }
  async function deleteGoal() {
    if (!confirm('Permanently delete this goal and all associated data? This cannot be undone.')) return;
    const { error } = await supabase.from('goals').delete().eq('id', goalId);
    if (error) {
       console.error('[VOW] Failed to delete goal:', error);
       alert('Could not delete goal. Please try again.');
       return;
    }
    await Promise.all(sessions.filter(s => s.status === 'scheduled' && new Date(s.scheduled_at).getTime() > Date.now()).map(s => cancelReminder(notificationId(s.id))));
    onBack();
  }
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
    {goal.status === 'draft' && <section className="border border-vow-border bg-vow-gray/10 p-5 mb-10">
      <p className="vow-label mb-2">Incomplete goal</p>
      <p className="text-sm text-vow-ink mb-2">This goal is incomplete. VOW still needs a few answers before it can build your plan.</p>
      {unansweredQuestions.length > 0 ? (
        <>
          <p className="text-xs text-vow-muted mb-3">You still need to answer:</p>
          <ul className="space-y-2 mb-4">{unansweredQuestions.map((question, index) => <li key={index} className="text-sm text-vow-ink border-l border-vow-border pl-3">{question}</li>)}</ul>
        </>
      ) : <p className="text-xs text-vow-muted mb-4">Continue where you left off to finish this goal.</p>}
      {readOnly ? <p className="text-xs text-vow-muted">Reconnect to continue answering and build this plan.</p> : <button type="button" onClick={onContinueDraft} className="vow-btn-primary">Continue answering</button>}
    </section>}
    <GoalResources goalId={goalId} />
    <GoalReferenceList goalId={goalId} />
    <section className="border border-vow-border p-5 my-10">
      <p className="vow-label mb-2">VOW AI</p>
      <p className="text-sm text-vow-muted mb-4">Your planning consultant, right here with this goal. Ask about your saved plan, your next action, missed sessions, or adapting your schedule.</p>
      {readOnly ? <p className="text-xs text-vow-muted">Reconnect to consult VOW AI. Your saved goal and plan remain available offline.</p> : <GoalAI goal={goal} />}
    </section>
    <div className="mb-10"><div className="flex items-center justify-between mb-4"><h2 className="vow-label">Milestones</h2><button onClick={() => setExpandedMilestone(expandedMilestone ? null : milestones[0]?.id || null)} className="vow-btn-soft text-xs">{expandedMilestone ? 'Collapse' : 'Expand'}</button></div><div className="border-t border-vow-border">{milestones.map((ms) => { const Icon = ms.status === 'completed' ? CheckCircle2 : Circle; return <div key={ms.id} className="border-b border-vow-border py-4"><button className="w-full text-left flex items-start gap-3" onClick={() => setExpandedMilestone(expandedMilestone === ms.id ? null : ms.id)}><Icon className="w-4 h-4 mt-0.5" /><div className="flex-1"><p className="text-sm text-vow-ink">{ms.title}</p><p className="text-xs text-vow-muted mt-1">{formatDate(ms.deadline)}</p>{expandedMilestone === ms.id && <p className="text-xs text-vow-muted mt-2">{ms.description}</p>}</div><ChevronDown className={`w-4 h-4 transition-transform ${expandedMilestone === ms.id ? 'rotate-180' : ''}`} /></button>{!readOnly && <button onClick={() => toggleMilestoneStatus(ms)} className="vow-btn-soft text-xs ml-7 mt-2">{ms.status === 'completed' ? 'Mark pending' : 'Mark completed'}</button>}</div>; })}</div></div>
    <div className="mb-10"><div className="flex items-center justify-between mb-4"><h2 className="vow-label">Sessions & routine</h2>{!readOnly && <button onClick={() => setShowAddSession(!showAddSession)} className="vow-btn-ghost"><Calendar className="w-4 h-4" />Session options</button>}</div><div className="border-t border-vow-border">{sessions.map((sess) => { const Icon = statusIcons[sess.status] || Circle; return <div key={sess.id} className="border-b border-vow-border py-4 flex items-center gap-4"><Icon className="w-4 h-4 text-vow-muted" /><div className="flex-1"><p className="text-sm text-vow-ink">{sess.title}</p><p className="text-xs text-vow-muted mt-1">{formatDate(sess.scheduled_at)} · {formatTime(sess.scheduled_at)} · {sess.duration_minutes} min</p></div>{!readOnly && sess.status === 'scheduled' && <div className="flex gap-2"><button onClick={() => updateSessionStatus(sess.id, 'completed')} className="vow-btn-soft text-xs">Complete</button><button onClick={() => updateSessionStatus(sess.id, 'skipped')} className="vow-btn-soft text-xs">Skip</button><button onClick={() => openSessionEditor(sess)} className="vow-btn-soft text-xs">Reschedule</button><button onClick={() => void deleteSession(sess)} className="vow-btn-soft text-xs">Delete</button></div>}</div>; })}</div></div>
    {showAddSession && <div className="border border-vow-border p-5 mb-8"><p className="text-sm text-vow-ink mb-2">About sessions</p><p className="text-xs text-vow-muted">VOW currently schedules sessions from your goal plan; manual session creation is not available in this view yet. Use “Reschedule” on an existing session to change its time.</p><button onClick={() => setShowAddSession(false)} className="vow-btn-ghost mt-4">Close</button></div>}
    {!readOnly && <div className="border-t border-vow-border pt-6 mt-10 flex flex-wrap gap-3"><button onClick={completeGoal} className="vow-btn-primary"><Check className="w-4 h-4" />Complete goal</button><button onClick={() => setShowPauseModal(true)} className="vow-btn-ghost"><Pause className="w-4 h-4" />Pause</button><button onClick={abandonGoal} className="vow-btn-ghost">Abandon</button><button onClick={deleteGoal} className="vow-btn-ghost text-red-600">Delete</button></div>}
    {!readOnly && editingSession && <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"><div className="bg-vow-bg border border-vow-border p-6 max-w-md w-full"><h2 className="vow-heading text-lg text-vow-ink mb-2">Adjust this session</h2><p className="text-sm text-vow-muted mb-4">{editingSession.title}. Change the date, time or amount of time you can give it. Completed sessions and goal progress stay intact.</p><label className="vow-label block mb-2" htmlFor="session-schedule-time">Date and time</label><input id="session-schedule-time" type="datetime-local" value={editScheduledAt} onChange={(event) => setEditScheduledAt(event.target.value)} className="w-full border border-vow-border bg-transparent px-3 py-3 text-sm text-vow-ink mb-4" /><label className="vow-label block mb-2" htmlFor="session-duration">Duration (minutes)</label><input id="session-duration" type="number" min="5" max="1440" step="5" value={editDurationMinutes} onChange={(event) => setEditDurationMinutes(event.target.value)} className="w-full border border-vow-border bg-transparent px-3 py-3 text-sm text-vow-ink mb-5" /><div className="flex gap-3"><button onClick={() => setEditingSession(null)} className="vow-btn-ghost">Cancel</button><button onClick={saveSessionChanges} className="vow-btn-primary flex-1">Save changes</button></div></div></div>}
    {!readOnly && showPauseModal && <div className="fixed inset-0 bg-black/20 flex items-center justify-center p-4 z-50"><div className="bg-vow-bg border border-vow-border p-6 max-w-md w-full"><h2 className="vow-heading text-lg text-vow-ink mb-2">Pause goal</h2><p className="text-sm text-vow-muted mb-4">Why are you pausing?</p><div className="space-y-2">{['Schedule changed','Need to adjust the plan','Taking a short break'].map((reason) => <button key={reason} onClick={() => handlePause(reason)} className="w-full text-left border border-vow-border px-4 py-3 text-sm hover:bg-vow-surface">{reason}</button>)}</div><button onClick={() => setShowPauseModal(false)} className="vow-btn-ghost mt-4">Cancel</button></div></div>}
  </div>;
}
