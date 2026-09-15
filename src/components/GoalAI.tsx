import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { checkContentSafety } from '@/lib/contentSafety';
import { consumeEntitlement, type EntitlementResult } from '@/lib/entitlements';
import { UpgradePrompt } from './UpgradePrompt';
import type { Goal, Session } from '@/types/database';

function readAIText(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const value = data as Record<string, unknown>;
  if (typeof value.text === 'string') return value.text.trim();
  if (typeof value.output_text === 'string') return value.output_text.trim();
  if (typeof value.response === 'string') return value.response.trim();
  return '';
}

const quickPrompts = [
  'What should I do next?',
  'I missed a session — rebuild my next steps.',
  'Make this week more realistic.',
];

function featureForPrompt(question: string) {
  return /missed|rebuild|changed|realistic|adapt|schedule/i.test(question) ? 'adaptive_replan' as const : 'planning_action' as const;
}

export function GoalAI({ goal }: { goal?: Goal | null }) {
  const { session } = useAuth();
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [upgrade, setUpgrade] = useState<EntitlementResult | null>(null);

  async function ask(prompt = message) {
    const question = prompt.trim();
    if (!question || loading) return;
    setMessage(question);
    setLoading(true);
    setError('');
    setAnswer('');
    setUpgrade(null);
    try {
      if (!session) throw new Error('Please sign in to use VOW AI.');
      const safety = await checkContentSafety(question);
      if (safety.status !== 'safe') {
        setError(safety.message || 'Please reword that so the intended activity is clear.');
        if (safety.status === 'suspended' && session) await supabase.auth.signOut();
        return;
      }
      const entitlement = await consumeEntitlement(featureForPrompt(question), { goal_id: goal?.id || null, prompt_type: featureForPrompt(question) });
      if (!entitlement.allowed) {
        setUpgrade(entitlement);
        return;
      }

      let upcoming: Session[] = [];
      const start = new Date();
      const end = new Date(Date.now() + 42 * 24 * 60 * 60 * 1000);
      const { data: sessionData } = await supabase.from('sessions').select('*').eq('user_id', session.user.id).gte('scheduled_at', start.toISOString()).lte('scheduled_at', end.toISOString()).order('scheduled_at', { ascending: true });
      upcoming = (sessionData || []) as Session[];
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
          instruction: 'You are VOW AI, a rigorous planning and accountability assistant. VOW\'s core promise is: Most apps help you track what you\'re doing. VOW helps you figure out what to do next. Always prioritise the user\'s next concrete action and explain why it is the right next step. Give useful, goal-specific reasoning, not motivational filler. Do not say “define what better looks like”, “stay consistent”, “break it into smaller steps”, or similar generic coaching phrases unless you immediately replace them with concrete actions, numbers, checkpoints, or decision rules tied to this exact goal. If the goal is measurable, identify the metric and a credible baseline/target. If it is skill-based, specify practice structure and progression. If it is a project, specify deliverables, dependencies and milestones. If it is a study goal, specify topics, workload and assessment. If it is a fitness goal, specify training variables and recovery considerations without pretending certainty. Use the supplied VOW calendar to find conflicts and realistic weekly capacity. Use attached goal references as evidence of the user\'s intended outcome; inspect public links when relevant. Use web research when current, specialised, empirical, or time-sensitive information would materially improve the answer, and cite or name the important sources/findings rather than pretending research was done. When circumstances change, adapt the plan rather than simply restating it. If critical information is missing, ask only the minimum necessary question; otherwise make a reasonable assumption and state it. Challenge unrealistic or contradictory goals instead of blindly encouraging them. Return a practical plan with: target, success metric, assumptions/baseline, milestone sequence, weekly workload, concrete actions/sessions, progression, checkpoints, risks and fallback rules. Be concise, specific and age-appropriate.',
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
        <h2 className="vow-heading text-lg text-vow-ink mt-1">Most apps help you track what you’re doing. VOW helps you figure out what to do next.</h2>
        <p className="text-xs text-vow-muted mt-2">Your goal, your calendar and relevant evidence — turned into the next concrete move. If your circumstances change, VOW can rethink the plan with you.</p>
      </div>
      {upgrade && <div className="mb-4"><UpgradePrompt result={upgrade} title="You’ve reached the free planning limit" /></div>}
      <div className="flex flex-wrap gap-2 mb-4">
        {quickPrompts.map((prompt) => (
          <button key={prompt} type="button" onClick={() => ask(prompt)} disabled={loading} className="text-xs px-3 py-1.5 border border-vow-border text-vow-muted hover:text-vow-ink hover:border-vow-ink transition-colors disabled:opacity-50">
            {prompt}
          </button>
        ))}
      </div>
      {answer && <div className="border-l-2 border-vow-ink pl-4 mb-4 text-sm leading-relaxed whitespace-pre-wrap text-vow-ink">{answer}</div>}
      {error && <p className="text-xs text-vow-muted mb-3">{error}</p>}
      <div className="flex flex-col sm:flex-row gap-2">
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') ask(); }} rows={2} placeholder="e.g. I have football on Saturday — what should I do next?" className="flex-1 border border-vow-border bg-transparent px-3 py-2 text-sm text-vow-ink outline-none resize-none" />
        <button onClick={() => ask()} disabled={loading || !message.trim()} className="min-h-11 border border-vow-ink px-4 text-xs text-vow-ink disabled:opacity-50">{loading ? 'Thinking…' : 'Ask VOW'}</button>
      </div>
    </section>
  );
}
