import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Session, SessionAction } from '@/types/database';

interface SessionExecutionProps {
  session: Session;
  actions: SessionAction[];
  readOnly?: boolean;
  onClose: () => void;
  onCompleted: () => void;
}
type ExecutableItem = { action: SessionAction; path: string[] };
const keyFor = (actionId: string, setNumber: number) => `${actionId}:${setNumber}`;

function flattenActions(actions: SessionAction[]): ExecutableItem[] {
  const result: ExecutableItem[] = [];
  const visit = (parentId: string | null, path: string[]) => {
    const children = actions.filter(action => action.parent_action_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    for (const action of children) {
      const isRest = action.action_type === 'rest' || action.action_type === 'break';
      const isGroup = action.action_type === 'category' || action.action_type === 'group';
      const childPath = isGroup ? [...path, action.title] : path;
      if (isRest) result.push({ action, path });
      else if (actions.some(item => item.parent_action_id === action.id)) visit(action.id, childPath);
      else result.push({ action, path });
    }
  };
  visit(null, []);
  return result;
}

export function SessionExecution({ session, actions, readOnly = false, onClose, onCompleted }: SessionExecutionProps) {
  const { session: authSession } = useAuth();
  const userId = authSession?.user?.id;
  const items = useMemo(() => flattenActions(actions), [actions]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadProgress() {
      if (!userId) { setCompleted(new Set()); setLoading(false); return; }
      const { data, error: loadError } = await supabase.from('session_action_completions')
        .select('action_id,set_number').eq('session_id', session.id).eq('user_id', userId);
      if (cancelled) return;
      if (loadError) {
        console.error('[VOW] Could not load session progress:', loadError);
        setError('Saved session progress could not be loaded. Please retry.');
      }
      const next = new Set<string>();
      for (const row of data || []) next.add(keyFor(row.action_id, row.set_number));
      for (const action of actions) {
        if (action.status !== 'completed' || actions.some(item => item.parent_action_id === action.id)) continue;
        if (action.action_type === 'rest' || action.action_type === 'break') continue;
        if (action.sets && action.sets > 0) {
          for (let set = 1; set <= action.sets; set += 1) next.add(keyFor(action.id, set));
        } else next.add(keyFor(action.id, 0));
      }
      setCompleted(next);
      setLoading(false);
    }
    void loadProgress();
    return () => { cancelled = true; };
  }, [session.id, userId, actions]);

  useEffect(() => {
    if (!timerRunning || timerRemaining === null || timerRemaining <= 0) {
      if (timerRemaining === 0) setTimerRunning(false);
      return;
    }
    const timer = window.setTimeout(() => setTimerRemaining(value => value === null ? null : Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [timerRunning, timerRemaining]);

  const totalUnits = items.reduce((total, item) => {
    const action = item.action;
    return total + (action.action_type === 'rest' || action.action_type === 'break' ? 1 : Math.max(1, action.sets || 1));
  }, 0);
  const completedUnits = items.reduce((total, item) => {
    const action = item.action;
    if (action.action_type === 'rest' || action.action_type === 'break') return total + (completed.has(keyFor(action.id, 0)) ? 1 : 0);
    if (action.sets && action.sets > 0) {
      let count = 0;
      for (let n = 1; n <= action.sets; n += 1) if (completed.has(keyFor(action.id, n))) count += 1;
      return total + count;
    }
    return total + (completed.has(keyFor(action.id, 0)) ? 1 : 0);
  }, 0);
  const isItemComplete = (item: ExecutableItem) => {
    const action = item.action;
    if (action.action_type === 'rest' || action.action_type === 'break') return completed.has(keyFor(action.id, 0));
    if (action.sets && action.sets > 0) {
      for (let n = 1; n <= action.sets; n += 1) if (!completed.has(keyFor(action.id, n))) return false;
      return true;
    }
    return completed.has(keyFor(action.id, 0)) || action.status === 'completed';
  };
  const current = items.find(item => !isItemComplete(item)) || null;
  const action = current?.action || null;
  const isRest = Boolean(action && (action.action_type === 'rest' || action.action_type === 'break'));
  const setCount = action?.sets && action.sets > 0 ? action.sets : 1;
  let currentSet = 0;
  if (action && !isRest && action.sets && action.sets > 0) {
    currentSet = Array.from({ length: action.sets }, (_, index) => index + 1).find(n => !completed.has(keyFor(action.id, n))) || action.sets;
  }
  const allDone = items.length > 0 && completedUnits >= totalUnits;

  async function toggleCompletion(target: SessionAction, setNumber: number) {
    if (!userId || readOnly || saving) return;
    const key = keyFor(target.id, setNumber);
    const wasCompleted = completed.has(key);
    setSaving(true);
    setError(null);
    const result = wasCompleted
      ? await supabase.from('session_action_completions').delete().eq('session_id', session.id).eq('action_id', target.id).eq('set_number', setNumber).eq('user_id', userId)
      : await supabase.from('session_action_completions').upsert({
          session_id: session.id, action_id: target.id, set_number: setNumber,
          user_id: userId, completed_at: new Date().toISOString(),
        }, { onConflict: 'session_id,action_id,set_number' });
    if (result.error) {
      console.error('[VOW] Could not save set/task completion:', result.error);
      setError('Progress could not be saved. Check your connection and try again.');
      setSaving(false);
      return;
    }
    setCompleted(existing => {
      const next = new Set(existing);
      if (wasCompleted) next.delete(key); else next.add(key);
      return next;
    });
    if (wasCompleted) {
      setTimerRemaining(null);
      setTimerRunning(false);
    } else if (target.sets && target.sets > setNumber && target.rest_seconds && target.rest_seconds > 0) {
      setTimerRemaining(target.rest_seconds);
      setTimerRunning(true);
    }
    if (target.sets && target.sets > 0) {
      const allSetsDone = Array.from({ length: target.sets }, (_, index) => index + 1)
        .every(n => (n === setNumber ? !wasCompleted : completed.has(keyFor(target.id, n))));
      const { error: statusError } = await supabase.from('session_actions').update({
        status: allSetsDone ? 'completed' : 'pending',
        completed_at: allSetsDone ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', target.id).eq('session_id', session.id).eq('user_id', userId);
      if (statusError) console.warn('[VOW] Set progress saved but the action summary could not be refreshed:', statusError);
    } else if (!isRest) {
      const { error: statusError } = await supabase.from('session_actions').update({
        status: wasCompleted ? 'pending' : 'completed',
        completed_at: wasCompleted ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', target.id).eq('session_id', session.id).eq('user_id', userId);
      if (statusError) console.warn('[VOW] Task progress saved but the action summary could not be refreshed:', statusError);
    }
    setSaving(false);
  }

  async function finishSession() {
    if (!userId || readOnly || saving || !allDone) return;
    setSaving(true);
    setError(null);
    const { error: finishError } = await supabase.from('sessions').update({
      status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', session.id).eq('user_id', userId);
    if (finishError) {
      console.error('[VOW] Could not complete session:', finishError);
      setError('The session progress is saved, but VOW could not mark the session complete. Please retry.');
      setSaving(false);
      return;
    }
    setSaving(false);
    onCompleted();
  }

  return <section className="mt-4 rounded-md border border-vow-border p-4">
    <div className="flex items-start justify-between gap-3">
      <div><p className="vow-label">Session in progress</p><h3 className="vow-heading text-xl text-vow-ink mt-1">{session.title}</h3><p className="text-xs text-vow-muted mt-1">{completedUnits}/{totalUnits} steps complete · {session.duration_minutes} min planned</p></div>
      <button type="button" onClick={onClose} className="vow-btn-ghost text-xs">Close</button>
    </div>
    <div className="h-1.5 bg-vow-border mt-4 rounded-full overflow-hidden"><div className="h-full bg-vow-ink transition-all" style={{ width: `${totalUnits ? Math.min(100, completedUnits / totalUnits * 100) : 0}%` }} /></div>
    {loading ? <p className="text-sm text-vow-muted mt-4">Loading saved progress…</p> : !action ? <div className="mt-6"><h4 className="vow-heading text-lg text-vow-ink">{allDone ? 'Session complete!' : 'No executable steps yet'}</h4>{allDone && <p className="text-xs text-vow-muted mt-2">Every planned action is marked complete.</p>}{!allDone && <p className="text-xs text-vow-muted mt-2">Add actions in the session checklist before starting execution.</p>}</div> : <div className="mt-6 border border-vow-border p-4">
      {current.path.length > 0 && <p className="vow-label mb-2">{current.path.join(' / ')}</p>}
      <h4 className="vow-heading text-xl text-vow-ink">{action.title}</h4>
      {action.instructions && <p className="text-sm text-vow-muted mt-2 whitespace-pre-wrap">{action.instructions}</p>}
      {isRest ? <div className="mt-5"><p className="text-sm text-vow-muted">Break period · {Math.floor((action.rest_seconds || (action.duration_minutes || 5) * 60) / 60)} min</p>{timerRemaining === null ? <button type="button" disabled={readOnly || saving} onClick={() => { setTimerRemaining(action.rest_seconds || (action.duration_minutes || 5) * 60); setTimerRunning(true); }} className="vow-btn-primary mt-3">Start break</button> : <><p className="text-4xl tabular-nums text-vow-ink mt-3">{Math.floor(timerRemaining / 60)}:{String(timerRemaining % 60).padStart(2, '0')}</p><div className="flex flex-wrap gap-2 mt-3">{timerRemaining > 0 && <button type="button" onClick={() => setTimerRunning(value => !value)} className="vow-btn-soft">{timerRunning ? 'Pause' : 'Resume'}</button>}{timerRemaining > 0 && <button type="button" onClick={() => { setTimerRemaining(0); setTimerRunning(false); }} className="vow-btn-ghost">Skip timer</button>}{timerRemaining === 0 && <button type="button" disabled={readOnly || saving} onClick={() => void toggleCompletion(action, 0)} className="vow-btn-primary">Complete break</button>}</div></>}</div>
      : action.sets && action.sets > 0 ? <div className="mt-5"><p className="text-sm text-vow-muted mb-3">Set {currentSet} of {setCount}{action.reps ? ` · ${action.reps} reps/target` : ''}</p><div className="flex flex-wrap gap-2">{Array.from({ length: setCount }, (_, index) => index + 1).map(number => { const checked = completed.has(keyFor(action.id, number)); return <label key={number} className={`flex items-center gap-2 border px-3 py-2 text-sm ${checked ? 'border-vow-ink bg-vow-ink text-vow-bg' : 'border-vow-border text-vow-ink'}`}><input type="checkbox" checked={checked} disabled={readOnly || saving} onChange={() => void toggleCompletion(action, number)} />Set {number}</label>; })}</div>{timerRemaining !== null && <div className="mt-4 border border-vow-border p-3"><p className="text-xs text-vow-muted">Rest before the next set</p><p className="text-3xl tabular-nums text-vow-ink mt-1">{Math.floor(timerRemaining / 60)}:{String(timerRemaining % 60).padStart(2, '0')}</p><div className="flex gap-2 mt-2">{timerRemaining > 0 && <button type="button" onClick={() => setTimerRunning(value => !value)} className="vow-btn-soft text-xs">{timerRunning ? 'Pause' : 'Resume'}</button>}{timerRemaining > 0 && <button type="button" onClick={() => { setTimerRemaining(0); setTimerRunning(false); }} className="vow-btn-ghost text-xs">Skip rest</button>}{timerRemaining === 0 && <button type="button" onClick={() => setTimerRemaining(null)} className="vow-btn-primary text-xs">Continue</button>}</div></div>}</div>
      : <div className="mt-5"><p className="text-sm text-vow-muted">Completion target</p><button type="button" disabled={readOnly || saving} onClick={() => void toggleCompletion(action, 0)} className="vow-btn-primary mt-3">{completed.has(keyFor(action.id, 0)) ? 'Mark incomplete' : 'Complete task'}</button></div>}
    </div>}
    {error && <p role="alert" className="text-sm text-red-600 mt-4">{error}</p>}
    <div className="flex flex-wrap gap-2 mt-5"><button type="button" onClick={onClose} className="vow-btn-ghost">Back to session</button><button type="button" disabled={readOnly || saving || !allDone} onClick={() => void finishSession()} className="vow-btn-primary disabled:opacity-40">{saving ? 'Saving…' : 'Finish session'}</button></div>
  </section>;
}
