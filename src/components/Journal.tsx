import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { JournalEntry, Goal } from '@/types/database';
import { formatDateLong } from '@/lib/dates';
import { PageHeader, NewButton } from './AppShell';

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return <div className="fixed inset-0 bg-black/20 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-label={title}><div className="bg-vow-bg border border-vow-border p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto"><div className="flex items-center justify-between mb-6"><h2 className="vow-heading text-lg text-vow-ink">{title}</h2><button type="button" onClick={onClose} className="text-vow-muted hover:text-vow-ink text-lg leading-none" aria-label="Close">×</button></div>{children}</div></div>;
}

export function JournalPage({ embedded = false }: { embedded?: boolean }) {
  const { session } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    const [entriesRes, goalsRes] = await Promise.all([
      supabase.from('journal_entries').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
      supabase.from('goals').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
    ]);
    if (entriesRes.error) setActionError(entriesRes.error.message);
    if (goalsRes.error) setActionError(goalsRes.error.message);
    setEntries((entriesRes.data || []) as JournalEntry[]);
    setGoals((goalsRes.data || []) as Goal[]);
    setLoading(false);
  }, [session]);

  useEffect(() => { load().catch((err) => setActionError(err instanceof Error ? err.message : 'Could not load your journal.')); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this journal entry? This cannot be undone.')) return;
    setActionError('');
    const { error } = await supabase.from('journal_entries').delete().eq('id', id).eq('user_id', session?.user.id || '');
    if (error) { setActionError(error.message); return; }
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  async function handleCreate(body: string, tag: string | null, linkedGoalId: string | null) {
    if (!session) return;
    setActionError('');
    const { data, error } = await supabase.from('journal_entries').insert({ user_id: session.user.id, body, tag, linked_goal_id: linkedGoalId }).select('*').maybeSingle();
    if (error) { setActionError(error.message); return; }
    if (data) setEntries((current) => [data as JournalEntry, ...current]);
    setShowCompose(false);
  }

  if (loading) return <div>{!embedded && <PageHeader title="Journal" />}<div className="text-vow-muted text-sm">Loading...</div></div>;
  const activeGoals = goals.filter((goal) => goal.status === 'active' || goal.status === 'locked');
  const promptGoal = activeGoals[0];
  const prompt = promptGoal ? `What did you do today that moved “${promptGoal.outcome}” forward? What got in the way, and what will you change next?` : null;
  const entryCtaLabel = entries.length > 0 ? 'New Journal Entry' : 'Create Journal Entry';
  return <div>
    {embedded ? <div className="flex items-start justify-between gap-4 mb-8"><div><h2 className="vow-heading text-2xl text-vow-ink mb-1">Journal</h2><p className="text-xs text-vow-muted">Reflect honestly and keep the story behind your commitments.</p></div><NewButton onClick={() => { setActionError(''); setShowCompose(true); }} label={entryCtaLabel} /></div> : <PageHeader title="Journal" subtitle="Reflect honestly. Link the reflection to the commitment it belongs to." action={<NewButton onClick={() => { setActionError(''); setShowCompose(true); }} label={entryCtaLabel} />} />}
    <p className="text-xs text-vow-muted mb-8 leading-relaxed max-w-xl">Your journal is private. Entries stay in your account. Link reflections to goals so VOW can show the story behind progress, setbacks and completed commitments.</p>
    {actionError && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3 mb-6 break-words">{actionError}</p>}
    {prompt && !embedded && <section className="border border-vow-border p-5 mb-8"><p className="vow-label mb-2">Reflect on your active goal</p><p className="text-sm text-vow-ink leading-relaxed break-words">{prompt}</p></section>}
    {entries.length === 0 ? <div className="border-t border-vow-border pt-12 text-center"><p className="vow-heading text-xl text-vow-ink mb-2">No journal entries yet</p><p className="text-vow-muted text-sm">Use the <span className="text-vow-ink font-medium">{entryCtaLabel}</span> button above to write your first reflection.</p></div> : <div className="border-t border-vow-border">{entries.map((entry) => { const linkedGoal = goals.find((g) => g.id === entry.linked_goal_id); return <div key={entry.id} className="border-b border-vow-border py-6 group"><div className="flex items-start justify-between gap-3 mb-3"><div className="text-xs text-vow-muted">{formatDateLong(entry.created_at)}</div><button onClick={() => handleDelete(entry.id)} className="opacity-0 group-hover:opacity-100 text-vow-muted hover:text-vow-ink transition-all" aria-label="Delete entry">Delete</button></div><p className="text-sm text-vow-ink whitespace-pre-wrap leading-relaxed break-words">{entry.body}</p><div className="flex items-center gap-3 mt-3 flex-wrap">{entry.tag && <span className="text-xs text-vow-muted border border-vow-border px-2 py-0.5">{entry.tag}</span>}{linkedGoal && <span className="text-xs text-vow-ink border-b border-vow-border break-words">{linkedGoal.outcome}</span>}</div></div>; })}</div>}
    {showCompose && <ComposeModal goals={goals} titleLabel={entryCtaLabel} onCreate={handleCreate} onClose={() => setShowCompose(false)} />}
  </div>;
}

function ComposeModal({ goals, titleLabel, onCreate, onClose }: { goals: Goal[]; titleLabel: string; onCreate: (body: string, tag: string | null, linkedGoalId: string | null) => Promise<void>; onClose: () => void }) {
  const [body, setBody] = useState(''); const [tag, setTag] = useState(''); const [linkedGoalId, setLinkedGoalId] = useState<string | null>(null); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const selectedGoal = goals.find((goal) => goal.id === linkedGoalId);
  async function handleSubmit(e: React.FormEvent) { e.preventDefault(); if (!body.trim() || saving) return; setSaving(true); setError(''); try { await onCreate(body.trim(), tag.trim() || null, linkedGoalId); } catch (err) { setError(err instanceof Error ? err.message : 'Could not save reflection.'); } finally { setSaving(false); } }
  return <Modal onClose={onClose} title={titleLabel}><form onSubmit={handleSubmit} className="space-y-5"><div><label className="vow-label block mb-2">Entry</label><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={12000} required autoFocus className="vow-input resize-none" placeholder={selectedGoal ? `Reflect on “${selectedGoal.outcome}”…` : 'Write freely...'} disabled={saving} /></div><div><label className="vow-label block mb-2">Link to goal</label><select value={linkedGoalId || ''} onChange={(e) => setLinkedGoalId(e.target.value || null)} className="vow-input" disabled={saving}><option value="">No goal — private reflection</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.outcome}{g.status === 'abandoned' ? ' — abandoned' : g.status === 'completed' ? ' — completed' : g.status === 'locked' ? ' — locked' : ''}</option>)}</select><p className="text-[11px] text-vow-muted mt-2">All of your goals are available here, including completed and abandoned goals.</p></div><div><label className="vow-label block mb-2">Tag (optional)</label><input value={tag} onChange={(e) => setTag(e.target.value)} maxLength={80} className="vow-input" placeholder="e.g. reflection" disabled={saving} /></div>{error && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">{error}</p>}<div className="flex gap-3 pt-2"><button type="button" onClick={onClose} disabled={saving} className="vow-btn-ghost">Cancel</button><button type="submit" disabled={saving || !body.trim()} className="vow-btn-primary flex-1">{saving ? 'Saving…' : 'Save reflection'}</button></div></form></Modal>;
}
