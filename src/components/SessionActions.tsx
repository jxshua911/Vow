import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Session, SessionAction } from '@/types/database';
import { cancelReminder, notificationId, scheduleReminder } from '@/lib/notifications';

type PlannedActionSeed = { title: string; instructions?: string; sets?: number | null; reps?: string | null; duration_minutes?: number | null; rest_seconds?: number | null; substeps: string[] };

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
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editSets, setEditSets] = useState('');
  const [editReps, setEditReps] = useState('');
  const [editRest, setEditRest] = useState('');

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
    // One-time conversion: preserve the generated action tree as a parent task,
    // named actions, and nested substeps with their structured training details.
    if (rows.length === 0 && !readOnly) {
      const noteLines = (currentSession.notes || '').split('\n');
      const taskTitle = noteLines.find((line) => line.startsWith('Task: '))?.slice(6).trim() || currentSession.title;
      const purpose = noteLines.find((line) => line.startsWith('Purpose: '))?.slice(9).trim();
      const target = noteLines.find((line) => line.startsWith('Target: '))?.slice(8).trim();
      const actionTreeLine = noteLines.find((line) => line.startsWith('Action tree: '))?.slice('Action tree: '.length);
      let actionTree: PlannedActionSeed[] = [];
      try {
        const parsed: unknown = JSON.parse(actionTreeLine || '[]');
        if (Array.isArray(parsed)) {
          actionTree = parsed.flatMap((value): PlannedActionSeed[] => {
            if (!value || typeof value !== 'object') return [];
            const record = value as Record<string, unknown>;
            if (typeof record.title !== 'string' || !record.title.trim()) return [];
            const substeps = Array.isArray(record.substeps)
              ? record.substeps.filter((step): step is string => typeof step === 'string' && Boolean(step.trim())).map((step) => step.trim()).slice(0, 8)
              : [];
            const sets = Number(record.sets);
            const duration = Number(record.duration_minutes);
            const rest = Number(record.rest_seconds);
            return [{
              title: record.title.trim().slice(0, 160),
              instructions: typeof record.instructions === 'string' ? record.instructions.trim().slice(0, 500) : undefined,
              sets: Number.isFinite(sets) && sets > 0 ? Math.min(100, Math.round(sets)) : null,
              reps: typeof record.reps === 'string' ? record.reps.trim().slice(0, 80) : null,
              duration_minutes: Number.isFinite(duration) && duration > 0 ? Math.min(240, Math.round(duration)) : null,
              rest_seconds: Number.isFinite(rest) && rest >= 0 ? Math.min(3600, Math.round(rest)) : null,
              substeps,
            }];
          }).slice(0, 8);
        }
      } catch {
        // Older notes contain no structured action tree; fall back to numbered steps below.
      }
      const rawSteps = noteLines
        .map((line) => line.match(/^Step \d+: (.+)$/)?.[1]?.trim())
        .filter((step): step is string => Boolean(step));
      const childSteps = actionTree.length > 0 ? [] : rawSteps.filter((step) =>
        step !== taskTitle && step !== purpose && step !== target && !/^finish when:/i.test(step)
      );
      const instructions = [purpose, target ? 'Finish when: ' + target : null].filter(Boolean).join('\n') || null;
      const { data: parent, error: parentError } = await supabase
        .from('session_actions')
        .insert({
          goal_id: currentSession.goal_id,
          session_id: currentSession.id,
          user_id: authSession.user.id,
          parent_action_id: null,
          title: taskTitle,
          instructions,
          duration_minutes: currentSession.duration_minutes,
          sort_order: 0,
        })
        .select('*')
        .single();
      if (parentError || !parent) {
        console.error('[VOW] Could not convert the session plan into actions:', parentError);
        setError('This session’s steps could not be saved yet.');
      } else {
        rows = [parent as SessionAction];
        if (actionTree.length > 0) {
          const inserts = actionTree.map((action, index) => ({
            goal_id: currentSession.goal_id,
            session_id: currentSession.id,
            user_id: authSession.user.id,
            parent_action_id: parent.id,
            title: action.title,
            instructions: action.instructions || null,
            sets: action.sets ?? null,
            reps: action.reps ?? null,
            duration_minutes: action.duration_minutes ?? null,
            rest_seconds: action.rest_seconds ?? null,
            sort_order: index,
          }));
          const { data: children, error: childError } = await supabase
            .from('session_actions')
            .insert(inserts)
            .select('*')
            .order('sort_order', { ascending: true });
          if (childError) {
            console.error('[VOW] Could not save generated actions:', childError);
            setError('The main session was saved, but some actions could not be saved. Add the missing actions in the session editor.');
          } else {
            const childRows = (children || []) as SessionAction[];
            rows = [parent as SessionAction, ...childRows];
            const grandchildInserts = childRows.flatMap((child, index) =>
              actionTree[index].substeps.map((title, subIndex) => ({
                goal_id: currentSession.goal_id,
                session_id: currentSession.id,
                user_id: authSession.user.id,
                parent_action_id: child.id,
                title,
                sort_order: subIndex,
              }))
            );
            if (grandchildInserts.length > 0) {
              const { data: grandChildren, error: grandchildError } = await supabase
                .from('session_actions')
                .insert(grandchildInserts)
                .select('*')
                .order('sort_order', { ascending: true });
              if (grandchildError) {
                console.error('[VOW] Could not save generated nested substeps:', grandchildError);
                setError('The actions were saved, but some nested substeps could not be saved. Add them from the session editor.');
              } else {
                rows = [...rows, ...((grandChildren || []) as SessionAction[])];
              }
            }
          }
        } else if (childSteps.length > 0) {
          const inserts = childSteps.map((title, index) => ({
            goal_id: currentSession.goal_id,
            session_id: currentSession.id,
            user_id: authSession.user.id,
            parent_action_id: parent.id,
            title,
            sort_order: index,
          }));
          const { data: children, error: childError } = await supabase
            .from('session_actions')
            .insert(inserts)
            .select('*');
          if (childError) {
            console.error('[VOW] Could not save legacy child steps:', childError);
            setError('The main session was saved, but some substeps could not be saved. Add them from the session editor.');
          } else {
            rows = [parent as SessionAction, ...((children || []) as SessionAction[])];
          }
        }
      }
    }
    setActions(rows);
    setLoading(false);
  }, [authSession?.user?.id, currentSession.id, currentSession.goal_id, currentSession.notes, currentSession.title, currentSession.duration_minutes, readOnly]);

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
      let reminderWarning = false;
      try {
        if (nextStatus === 'completed') {
          await cancelReminder(notificationId(action.id));
        } else if (action.scheduled_at && new Date(action.scheduled_at).getTime() > Date.now()) {
          await scheduleReminder(notificationId(action.id), `VOW · ${action.title.slice(0, 48)}`, `Action for ${currentSession.title}`, new Date(action.scheduled_at), currentSession.id, 'action');
        }
      } catch (reminderError) {
        reminderWarning = true;
        console.error('[VOW] Action completion saved but its reminder could not be synchronized:', reminderError);
      }
      const completedAt = nextStatus === 'completed' ? new Date().toISOString() : null;
      setActions((existing) => existing.map((item) => item.id === action.id ? { ...item, status: nextStatus, completed_at: completedAt } : item));
      if (reminderWarning) setError('The step was updated, but its reminder could not be synchronized. Check notification permissions.');
    }
    setBusyId(null);
  }

  function beginEditAction(action: SessionAction) {
    setEditingActionId(action.id);
    setEditTitle(action.title);
    setEditInstructions(action.instructions || '');
    setEditDuration(action.duration_minutes == null ? '' : String(action.duration_minutes));
    setEditSets(action.sets == null ? '' : String(action.sets));
    setEditReps(action.reps || '');
    setEditRest(action.rest_seconds == null ? '' : String(action.rest_seconds));
  }

  async function saveActionDetails(action: SessionAction) {
    if (!authSession?.user?.id || readOnly) return;
    if (!editTitle.trim()) { setError('Give this action a clear name before saving.'); return; }
    const duration = editDuration.trim() ? Number(editDuration) : null;
    const sets = editSets.trim() ? Number(editSets) : null;
    const rest = editRest.trim() ? Number(editRest) : null;
    if ((duration !== null && (!Number.isInteger(duration) || duration < 0 || duration > 1440)) ||
        (sets !== null && (!Number.isInteger(sets) || sets < 1 || sets > 1000)) ||
        (rest !== null && (!Number.isInteger(rest) || rest < 0 || rest > 86400))) {
      setError('Enter valid non-negative duration/rest values and a positive set count.');
      return;
    }
    const patch = {
      title: editTitle.trim().slice(0, 300),
      instructions: editInstructions.trim() || null,
      duration_minutes: duration,
      sets,
      reps: editReps.trim() || null,
      rest_seconds: rest,
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = await supabase.from('session_actions').update(patch).eq('id', action.id).eq('user_id', authSession.user.id);
    if (saveError) {
      console.error('[VOW] Could not save action details:', saveError);
      setError('VOW could not save these action details. Please try again.');
      return;
    }
    setActions((existing) => existing.map((item) => item.id === action.id ? { ...item, ...patch } : item));
    setEditingActionId(null);
    setError(null);
  }

  async function scheduleAction(action: SessionAction, value: string) {
    if (readOnly || !authSession?.user?.id) return;
    const nextDate = value ? new Date(value) : null;
    if (value && (!nextDate || !Number.isFinite(nextDate.getTime()))) {
      setError('Choose a valid date and time.');
      return;
    }
    if (nextDate && nextDate.getTime() <= Date.now()) {
      setError('Choose a future date and time so VOW can remind you before the step.');
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
    let reminderWarning = false;
    try {
      if (nextDate && action.status !== 'completed') {
        await scheduleReminder(notificationId(action.id), `VOW · ${action.title.slice(0, 48)}`, `Action for ${currentSession.title}`, nextDate, currentSession.id, 'action');
      } else {
        await cancelReminder(notificationId(action.id));
      }
    } catch (reminderError) {
      reminderWarning = true;
      console.error('[VOW] Action schedule saved but its reminder could not be synchronized:', reminderError);
    }
    setActions((existing) => existing.map((item) => item.id === action.id ? { ...item, scheduled_at: nextDate?.toISOString() || null } : item));
    setError(reminderWarning ? 'The step schedule was saved, but its reminder could not be synchronized. Check notification permissions.' : null);
  }

  async function moveAction(action: SessionAction, direction: -1 | 1) {
    if (readOnly || !authSession?.user?.id || busyId) return;
    const siblings = actions
      .filter((item) => item.parent_action_id === action.parent_action_id)
      .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    const index = siblings.findIndex((item) => item.id === action.id);
    const target = siblings[index + direction];
    if (index < 0 || !target) return;

    const previous = actions;
    const reordered = [...siblings];
    [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
    const orderById = new Map(reordered.map((item, order) => [item.id, order]));
    setActions((existing) => existing.map((item) => orderById.has(item.id)
      ? { ...item, sort_order: orderById.get(item.id)! }
      : item));
    setBusyId(action.id);
    setError(null);

    const updates = await Promise.all(reordered
      .filter((item, order) => item.sort_order !== order)
      .map((item) => supabase.from('session_actions')
        .update({ sort_order: orderById.get(item.id), updated_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('user_id', authSession.user.id)));
    const failed = updates.some((result) => result.error);
    if (failed) {
      console.error('[VOW] Could not persist session action order:', updates.find((result) => result.error)?.error);
      setActions(previous);
      setError('The step order could not be saved. Your previous order has been restored.');
    }
    setBusyId(null);
  }

  function renderAction(action: SessionAction, depth = 0) {
    const children = actions.filter((item) => item.parent_action_id === action.id);
    const expanded = expandedId === action.id;
    return <div key={action.id} className={depth ? 'ml-5 mt-2 border-l border-vow-border pl-3' : 'mt-3'}>
      <div className="flex items-start gap-2">
        {children.length === 0 && <input aria-label={`Mark ${action.title} complete`} type="checkbox" checked={action.status === 'completed'} disabled={readOnly || busyId === action.id} onChange={() => void toggleAction(action)} className="mt-1 accent-current" />}
        <div className="min-w-0 flex-1">
          <p className={`text-sm break-words ${action.status === 'completed' ? 'line-through text-vow-muted' : 'text-vow-ink'}`}>{action.title}</p>
          {children.length === 0 && action.duration_minutes != null && <p className="text-xs text-vow-muted mt-1">{action.duration_minutes} min{action.sets ? ` · ${action.sets} sets` : ''}{action.reps ? ` · ${action.reps}` : ''}{action.rest_seconds ? ` · ${action.rest_seconds}s rest` : ''}</p>}
          {children.length === 0 && action.instructions && <p className="text-xs text-vow-muted mt-2 whitespace-pre-wrap break-words">{action.instructions}</p>}
          {action.scheduled_at && <p className="text-xs text-vow-muted mt-1">Step scheduled: {new Date(action.scheduled_at).toLocaleString()}</p>}
          {!readOnly && <div className="flex flex-wrap gap-2 mt-2">
            {(() => {
              const siblings = actions.filter((item) => item.parent_action_id === action.parent_action_id)
                .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
              const index = siblings.findIndex((item) => item.id === action.id);
              return <>
                <button type="button" aria-label={`Move ${action.title} up`} title="Move up" disabled={index <= 0 || busyId !== null} className="text-xs underline underline-offset-2 text-vow-muted disabled:opacity-30" onClick={() => void moveAction(action, -1)}>Move up</button>
                <button type="button" aria-label={`Move ${action.title} down`} title="Move down" disabled={index < 0 || index >= siblings.length - 1 || busyId !== null} className="text-xs underline underline-offset-2 text-vow-muted disabled:opacity-30" onClick={() => void moveAction(action, 1)}>Move down</button>
              </>;
            })()}
            <button type="button" className="text-xs underline underline-offset-2 text-vow-muted" onClick={() => { setExpandedId(expanded ? null : action.id); setChildTitle(''); }}>{expanded ? 'Close substeps' : 'Add substep'}</button>
            <button type="button" className="text-xs underline underline-offset-2 text-vow-muted" onClick={() => beginEditAction(action)}>Edit details</button>
            <label className="text-xs underline underline-offset-2 text-vow-muted cursor-pointer">
              {action.scheduled_at ? 'Change step time' : 'Schedule this step'}
              <input aria-label={`Schedule ${action.title}`} type="datetime-local" value={localDateTimeValue(action.scheduled_at)} onChange={(event) => void scheduleAction(action, event.target.value)} className="block mt-1 max-w-full border border-vow-border bg-transparent px-2 py-1 text-xs" />
            </label>
            {action.scheduled_at && <button type="button" className="text-xs underline underline-offset-2 text-vow-muted" onClick={() => void scheduleAction(action, '')}>Use session time</button>}
          </div>}
          {editingActionId === action.id && !readOnly && <form className="grid grid-cols-2 gap-2 mt-3" onSubmit={(event) => { event.preventDefault(); void saveActionDetails(action); }}>
            <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="Action name" className="col-span-2 border border-vow-border bg-transparent px-3 py-2 text-xs text-vow-ink" maxLength={300} />
            <textarea value={editInstructions} onChange={(event) => setEditInstructions(event.target.value)} placeholder="Instructions" className="col-span-2 border border-vow-border bg-transparent px-3 py-2 text-xs text-vow-ink" rows={3} maxLength={2000} />
            <input type="number" min="0" max="1440" value={editDuration} onChange={(event) => setEditDuration(event.target.value)} placeholder="Minutes" className="border border-vow-border bg-transparent px-2 py-2 text-xs text-vow-ink" />
            <input type="number" min="1" max="1000" value={editSets} onChange={(event) => setEditSets(event.target.value)} placeholder="Sets" className="border border-vow-border bg-transparent px-2 py-2 text-xs text-vow-ink" />
            <input value={editReps} onChange={(event) => setEditReps(event.target.value)} placeholder="Reps / target" maxLength={120} className="border border-vow-border bg-transparent px-2 py-2 text-xs text-vow-ink" />
            <input type="number" min="0" max="86400" value={editRest} onChange={(event) => setEditRest(event.target.value)} placeholder="Rest seconds" className="border border-vow-border bg-transparent px-2 py-2 text-xs text-vow-ink" />
            <div className="col-span-2 flex gap-2"><button type="button" className="vow-btn-ghost text-xs" onClick={() => setEditingActionId(null)}>Cancel</button><button type="submit" className="vow-btn-soft text-xs">Save details</button></div>
          </form>}
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
  const actionableActions = actions.filter((action) => !actions.some((child) => child.parent_action_id === action.id));
  const completedCount = actionableActions.filter((action) => action.status === 'completed').length;

  return <section className="mt-4 rounded-md border border-vow-border p-3">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-vow-muted">Action checklist</h3>
      <span className="text-xs text-vow-muted">{completedCount}/{actionableActions.length} complete</span>
    </div>
    {loading ? <p className="text-xs text-vow-muted mt-3">Loading saved actions…</p> : roots.length ? roots.map((action) => renderAction(action)) : <p className="text-xs text-vow-muted mt-3">Break this session into steps to track the work, one action at a time.</p>}
    {!readOnly && <form className="flex gap-2 mt-4" onSubmit={(event) => { event.preventDefault(); void addAction(newActionTitle); }}>
      <input value={newActionTitle} onChange={(event) => setNewActionTitle(event.target.value)} placeholder="Add an actionable step" className="min-w-0 flex-1 border border-vow-border bg-transparent px-3 py-2 text-sm text-vow-ink" maxLength={300} />
      <button type="submit" className="vow-btn-soft text-xs" disabled={!newActionTitle.trim()}>Add step</button>
    </form>}
    {error && <p role="alert" className="text-xs text-red-600 mt-3">{error}</p>}
  </section>;
}
