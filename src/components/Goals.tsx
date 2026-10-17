import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Goal, Milestone, Session, GoalStatus } from '@/types/database';
import { formatTime, formatDate, formatRelative } from '@/lib/dates';
import { PageHeader, NewButton } from './AppShell';
import { GoalPlanner } from './GoalPlanner';
import { GoalAI } from './GoalAI';
import { cancelActionRemindersForSession, cancelReminder, notificationId, syncSessionActionReminders, syncUserUpcomingSessionNotifications } from '@/lib/notifications';
import { Capacitor } from '@capacitor/core';
import { addSessionToNativeCalendar, deleteSessionFromNativeCalendar, replaceSessionInNativeCalendar } from '@/lib/nativeCalendar';
import { GoalResources } from './GoalResources';
import { SessionActions } from './SessionActions';
import { Check, Circle, CheckCircle2, SkipForward, Move, Pause, ChevronDown, ArrowLeft, Clock, Calendar } from '@/lib/ui-icons';

function getSessionVideoUrls(notes: string | null): string[] {
  return [...new Set((notes || '').split('\n').filter((line) => line.startsWith('Video: ')).flatMap((line) => {
    try {
      const url = new URL(line.slice('Video: '.length).trim());
      return url.protocol === 'https:' && (url.hostname === 'youtu.be' || url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com')) ? [url.toString()] : [];
    } catch {
      return [];
    }
  }))];
}

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
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [mergingSession, setMergingSession] = useState<Session | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeBusy, setMergeBusy] = useState(false);
  const [editScheduledAt, setEditScheduledAt] = useState('');
  const [editTimingMode, setEditTimingMode] = useState<'timed' | 'flexible-day' | 'unscheduled'>('timed');
  const [editDayOfWeek, setEditDayOfWeek] = useState('Monday');
  const [editDurationMinutes, setEditDurationMinutes] = useState('');
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [expandedMilestone, setExpandedMilestone] = useState<string | 'all' | null>(null);
  const [, setShowAbandonModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
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
    if (!error && status !== 'scheduled') {
      await cancelReminder(notificationId(sessId));
      await cancelActionRemindersForSession(sessId);
    }
    await load();
  }

  async function deleteSession(sess: Session) {
    if (!session || !confirm('Delete this session from VOW and remove its linked Google/phone-calendar events?')) return;
    if (sess.external_event_id && navigator.onLine) {
      const { error: googleDeleteError } = await supabase.functions.invoke('google-calendar-events', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: 'delete', eventId: sess.external_event_id },
      });
      if (googleDeleteError) {
        console.error('[VOW] Could not delete linked Google Calendar event:', googleDeleteError);
        alert('VOW could not remove the linked Google Calendar event, so the session was kept. Reconnect Google Calendar and try again.');
        return;
      }
    }
    const { error } = await supabase.from('sessions').delete().eq('id', sess.id).eq('user_id', session.user.id);
    if (error) {
      console.error('[VOW] Could not delete session:', error);
      alert('Could not delete this session. Please try again.');
      return;
    }
    await cancelReminder(notificationId(sess.id));
    await cancelActionRemindersForSession(sess.id);
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
  async function mergeSessions(source: Session, target: Session) {
    if (!session || source.id === target.id || source.goal_id !== target.goal_id || mergeBusy) return;
    if (!confirm(`Combine “${source.title}” into “${target.title}”? Both sessions’ actions and resource links will be preserved. The combined session will keep the chosen appointment time and add the durations together. This cannot be automatically undone.`)) return;
    setMergeBusy(true);
    setActionError(null);
    let combinedScheduledAt = target.scheduled_at;
    let calendarSyncWarning = false;
    const mergeResult = await supabase.rpc('vow_merge_sessions', {
      p_source_session_id: source.id,
      p_target_session_id: target.id,
    });
    if (mergeResult.error || !mergeResult.data?.length) {
      console.error('[VOW] Atomic session merge failed:', mergeResult.error);
      const message = mergeResult.error?.message || 'No merge result was returned.';
      setActionError(message.includes('24 hours')
        ? 'These sessions together exceed VOW’s 24-hour session limit. Shorten one session before combining them.'
        : 'VOW could not combine these sessions. Both sessions have been kept unchanged; please retry.');
      setMergeBusy(false);
      return;
    }
    const mergeRecord = mergeResult.data[0] as {
      target_session_id: string;
      combined_duration_minutes: number;
      source_external_event_id: string | null;
      target_external_event_id: string | null;
      combined_notes: string | null;
    };
    const combinedNotes = mergeRecord.combined_notes || '';
    const savedCombinedDuration = mergeRecord.combined_duration_minutes;
    const { data: latestTarget, error: latestTargetError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', mergeRecord.target_session_id)
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (latestTargetError || !latestTarget) {
      calendarSyncWarning = true;
      console.error('[VOW] Sessions merged, but the saved target could not be reloaded for calendar sync:', latestTargetError);
    } else {
      combinedScheduledAt = (latestTarget as Session).scheduled_at;
    }
    const canSyncTargetCalendar = Boolean(latestTarget && !latestTargetError);
    const mergedTitle = (latestTarget as Session | null)?.title || target.title;
    await cancelReminder(notificationId(source.id));
    await cancelReminder(notificationId(target.id));
    await cancelActionRemindersForSession(source.id).catch((error) => { calendarSyncWarning = true; console.error('[VOW] Could not cancel source action reminders:', error); });
    await syncSessionActionReminders(target.id, mergedTitle).catch((error) => { calendarSyncWarning = true; console.error('[VOW] Could not resync combined action reminders:', error); });
    const combinedSession = {
      ...target,
      ...(latestTarget ? latestTarget as Session : {}),
      notes: combinedNotes,
      scheduled_at: combinedScheduledAt,
      duration_minutes: savedCombinedDuration,
      status: 'scheduled',
    } as Session;
    await syncUserUpcomingSessionNotifications(session.user.id).catch((syncError) => {
      calendarSyncWarning = true;
      console.error('[VOW] Sessions merged but reminders could not be fully synchronized:', syncError);
    });
    if (canSyncTargetCalendar && mergeRecord.target_external_event_id && combinedScheduledAt && navigator.onLine) {
      const eventEnd = new Date(new Date(combinedScheduledAt).getTime() + savedCombinedDuration * 60_000).toISOString();
      const { error: calendarUpdateError } = await supabase.functions.invoke('google-calendar-events', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: 'update', eventId: mergeRecord.target_external_event_id, event: {
          start: { dateTime: combinedScheduledAt }, end: { dateTime: eventEnd },
          summary: `VOW · ${mergedTitle}`,
          description: combinedNotes + `\n\n${savedCombinedDuration} minute combined commitment from VOW.`,
        } },
      });
      if (calendarUpdateError) { calendarSyncWarning = true; console.error('[VOW] Sessions merged but Google Calendar target event could not be updated:', calendarUpdateError); }
    }
    if (Capacitor.isNativePlatform() && canSyncTargetCalendar) {
      try {
        await replaceSessionInNativeCalendar(target, combinedSession);
      } catch (calendarError) {
        calendarSyncWarning = true;
        console.error('[VOW] Sessions merged but phone-calendar target event could not be updated:', calendarError);
      }
    }
    if (Capacitor.isNativePlatform()) {
      try {
        await deleteSessionFromNativeCalendar(source);
      } catch (calendarError) {
        calendarSyncWarning = true;
        console.error('[VOW] Merged sessions but source phone-calendar event may remain:', calendarError);
      }
    }
    if (mergeRecord.source_external_event_id && navigator.onLine) {
      const { error: googleDeleteError } = await supabase.functions.invoke('google-calendar-events', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { action: 'delete', eventId: mergeRecord.source_external_event_id },
      });
      if (googleDeleteError) { calendarSyncWarning = true; console.error('[VOW] Merged sessions but source Google Calendar event may remain:', googleDeleteError); }
    }
    setMergingSession(null);
    setMergeTargetId('');
    setMergeBusy(false);
    if (calendarSyncWarning) setActionError('Sessions were combined and saved, but a calendar event could not be synchronized. Check Google/phone calendar and reconnect permissions if needed.');
    await load();
  }

  const sessionDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  function openSessionEditor(sess: Session) {
    const noteDay = /Plan day: Week \d+, ([A-Za-z]+)/.exec(sess.notes || '')?.[1];
    const day = sess.day_of_week || noteDay || 'Monday';
    setEditingSession(sess);
    setEditTimingMode(sess.scheduled_at ? 'timed' : (sess.day_of_week || noteDay) ? 'flexible-day' : 'unscheduled');
    setEditDayOfWeek(sessionDays.includes(day) ? day : 'Monday');
    if (sess.scheduled_at) {
      const localDate = new Date(sess.scheduled_at);
      setEditScheduledAt(new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    } else setEditScheduledAt('');
    setEditDurationMinutes(String(sess.duration_minutes));
  }
  async function saveSessionChanges() {
    if (!editingSession || !session) return;
    const nextDuration = Number(editDurationMinutes);
    if (!Number.isInteger(nextDuration) || nextDuration < 5 || nextDuration > 1440) {
      alert('Choose a duration between 5 minutes and 24 hours.');
      return;
    }
    let nextIso: string | null = null;
    let nextDay: string | null = null;
    if (editTimingMode === 'timed') {
      const nextDate = new Date(editScheduledAt);
      if (!Number.isFinite(nextDate.getTime())) { alert('Choose a valid date and time.'); return; }
      nextIso = nextDate.toISOString();
      nextDay = nextDate.toLocaleDateString('en-US', { weekday: 'long' });
    } else if (editTimingMode === 'flexible-day') {
      if (!sessionDays.includes(editDayOfWeek)) { alert('Choose a weekday for this flexible session.'); return; }
      nextDay = editDayOfWeek;
    }
    const previousDate = editingSession.scheduled_at;
    const dateChanged = Boolean(previousDate && nextIso && Date.parse(previousDate) !== Date.parse(nextIso));
    const nextMovedCount = editingSession.moved_count + (dateChanged ? 1 : 0);
    const { error } = await supabase.from('sessions').update({
      scheduled_at: nextIso,
      day_of_week: nextDay,
      duration_minutes: nextDuration,
      moved_count: nextMovedCount,
      external_event_id: nextIso ? editingSession.external_event_id : null,
      status: 'scheduled',
      updated_at: new Date().toISOString(),
    }).eq('id', editingSession.id).eq('user_id', session.user.id);
    if (error) {
      console.error('[VOW] Could not adjust session:', error);
      alert('Could not save this schedule change. Please try again.');
      return;
    }
    if (nextIso && editingSession.external_event_id && navigator.onLine) {
      const eventEnd = new Date(Date.parse(nextIso) + nextDuration * 60_000).toISOString();
      const { error: calendarUpdateError } = await supabase.functions.invoke('google-calendar-events', {
        headers: { Authorization: 'Bearer ' + session.access_token },
        body: { action: 'update', eventId: editingSession.external_event_id, event: {
          start: { dateTime: nextIso }, end: { dateTime: eventEnd },
          summary: 'VOW · ' + editingSession.title,
          description: (editingSession.notes || editingSession.title) + '\n\n' + nextDuration + ' minute commitment from VOW.',
        } },
      });
      if (calendarUpdateError) {
        console.error('[VOW] Session moved in VOW but Google Calendar update failed:', calendarUpdateError);
        setActionError('The session was rescheduled in VOW, but Google Calendar could not be updated. Reconnect Google Calendar and check the event.');
      }
    } else if (!nextIso && editingSession.external_event_id && navigator.onLine) {
      const { error: googleDeleteError } = await supabase.functions.invoke('google-calendar-events', {
        headers: { Authorization: 'Bearer ' + session.access_token },
        body: { action: 'delete', eventId: editingSession.external_event_id },
      });
      if (googleDeleteError) setActionError('The session is flexible in VOW, but its old Google Calendar event may still exist.');
    }
    if (Capacitor.isNativePlatform()) {
      try {
        await deleteSessionFromNativeCalendar(editingSession);
        if (nextIso) await addSessionToNativeCalendar({ ...editingSession, scheduled_at: nextIso, day_of_week: nextDay, duration_minutes: nextDuration } as Session);
      } catch (calendarError) {
        console.error('[VOW] Session timing changed in VOW but phone-calendar sync failed:', calendarError);
        setActionError('The session was updated in VOW, but the phone-calendar event could not be synchronized. Check calendar permissions.');
      }
    }
    if (dateChanged && previousDate && nextIso) {
      const { error: historyError } = await supabase.from('vow_session_moves').insert({
        user_id: session.user.id, session_id: editingSession.id, from_date: previousDate, to_date: nextIso,
      });
      if (historyError) console.error('[VOW] Schedule adjusted but move history could not be recorded:', historyError);
    }
    await cancelReminder(notificationId(editingSession.id));
    await syncUserUpcomingSessionNotifications(session.user.id).catch((syncError) => {
      console.error('[VOW] Session timing changed but reminders could not be synchronized:', syncError);
      setActionError('The session was updated in VOW, but reminders could not be fully synchronized.');
    });
    setEditingSession(null);
    await load();
  }
  async function toggleMilestoneStatus(ms: Milestone) { const newStatus = ms.status === 'completed' ? 'pending' : 'completed'; await supabase.from('milestones').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', ms.id); load(); }
  async function completeGoal() {
    if (!session || goal?.status === 'draft') return;
    setActionError(null);
    const { error } = await supabase.from('goals').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', goalId).eq('user_id', session.user.id);
    if (error) { setActionError('VOW could not mark this goal complete. Please try again.'); return; }
    await Promise.all(sessions.filter(s => s.status === 'scheduled' && Boolean(s.scheduled_at) && new Date(s.scheduled_at as string).getTime() > Date.now()).map(s => cancelReminder(notificationId(s.id))));
    onBack();
  }
  async function deleteGoal() {
    if (!session || !confirm('Permanently delete this goal and all associated data? This cannot be undone.')) return;
    setActionError(null);
    const { data: linkedSessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .eq('goal_id', goalId)
      .eq('user_id', session.user.id);
    if (sessionsError) {
      console.error('[VOW] Could not load sessions before goal deletion:', sessionsError);
      alert('Could not safely prepare this goal for deletion. Please try again.');
      return;
    }

    const cleanupFailures: string[] = [];
    for (const item of (linkedSessions || []) as Session[]) {
      try {
        await cancelReminder(notificationId(item.id));
        await cancelActionRemindersForSession(item.id);
      } catch (error) {
        console.error('[VOW] Reminder cleanup failed for deleted goal session:', item.id, error);
        cleanupFailures.push('reminders');
      }
      if (item.external_event_id && navigator.onLine) {
        try {
          const { error: googleError } = await supabase.functions.invoke('google-calendar-events', {
            headers: { Authorization: 'Bearer ' + session.access_token },
            body: { action: 'delete', eventId: item.external_event_id },
          });
          if (googleError) throw googleError;
        } catch (error) {
          console.error('[VOW] Google Calendar cleanup failed for goal session:', item.id, error);
          cleanupFailures.push('Google Calendar');
        }
      }
      if (Capacitor.isNativePlatform()) {
        try {
          await deleteSessionFromNativeCalendar(item);
        } catch (error) {
          console.error('[VOW] Phone calendar cleanup failed for goal session:', item.id, error);
          cleanupFailures.push('phone calendar');
        }
      }
    }

    const { error } = await supabase.from('goals').delete().eq('id', goalId).eq('user_id', session.user.id);
    if (error) {
      console.error('[VOW] Failed to delete goal:', error);
      alert('Could not delete goal. Please try again.');
      return;
    }

    try {
      localStorage.removeItem(`vow:offline-goal-detail:${session.user.id}:${goalId}`);
      localStorage.removeItem(`vow:offline-milestones:${session.user.id}:${goalId}`);
      localStorage.removeItem(`vow:offline-sessions:${session.user.id}:${goalId}`);
      const rawGoals = localStorage.getItem(`vow:offline-goals:${session.user.id}`);
      const cachedGoals: unknown = rawGoals ? JSON.parse(rawGoals) : [];
      if (Array.isArray(cachedGoals)) {
        localStorage.setItem(`vow:offline-goals:${session.user.id}`, JSON.stringify((cachedGoals as Goal[]).filter((item) => item.id !== goalId)));
      }
    } catch (cacheError) {
      console.warn('[VOW] Could not fully clear deleted goal from offline cache:', cacheError);
    }
    if (cleanupFailures.length) {
      setActionError('The goal was deleted, but some external cleanup failed (' + [...new Set(cleanupFailures)].join(', ') + '). Check those calendars and notifications.');
    }
    onBack();
  }
  async function handlePause(context: string) {
    if (!session) return;
    setActionError(null);
    const { error } = await supabase.from('user_settings').upsert({ user_id: session.user.id, pause_context: context || null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) { setActionError('Could not save your pause reason. Please try again.'); return; }
    setShowPauseModal(false);
    onBack();
  }
  if (loading) return <div className="text-vow-muted text-sm">Loading...</div>;
  if (!goal) return <div className="text-vow-muted text-sm">Goal not found.</div>;
  const completedSessions = sessions.filter((s) => s.status === 'completed').length;
  const totalSessions = sessions.length;
  const pct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
  const movedCount = sessions.filter((s) => s.moved_count > 0).reduce((sum, s) => sum + s.moved_count, 0);
  const statusIcons: Record<string, typeof CheckCircle2> = { completed: CheckCircle2, scheduled: Circle, skipped: SkipForward, moved: Move };
  return <div>
    <button onClick={onBack} className="text-sm text-vow-muted hover:text-vow-ink mb-6 flex items-center gap-1 transition-colors"><ArrowLeft className="w-4 h-4" />Back to goals</button>
    <div className="border-t border-vow-border pt-8 mb-8"><div className="flex items-start justify-between gap-4 mb-4"><h1 className="vow-heading text-2xl text-vow-ink">{goal.outcome}</h1><span className="text-xs uppercase tracking-wide text-vow-muted">{goal.status === 'draft' ? 'Draft' : goal.status}</span></div>{goal.why_it_matters && <p className="text-sm text-vow-muted italic mb-6">"{goal.why_it_matters}"</p>}{goal.status !== 'draft' && <div className="grid grid-cols-3 gap-4 border-t border-vow-border pt-4"><div><p className="vow-label">Progress</p><p className="text-lg text-vow-ink mt-1">{pct}%</p></div><div><p className="vow-label">Sessions</p><p className="text-lg text-vow-ink mt-1">{completedSessions}/{totalSessions}</p></div><div><p className="vow-label">Moved</p><p className="text-lg text-vow-ink mt-1">{movedCount}</p></div></div>}</div>
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
    {goal.status !== 'draft' && <GoalResources goalId={goalId} />}
    {goal.status !== 'draft' && <section className="border border-vow-border p-5 my-10">
      <p className="vow-label mb-2">Planning assistant</p>
      <p className="text-sm text-vow-muted mb-4">Your planning consultant, right here with this goal. Ask about your saved plan, your next action, missed sessions, or adapting your schedule.</p>
      {readOnly ? <p className="text-xs text-vow-muted">Reconnect to consult VOW AI. Your saved goal and plan remain available offline.</p> : <GoalAI goal={goal} />}
    </section>}
    {goal.status !== 'draft' && <div className="mb-10"><div className="flex items-center justify-between mb-4"><h2 className="vow-label">Milestones</h2><button onClick={() => setExpandedMilestone(expandedMilestone === 'all' ? null : 'all')} className="vow-btn-soft text-xs">{expandedMilestone ? 'Collapse all' : 'Expand all'}</button></div><div className="border-t border-vow-border">{milestones.map((ms) => { const isExpanded = expandedMilestone === 'all' || expandedMilestone === ms.id; const Icon = ms.status === 'completed' ? CheckCircle2 : Circle; return <div key={ms.id} className="border-b border-vow-border py-4"><button className="w-full text-left flex items-start gap-3" onClick={() => setExpandedMilestone(isExpanded ? null : ms.id)}><Icon className="w-4 h-4 mt-0.5" /><div className="flex-1"><p className="text-sm text-vow-ink">{ms.title}</p><p className="text-xs text-vow-muted mt-1">{formatDate(ms.deadline)}</p>{isExpanded && <p className="text-xs text-vow-muted mt-2">{ms.description}</p>}</div><ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} /></button>{!readOnly && <button onClick={() => toggleMilestoneStatus(ms)} className="vow-btn-soft text-xs ml-7 mt-2">{ms.status === 'completed' ? 'Mark pending' : 'Mark completed'}</button>}</div>; })}</div></div>}
    {goal.status !== 'draft' && <div className="mb-10"><div className="flex items-center justify-between mb-4"><h2 className="vow-label">Sessions</h2></div><div className="border-t border-vow-border">{sessions.map((sess) => { const Icon = statusIcons[sess.status] || Circle; const noteLines = (sess.notes || '').split('\n'); const videoUrls = getSessionVideoUrls(sess.notes); const sessionTask = noteLines.find((line) => line.startsWith('Task: '))?.slice(6) || sess.title; const sessionPurpose = noteLines.find((line) => line.startsWith('Purpose: '))?.slice(9); const sessionTarget = noteLines.find((line) => line.startsWith('Target: '))?.slice(8); const sessionSteps = noteLines.filter((line) => /^Step \d+: /.test(line)).map((line) => line.replace(/^Step \d+: /, '')); return <div key={sess.id} className="border-b border-vow-border py-4 flex min-w-0 flex-wrap items-start sm:items-center gap-3"><Icon className="w-4 h-4 text-vow-muted shrink-0" /><div className="min-w-0 flex-1"><p className="text-sm text-vow-ink break-words">{sessionTask}</p><p className="text-xs text-vow-muted mt-1">{sess.scheduled_at ? `${formatDate(sess.scheduled_at)} · ${formatTime(sess.scheduled_at)}` : sess.day_of_week ? `Flexible · ${sess.day_of_week}` : 'Unscheduled'} · {sess.duration_minutes} min</p>{sessionPurpose && <p className="text-xs text-vow-muted mt-2 break-words">{sessionPurpose}</p>}{sessionTarget && <p className="text-xs text-vow-muted mt-1 break-words">Finish condition: {sessionTarget}</p>}{sessionSteps.length > 0 && <ol className="list-decimal pl-5 mt-3 space-y-1">{sessionSteps.map((step, index) => <li key={index} className="text-xs text-vow-muted break-words">{step}</li>)}</ol>}{videoUrls.length > 0 && <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">{videoUrls.map((videoUrl, videoIndex) => <a key={videoUrl} href={videoUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-vow-ink underline underline-offset-2">{videoUrl.includes('/results?') ? `Find session videos ${videoUrls.length > 1 ? videoIndex + 1 : ''} on YouTube ↗` : `Watch session video ${videoUrls.length > 1 ? videoIndex + 1 : ''} on YouTube ↗`}</a>)}</div>}<SessionActions session={sess} readOnly={readOnly} /></div>{!readOnly && sess.status === 'scheduled' && <div className="flex flex-wrap gap-2 min-w-0"><button onClick={() => updateSessionStatus(sess.id, 'completed')} className="vow-btn-soft text-xs">Complete</button><button onClick={() => updateSessionStatus(sess.id, 'skipped')} className="vow-btn-soft text-xs">Skip</button><button onClick={() => openSessionEditor(sess)} className="vow-btn-soft text-xs">Reschedule</button><button onClick={() => { setMergingSession(sess); setMergeTargetId(sessions.find((candidate) => candidate.id !== sess.id && candidate.status === "scheduled")?.id || ""); }} className="vow-btn-soft text-xs" disabled={sessions.filter((candidate) => candidate.id !== sess.id && candidate.status === "scheduled").length === 0}>Combine</button><button onClick={() => void deleteSession(sess)} className="vow-btn-soft text-xs">Delete</button></div>}</div>; })}</div></div>}
    {actionError && <p role="alert" className="text-sm text-red-600 mt-4">{actionError}</p>}{!readOnly && <div className="border-t border-vow-border pt-6 mt-10 flex flex-wrap gap-3">{goal.status === 'draft' ? <button onClick={deleteGoal} className="vow-btn-ghost text-red-600">Delete draft</button> : <><button onClick={completeGoal} className="vow-btn-primary"><Check className="w-4 h-4" />Complete goal</button><button onClick={() => setShowPauseModal(true)} className="vow-btn-ghost"><Pause className="w-4 h-4" />Pause planning</button><button onClick={() => setShowAbandonModal(true)} className="vow-btn-ghost">Abandon goal</button><button onClick={deleteGoal} className="vow-btn-ghost text-red-600">Delete goal</button></>}</div>}
    {!readOnly && mergingSession && <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"><div className="bg-vow-bg border border-vow-border p-6 max-w-md w-full"><h2 className="vow-heading text-lg text-vow-ink mb-2">Combine sessions</h2><p className="text-sm text-vow-muted mb-4">Choose the session to keep. The selected session receives both sets of saved actions and the source session’s notes and links. The combined duration is capped at 24 hours.</p><label className="vow-label block mb-2" htmlFor="merge-session-target">Keep this session</label><select id="merge-session-target" value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)} className="w-full border border-vow-border bg-transparent px-3 py-3 text-sm text-vow-ink mb-5">{sessions.filter((candidate) => candidate.id !== mergingSession.id && candidate.status === 'scheduled').map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title} · {formatDate(candidate.scheduled_at)} · {candidate.duration_minutes} min</option>)}</select><div className="flex gap-3"><button onClick={() => { setMergingSession(null); setMergeTargetId(''); }} className="vow-btn-ghost" disabled={mergeBusy}>Cancel</button><button onClick={() => { const target = sessions.find((candidate) => candidate.id === mergeTargetId); if (target) void mergeSessions(mergingSession, target); }} className="vow-btn-primary flex-1" disabled={mergeBusy || !mergeTargetId}>{mergeBusy ? 'Combining…' : 'Confirm combination'}</button></div></div></div>}{!readOnly && editingSession && <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"><div className="bg-vow-bg border border-vow-border p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"><h2 className="vow-heading text-lg text-vow-ink mb-2">Adjust this session</h2><p className="text-sm text-vow-muted mb-4">{editingSession.title}. Change how and when you want to do it. Your saved actions and completion state stay intact.</p><label className="vow-label block mb-2">Scheduling</label><div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">{([{value:"timed",label:"Timed"},{value:"flexible-day",label:"Flexible day"},{value:"unscheduled",label:"Unscheduled"}] as const).map(option => <button key={option.value} type="button" aria-pressed={editTimingMode === option.value} onClick={() => setEditTimingMode(option.value)} className={editTimingMode === option.value ? "border border-vow-ink bg-vow-ink text-vow-bg px-3 py-2 text-xs" : "border border-vow-border text-vow-ink px-3 py-2 text-xs"}>{option.label}</button>)}</div>{editTimingMode === "timed" && <><label className="vow-label block mb-2" htmlFor="session-schedule-time">Date and time</label><input id="session-schedule-time" type="datetime-local" value={editScheduledAt} onChange={(event) => setEditScheduledAt(event.target.value)} className="w-full border border-vow-border bg-transparent px-3 py-3 text-sm text-vow-ink mb-4" /></>}{editTimingMode === "flexible-day" && <><label className="vow-label block mb-2" htmlFor="session-weekday">Weekday</label><select id="session-weekday" value={editDayOfWeek} onChange={(event) => setEditDayOfWeek(event.target.value)} className="w-full border border-vow-border bg-transparent px-3 py-3 text-sm text-vow-ink mb-4">{sessionDays.map(day => <option key={day} value={day}>{day}</option>)}</select><p className="text-xs text-vow-muted mb-4">No clock time or reminder is assigned.</p></>}{editTimingMode === "unscheduled" && <p className="text-xs text-vow-muted mb-4">This session will return to your queue with no assigned day or time.</p>}<label className="vow-label block mb-2" htmlFor="session-duration">Duration (minutes)</label><input id="session-duration" type="number" min="5" max="1440" step="5" value={editDurationMinutes} onChange={(event) => setEditDurationMinutes(event.target.value)} className="w-full border border-vow-border bg-transparent px-3 py-3 text-sm text-vow-ink mb-5" /><div className="flex gap-3"><button onClick={() => setEditingSession(null)} className="vow-btn-ghost">Cancel</button><button onClick={saveSessionChanges} className="vow-btn-primary flex-1">Save changes</button></div></div></div>}
    {!readOnly && showPauseModal && <div className="fixed inset-0 bg-black/20 flex items-center justify-center p-4 z-50"><div className="bg-vow-bg border border-vow-border p-6 max-w-md w-full"><h2 className="vow-heading text-lg text-vow-ink mb-2">Pause planning</h2><p className="text-sm text-vow-muted mb-4">Choose the reason that best describes what changed. VOW will save it and return you to your goals.</p><div className="space-y-2">{['Schedule changed','Need to adjust the plan','Taking a short break'].map((reason) => <button key={reason} onClick={() => handlePause(reason)} className="w-full text-left border border-vow-border px-4 py-3 text-sm hover:bg-vow-surface">{reason}</button>)}</div><button onClick={() => setShowPauseModal(false)} className="vow-btn-ghost mt-4">Cancel</button></div></div>}
  </div>;
}
