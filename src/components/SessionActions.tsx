import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Session, SessionAction } from '@/types/database';
import { cancelReminder, notificationId, scheduleReminder } from '@/lib/notifications';

interface SessionActionsProps {
  session: Session;
  readOnly?: boolean;
}

function localDateTimeValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function SessionActions({ session: currentSession, readOnly = false }: SessionActionsProps) {
  const { session: authSession } = useAuth();
  const [actions, setActions] = useState<SessionAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newActionTitle, setNewActionTitle] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [childTitle, setChildTitle] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadActions = useCallback(async () => {
    if (!authSession?.user?.id) {
      setActions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('session_actions')
      .select('*')
      .eq('session_id', currentSession.id)
      .eq('user_id', authSession.user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (loadError) {
      console.error('[VOW] Could not load session actions:', loadError);
      setError('Actions could not be loaded. Please refresh and try again.');
      setLoading(false);
      return;
    }

    let rows = (data || []) as SessionAction[];
    // One-time, idempotent conversion of legacy numbered steps into persistent actions.
    if (rows.length === 0 && !readOnly) {
      const legacySteps = (currentSession.notes || '').split('\\n')
        .map((line) => line.match(/^Step \\d+: (.+)$/)?.[1]?.trim())
        .filter((step): step is string => Boolean(step));
      if (legacySteps.length > 0) {
        const inserts = legacySteps.map((title, index) => ({
          goal_id: currentSession.goal_id,
          session_id: currentSession.id,
          user_id: authSession.user.id,
          title,
          sort_order: index,
        }));
        const { data: seeded, error: seedError } = await supabase
          .from('session_actions')
          .insert(inserts)
          .select('*');
        if (seedError) {
          console.error('[VOW] Could not migrate legacy session steps:', seedError);
          setError('This session’s steps could not be saved yet.');
        } else {
          rows = (seeded || []) as SessionAction[];
        }
      }
    }
    setActions(rows);
    setLoading(false);
  }, [authSession?.user?.id, currentSession.id, currentSession.goal_id, currentSession.notes, readOnly]);

  useEffect(() => { void loadActions(); }, [loadActions]);

  async function addAction(title: string, parentActionId: string | null = null) {
    if (!authSession?.user?.id || readOnly || !title.trim()) return;
    setError(null);
    const siblings = actions.filter((action) => action.parent_action_id === parentActionId);
    const { error: insertError } = await supabase.from('session_actions').insert({
      goal_id: currentSession.goal_id,
      session_id: currentSession.id,
      user_id: authSession.user.id,
      parent_action_id: parentActionId,
      title: title.trim(),
      sort_order: siblings.length,
    });
    if (insertError) {
      console.error('[VOW] Could not add session action:', insertError);
      setError('VOW could not save that step. Please try again.');
      return;
    }
    setNewActionTitle('');
    setChildTitle('');
    await loadActions();
  }

  async function toggleAction(action: SessionAction) {
    if (readOnly || !authSession?.user?.id) return;
    setBusyId(action.id);
    setError(null);
    const nextStatus = action.status === 'completed' ? 'pending' : 'completed';
    const { error: updateError } = await supabase.from('session_actions').update({
      status: nextStatus,
      completed_at: nextStatus === 'completed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', action.id).eq('user_id', authSession.user.id);
    if (updateError) {
      console.error('[VOW] Could not save action completion:', updateError);
      setError('Completion could not be saved. Please try again.');
    } else {
      setActions((existing) => existing.map((item) => item.id === action.id ? { ...item, status: nextStatus, completed_at: nextStatus === 'completed' ? new Date().toISOString() : null } : item));
    }
    setBusyId(null);
  }

  async function scheduleAction(action: SessionAction, value: string) {
    if (readOnly || !authSession?.user?.id) return;
    const nextDate = value ? new Date(value) : null;
    if (value && (!nextDate || !Number.isFinite(nextDate.getTime()))) {
      setError('Choose a valid date and time.');
      return;
    }
    const { error: updateError } = await supabase.from('session_actions').update({
      scheduled_at: nextDate ? nextDate.toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', action.id).eq('user_id', authSession.user.id);
    if (updateError) {
      console.error('[VOW] Could not reschedule action:', updateError);
      setError('VOW could not save this step’s schedule. Please try again.');
      return;
    }
    if (nextDate) await scheduleReminder(notificationId(action.id), `VOW · ${action.title.slice(0, 48)}`, `Action for ${currentSession.title}`, nextDate, action.id);
    else await cancelReminder(notificationId(action.id));
    setActions((existing) => existing.map((item) => item.id === action.id ? { ...item, scheduled_at: nextDate?.toISOString() || null } : item));
  }

  function renderAction(action: SessionAction, depth = 0) {
    const children = actions.filter((item) => item.parent_action_id === action.id);
    const expanded = expandedId === action.id;
    return <div key={action.id} className={depth ? 'ml-5 mt-2 border-l border-vow-border pl-3' : 'mt-3'}>
      <div className="flex items-start gap-2">
        <input aria-label={`Mark ${action.title} complete`} type="checkbox" checked={action.status === 'completed'} disabled={readOnly || busyId === action.id} onChange={() => void toggleAction(action)} className="mt-1 accent-current" />
        <div className="min-w-0 flex-1">
          <p className={`text-sm break-words ${action.status === 'completed' ? 'line-through text-vow-muted' : 'text-vow-ink'}`}>{action.title}</p>
          {action.duration_minutes != null && <p className="text-xs text-vow-muted mt-1">{action.duration_minutes} min{action.sets ? ` · ${action.sets} sets` : ''}{action.reps ? ` · ${action.reps}` : ''}{action.rest_seconds ? ` · ${action.rest_seconds}s rest` : ''}</p>}
          {action.scheduled_at && <p className="text-xs text-vow-muted mt-1">Step scheduled: {new Date(action.scheduled_at).toLocaleString()}</p>}
          {!readOnly && <div className="flex flex-wrap gap-2 mt-2">
            <button type="button" className="text-xs underline underline-offset-2 text-vow-muted" onClick={() => { setExpandedId(expanded ? null : action.id); setChildTitle(''); }}>{expanded ? 'Close substeps' : 'Add substep'}</button>
            <label className="text-xs underline underline-offset-2 text-vow-muted cursor-pointer">
              {action.scheduled_at ? 'Change step time' : 'Schedule this step'}
              <input aria-label={`Schedule ${action.title}`} type="datetime-local" value={localDateTimeValue(action.scheduled_at)} onChange={(event) => void scheduleAction(action, event.target.value)} className="block mt-1 max-w-full border border-vow-border bg-transparent px-2 py-1 text-xs" />
            </label>
            {action.scheduled_at && <button type="button" className="text-xs underline underline-offset-2 text-vow-muted" onClick={() => void scheduleAction(action, '')}>Use session time</button>}
          </div>}
          {expanded && !readOnly && <form className="flex gap-2 mt-3" onSubmit={(event) => { event.preventDefault(); void addAction(childTitle, action.id); }}>
            <input value={childTitle} onChange={(event) => setChildTitle(event.target.value)} placeholder="Smaller actionable step" className="min-w-0 flex-1 border border-vow-border bg-transparent px-3 py-2 text-xs text-vow-ink" maxLength={300} />
            <button type="submit" className="vow-btn-soft text-xs" disabled={!childTitle.trim()}>Add</button>
          </form>}
        </div>
      </div>
      {children.map((child) => renderAction(child, depth + 1))}
    </div>;
  }

  const roots = actions.filter((action) => !action.parent_action_id);
  const completedCount = actions.filter((action) => action.status === 'completed').length;

  return <section className="mt-4 rounded-md border border-vow-border p-3">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-vow-muted">Action checklist</h3>
      <span className="text-xs text-vow-muted">{completedCount}/{actions.length} complete</span>
    </div>
    {loading ? <p className="text-xs text-vow-muted mt-3">Loading saved actions…</p> : roots.length ? roots.map((action) => renderAction(action)) : <p className="text-xs text-vow-muted mt-3">Break this session into steps to track the work, one action at a time.</p>}
    {!readOnly && <form className="flex gap-2 mt-4" onSubmit={(event) => { event.preventDefault(); void addAction(newActionTitle); }}>
      <input value={newActionTitle} onChange={(event) => setNewActionTitle(event.target.value)} placeholder="Add an actionable step" className="min-w-0 flex-1 border border-vow-border bg-transparent px-3 py-2 text-sm text-vow-ink" maxLength={300} />
      <button type="submit" className="vow-btn-soft text-xs" disabled={!newActionTitle.trim()}>Add step</button>
    </form>}
    {error && <p role="alert" className="text-xs text-red-600 mt-3">{error}</p>}
  </section>;
}
