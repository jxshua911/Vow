import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Goal } from '@/types/database';

export function GoalAI({ goal }: { goal?: Goal | null }) {
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function ask() {
    const question = message.trim();
    if (!question || loading) return;
    setLoading(true);
    setError('');
    try {
      const context = goal
        ? { title: goal.title, outcome: goal.outcome, status: goal.status, deadline: goal.deadline, weekly_commitment_target: goal.weekly_commitment_target }
        : { title: 'General planning', outcome: 'No single goal selected' };
      const { data, error: invokeError } = await supabase.functions.invoke('vow-goal-ai', {
        body: {
          goal: context,
          message: question,
          scope: 'general-life-planning',
          instruction: 'VOW AI is a general planning and accountability assistant. It can help with goals, routines, decisions, projects, study, training, habits, scheduling, trade-offs and understanding what a commitment will require. Do not assume every conversation is about a goal.',
        },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setAnswer(data?.text || 'I could not generate an answer right now.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'VOW AI is unavailable right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border border-vow-border p-5 mt-10">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-vow-muted">VOW AI</p>
        <h2 className="vow-heading text-lg text-vow-ink mt-1">Think it through before you commit.</h2>
        <p className="text-xs text-vow-muted mt-1">Ask about goals, routines, projects, decisions, trade-offs, scheduling, or what a commitment will actually require.</p>
      </div>
      {answer && <div className="border-l-2 border-vow-ink pl-4 mb-4 text-sm leading-relaxed whitespace-pre-wrap text-vow-ink">{answer}</div>}
      {error && <p className="text-xs text-vow-muted mb-3">{error}</p>}
      <div className="flex flex-col sm:flex-row gap-2">
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') ask(); }} rows={2} placeholder="e.g. What would this commitment require from my week?" className="flex-1 border border-vow-border bg-transparent px-3 py-2 text-sm text-vow-ink outline-none resize-none" />
        <button onClick={ask} disabled={loading || !message.trim()} className="min-h-11 border border-vow-ink px-4 text-xs text-vow-ink disabled:opacity-50">{loading ? 'Thinking…' : 'Ask VOW AI'}</button>
      </div>
    </section>
  );
}
