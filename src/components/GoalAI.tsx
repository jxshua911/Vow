import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { checkContentSafety } from '@/lib/contentSafety';
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
    setAnswer('');
    try {
      const safety = await checkContentSafety(question);
      if (safety.status !== 'safe') {
        setError(safety.message || 'Please reword that so the intended activity is clear.');
        if (safety.status === 'suspended' && session) await supabase.auth.signOut();
        return;
      }

      let upcoming: Session[] = [];
      if (session) {
        const start = new Date();
        const end = new Date(Date.now() + 42 * 24 * 60 * 60 * 1000);
        const { data } = await supabase.from('sessions').select('*').eq('user_id', session.user.id).gte('scheduled_at', start.toISOString()).lte('scheduled_at', end.toISOString()).order('scheduled_at', { ascending: true });
        upcoming = (data || []) as Session[];
      }
      const context = goal
        ? { title: goal.title, outcome: goal.outcome, status: goal.status, deadline: goal.deadline, weekly_commitment_target: goal.weekly_commitment_target, why_it_matters: goal.why_it_matters }
        : { title: 'General planning', outcome: 'No single goal selected' };
      let references: Array<{ url: string; title: string | null; resource_type: string }> = [];
      if (goal) {
        const { data } = await supabase.from('goal_resources').select('url,title,resource_type').eq('goal_id', goal.id).order('created_at', { ascending: true });
        references = (data || []) as Array<{ url: string; title: string | null; resource_type: string }>;
      }
      const calendar = upcoming.map((item) => ({ title: item.title, scheduled_at: item.scheduled_at, duration_minutes: item.duration_minutes, status: item.status }));
      const { data, error: invokeError } = await supabase.functions.invoke('vow-goal-ai', {
        body: {
          goal: context,
          message: question,
          scope: 'general-life-planning',
          calendar,
          references,
          instruction: 'You are VOW AI, a rigorous planning and accountability assistant. Give useful, goal-specific reasoning, not motivational filler. Do not say “define what better looks like”, “stay consistent”, “break it into smaller steps”, or similar generic coaching phrases unless you immediately replace them with concrete actions, numbers, checkpoints, or decision rules tied to this exact goal. If the goal is measurable, identify the metric and a credible baseline/target. If it is skill-based, specify practice structure and progression. If it is a project, specify deliverables, dependencies and milestones. If it is a study goal, specify topics, workload and assessment. If it is a fitness goal, specify training variables and recovery considerations without pretending certainty. Use the supplied VOW calendar to find conflicts and realistic weekly capacity. Use attached goal references as evidence of the user’s intended outcome; inspect public links when relevant. Use web research when current, specialised, empirical, or time-sensitive information would materially improve the answer, and cite or name the important sources/findings rather than pretending research was done. If critical information is missing, ask only the minimum necessary question; otherwise make a reasonable assumption and state it. Challenge unrealistic or contradictory goals instead of blindly encouraging them. Return a practical plan with: target, success metric, assumptions/baseline, milestone sequence, weekly workload, concrete actions/sessions, progression, checkpoints, risks and fallback rules. Be concise, specific and age-appropriate.',
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
        <p className="text-xs text-vow-muted mt-1">Ask about goals, routines, projects, decisions, trade-offs, scheduling, or what a commitment will actually require. VOW AI can use your calendar and the references attached to the goal.</p>
      </div>
      {answer && <div className="border-l-2 border-vow-ink pl-4 mb-4 text-sm leading-relaxed whitespace-pre-wrap text-vow-ink">{answer}</div>}
      {error && <p className="text-xs text-vow-muted mb-3">{error}</p>}
      <div className="flex flex-col sm:flex-row gap-2">
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') ask(); }} rows={2} placeholder="e.g. Build me a realistic plan to reach this goal." className="flex-1 border border-vow-border bg-transparent px-3 py-2 text-sm text-vow-ink outline-none resize-none" />
        <button onClick={ask} disabled={loading || !message.trim()} className="min-h-11 border border-vow-ink px-4 text-xs text-vow-ink disabled:opacity-50">{loading ? 'Checking…' : 'Ask VOW AI'}</button>
      </div>
    </section>
  );
}
