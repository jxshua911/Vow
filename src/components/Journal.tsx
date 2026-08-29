import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { JournalEntry, Goal } from '@/types/database';
import { formatDateLong } from '@/lib/dates';
import { PageHeader, NewButton } from './AppShell';
import { Link2, Trash2, X } from 'lucide-react';

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return <div className="fixed inset-0 bg-black/20 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-label={title}><div className="bg-white border border-vow-border p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto"><div className="flex items-center justify-between mb-6"><h2 className="vow-heading text-lg text-vow-ink">{title}</h2><button type="button" onClick={onClose} className="text-vow-muted hover:text-vow-ink" aria-label="Close"><X className="w-4 h-4" /></button></div>{children}</div></div>;
}

export function JournalPage({ embedded = false }: { embedded?: boolean }) {
  const { session } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const load = useCallback(async () => {
    if (!session) return;
    const [entriesRes, goalsRes] = await Promise.all([
      supabase.from('journal_entries').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
      supabase.from('goals').select('*').eq('user_id', session.user.id).in('status', ['active', 'locked', 'completed']).order('created_at', { ascending: false }),
    ]);
    setEntries(entriesRes.data || []); setGoals(goalsRes.data || []); setLoading(false);
  }, [session]);
  useEffect(() => { load(); }, [load]);
  async function handleDelete(id: string) { if (!confirm('Delete this journal entry? This cannot be undone.')) return; await supabase.from('journal_entries').delete().eq('id', id); load(); }
  async function handleCreate(body: string, tag: string | null, linkedGoalId: string | null) { if (!session) return; await supabase.from('journal_entries').insert({ user_id: session.user.id, body, tag, linked_goal_id: linkedGoalId }); setShowCompose(false); load(); }
  if (loading) return <div>{!embedded && <PageHeader title="Journal" />}<div className="text-vow-muted text-sm">Loading...</div></div>;
  const activeGoals = goals.filter((goal) => goal.status === 'active' || goal.status === 'locked');
  const promptGoal = activeGoals[0];
  const prompt = promptGoal ? `What did you do today that moved “${promptGoal.outcome}” forward? What got in the way, and what will you change next?` : null;
  return <div>
    {embedded ? <div className="flex items-start justify-between gap-4 mb-8"><div><h2 className="vow-heading text-2xl text-vow-ink mb-1">Journal</h2><p className="text-xs text-vow-muted">Reflect honestly and keep the story behind your commitments.</p></div><NewButton onClick={() => setShowCompose(true)} label="New entry" /></div> : <PageHeader title="Journal" subtitle="Reflect honestly. Link the reflection to the commitment it belongs to." action={<NewButton onClick={() => setShowCompose(true)} label="New entry" />} />}
    <p className="text-xs text-vow-muted mb-8 leading-relaxed max-w-xl">Your journal is private. Entries stay in your account. Link reflections to goals so VOW can show the story behind progress, setbacks and completed commitments.</p>
    {prompt && !embedded && <section className="border border-vow-border p-5 mb-8"><div className="flex items-start gap-3"><div className="w-4 h-4 mt-0.5 shrink-0 border border-vow-ink rounded-full" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="vow-label mb-2">Reflect on your active goal</p><p className="text-sm text-vow-ink leading-relaxed">{prompt}</p></div></div></section>}
    {entries.length === 0 ? <div className="border-t border-vow-border pt-12 text-center"><p className="vow-heading text-xl text-vow-ink mb-2">No journal entries yet</p><p className="text-vow-muted text-sm">Use the <span className="text-vow-ink font-medium">New entry</span> button above to write your first reflection.</p></div> : <div className="border-t border-vow-border">{entries.map((entry) => { const linkedGoal = goals.find((g) => g.id === entry.linked_goal_id); return <div key={entry.id} className="border-b border-vow-border py-6 group"><div className="flex items-start justify-between gap-3 mb-3"><div className="text-xs text-vow-muted">{formatDateLong(entry.created_at)}</div><button onClick={() => handleDelete(entry.id)} className="opacity-0 group-hover:opacity-100 text-vow-muted hover:text-vow-ink transition-all" aria-label="Delete entry"><Trash2 className="w-3.5 h-3.5" /></button></div><p className="text-sm text-vow-ink whitespace-pre-wrap leading-relaxed">{entry.body}</p><div className="flex items-center gap-3 mt-3 flex-wrap">{entry.tag && <span className="text-xs text-vow-muted border border-vow-border px-2 py-0.5">{entry.tag}</span>}{linkedGoal && <span className="text-xs text-vow-ink flex items-center gap-1 border-b border-vow-border"><Link2 className="w-3 h-3" />{linkedGoal.outcome}</span>}</div></div>; })}</div>}
    {showCompose && <ComposeModal goals={goals} onCreate={handleCreate} onClose={() => setShowCompose(false)} />}
  </div>;
}

function ComposeModal({ goals, onCreate, onClose }: { goals: Goal[]; onCreate: (body: string, tag: string | null, linkedGoalId: string | null) => void; onClose: () => void }) {
  const [body, setBody] = useState(''); const [tag, setTag] = useState(''); const [linkedGoalId, setLinkedGoalId] = useState<string | null>(null); const selectedGoal = goals.find((goal) => goal.id === linkedGoalId);
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); if (!body.trim()) return; onCreate(body.trim(), tag.trim() || null, linkedGoalId); }
  return <Modal onClose={onClose} title="New journal entry"><form onSubmit={handleSubmit} className="space-y-5"><div><label className="vow-label block mb-2">Entry</label><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} required autoFocus className="vow-input resize-none" placeholder={selectedGoal ? `Reflect on “${selectedGoal.outcome}”…` : 'Write freely...'} /></div><div><label className="vow-label block mb-2">Link to goal</label><select value={linkedGoalId || ''} onChange={(e) => setLinkedGoalId(e.target.value || null)} className="vow-input"><option value="">No goal — private reflection</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.outcome}</option>)}</select></div><div><label className="vow-label block mb-2">Tag (optional)</label><input value={tag} onChange={(e) => setTag(e.target.value)} className="vow-input" placeholder="e.g. reflection" /></div><div className="flex gap-3 pt-2"><button type="button" onClick={onClose} className="vow-btn-ghost">Cancel</button><button type="submit" disabled={!body.trim()} className="vow-btn-primary flex-1">Save reflection</button></div></form></Modal>;
}
