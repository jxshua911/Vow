import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { JournalEntry, Goal } from '@/types/database';
import { formatDateLong } from '@/lib/dates';
import { PageHeader, NewButton } from './AppShell';
import { Modal } from './Goals';
import { Link2, Trash2 } from 'lucide-react';

export function JournalPage() {
  const { session } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const [entriesRes, goalsRes] = await Promise.all([
      supabase.from('journal_entries').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
      supabase.from('goals').select('*').eq('user_id', session.user.id).in('status', ['active', 'locked', 'completed']),
    ]);
    setEntries(entriesRes.data || []);
    setGoals(goalsRes.data || []);
    setLoading(false);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this journal entry? This cannot be undone.')) return;
    await supabase.from('journal_entries').delete().eq('id', id);
    load();
  }

  async function handleCreate(body: string, tag: string | null, linkedGoalId: string | null) {
    if (!session) return;
    await supabase.from('journal_entries').insert({
      user_id: session.user.id,
      body,
      tag,
      linked_goal_id: linkedGoalId,
    });
    setShowCompose(false);
    load();
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Journal" />
        <div className="text-vow-muted text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Journal"
        subtitle="Freeform entries. Link to a goal or let the AI connect them later."
        action={<NewButton onClick={() => setShowCompose(true)} label="New entry" />}
      />

      <p className="text-xs text-vow-muted mb-10 leading-relaxed max-w-xl">
        Your journal is private. Entries are stored in your account and never sent to third-party analytics.
        In a future version, AI will link entries to goals automatically using semantic matching.
      </p>

      {entries.length === 0 ? (
        <div className="border-t border-vow-border pt-12 text-center">
          <p className="vow-heading text-xl text-vow-ink mb-2">No journal entries yet</p>
          <p className="text-vow-muted text-sm mb-6">Write freely — about progress, setbacks, or anything on your mind.</p>
          <NewButton onClick={() => setShowCompose(true)} label="Write entry" />
        </div>
      ) : (
        <div className="border-t border-vow-border">
          {entries.map((entry) => {
            const linkedGoal = goals.find((g) => g.id === entry.linked_goal_id);
            return (
              <div key={entry.id} className="border-b border-vow-border py-6 group">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="text-xs text-vow-muted">{formatDateLong(entry.created_at)}</div>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="opacity-0 group-hover:opacity-100 text-vow-muted hover:text-vow-ink transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm text-vow-ink whitespace-pre-wrap leading-relaxed">{entry.body}</p>
                <div className="flex items-center gap-3 mt-3">
                  {entry.tag && (
                    <span className="text-xs text-vow-muted border border-vow-border px-2 py-0.5">{entry.tag}</span>
                  )}
                  {linkedGoal && (
                    <span className="text-xs text-vow-ink flex items-center gap-1 border-b border-vow-border">
                      <Link2 className="w-3 h-3" />
                      {linkedGoal.outcome}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCompose && (
        <ComposeModal goals={goals} onCreate={handleCreate} onClose={() => setShowCompose(false)} />
      )}
    </div>
  );
}

function ComposeModal({ goals, onCreate, onClose }: {
  goals: Goal[];
  onCreate: (body: string, tag: string | null, linkedGoalId: string | null) => void;
  onClose: () => void;
}) {
  const [body, setBody] = useState('');
  const [tag, setTag] = useState('');
  const [linkedGoalId, setLinkedGoalId] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    onCreate(body.trim(), tag.trim() || null, linkedGoalId);
  }

  return (
    <Modal onClose={onClose} title="New journal entry">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="vow-label block mb-2">Entry</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            required
            autoFocus
            className="vow-input resize-none"
            placeholder="Write freely..."
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="vow-label block mb-2">Tag (optional)</label>
            <input value={tag} onChange={(e) => setTag(e.target.value)} className="vow-input" placeholder="e.g. reflection" />
          </div>
          <div>
            <label className="vow-label block mb-2">Link to goal</label>
            <select value={linkedGoalId || ''} onChange={(e) => setLinkedGoalId(e.target.value || null)} className="vow-input">
              <option value="">None</option>
              {goals.map((g) => <option key={g.id} value={g.id}>{g.outcome}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="vow-btn-ghost">Cancel</button>
          <button type="submit" disabled={!body.trim()} className="vow-btn-primary flex-1">Save entry</button>
        </div>
      </form>
    </Modal>
  );
}
