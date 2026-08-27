import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Goal, Session } from '@/types/database';

function readAIText(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const value = data as Record<string, unknown>;
  if (typeof value.text === 'string') return value.text.trim();
  if (typeof value.output_text === 'string') return value.output_text.trim();
  if (typeof value.response === 'string') return value.response.trim();
  return '';
}

export function GoalAI({ goal }: { goal?: Goal | null }) {
  const { session } = useAuth();
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
      let upcoming: Session[] = [];
      if (session) {
        const start = new Date();
        const end = new Date(Date.now() + 42 * 24 * 60 * 60 * 1000);
        const { data } = await supabase.from('sessions').select('*').eq('user_id', session.user.id).gte('scheduled_at', start.toISOString()).lte('scheduled_at', end.toISOString()).order('scheduled_at', { ascending: true });
        upcoming = (data || []) as Session[];
      }
      const context = goal
        ? { title: goal.title, outcome: goal.outcome, status: goal.status, deadline: goal.deadline, weekly_commitment_target: goal.weekly_commitment_target }
        : { title: 'General planning', outcome: 'No single goal selected' };
      const calendar = upcoming.map((item) => ({ title: item.title, scheduled_at: item.scheduled_at, duration_minutes: item.duration_minutes, status: item.status }));
      const { data, error: invokeError } = await supabase.functions.invoke('vow-goal-ai', {
        body: {
          goal: context,
          message: question,
          scope: 'general-life-planning',
          calendar,
          instruction: 'You are VOW AI, a general planning and accountability assistant, not a goal-only chatbot. Help with goals, routines, decisions, projects, study, training, habits, scheduling, trade-offs and understanding what a commitment will require. Use the supplied VOW calendar when useful. When evaluating a new commitment, explain its requirements, likely weekly shape, conflicts, trade-offs and a credible plan rather than blindly encouraging it. Be practical, concise, honest about uncertainty and age-appropriate.',
        },
      });
      if (invokeError) throw new Error('VOW AI could not complete that request.');
      if (data && typeof data === 'object' && 'error' in data && typeof (data as Record<string, unknown>).error === 'string') throw new Error('VOW AI is temporarily unavailable.');
      const text = readAIText(data);
      if (!text) throw new Error('VOW AI did not return a usable response.');
      setAnswer(text);
    } catch (err) {
      setAnswer('');
      setError(err instanceof Error ? err.message : 'VOW AI is temporarily unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border border-vow-border p-5 mt-10">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-vow-muted">VOW AI</p>
        <h2 className="vow-heading text-lg text-vow-ink mt-1">Think it through before you commit.</h2>
        <p className="text-xs text-vow-muted mt-1">Ask about goals, routines, projects, decisions, trade-offs, scheduling, or what a commitment will actually require. VOW AI can use your upcoming VOW schedule when reasoning about a plan.</p>
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
