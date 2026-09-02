import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { addDays, toDateString } from '@/lib/dates';
import { syncUpcomingSessionNotifications } from '@/lib/notifications';
import type { Session } from '@/types/database';
import { PageHeader } from './AppShell';
import { ArrowLeft, Lock, Plus, X } from 'lucide-react';

type Horizon = 'auto' | '4w' | '8w' | '12w' | '26w';
type Clarification = { questions: string[]; recommended_duration_weeks: number; rationale: string };
type Plan = {
  outcome: string;
  success_metric: string;
  baseline: string;
  assumptions: string[];
  milestones: Array<{ title: string; description: string; week: number }>;
  weekly_schedule: Array<{ day: string; session: string; purpose: string; duration_minutes: number }>;
  progression: string;
  checkpoints: string[];
  risks: string[];
  fallback_rules: string[];
  summary: string;
};
type Reference = { url: string; title: string; resource_type: string };

const HORIZONS: Array<{ value: Horizon; label: string }> = [
  { value: 'auto', label: 'Let VOW choose a sensible horizon' },
  { value: '4w', label: '4 weeks' },
  { value: '8w', label: '8 weeks' },
  { value: '12w', label: '12 weeks' },
  { value: '26w', label: '6 months' },
];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function horizonWeeks(value: Horizon, recommended: number) {
  if (value !== 'auto') return Number(value.replace('w', ''));
  if (recommended <= 4) return 4;
  if (recommended <= 8) return 8;
  if (recommended <= 12) return 12;
  return 26;
}
function durationCode(weeks: number): Exclude<Horizon, 'auto'> { return weeks <= 4 ? '4w' : weeks <= 8 ? '8w' : weeks <= 12 ? '12w' : '26w'; }
function durationDeadline(start: Date, weeks: number) { const date = addDays(start, weeks * 7); date.setHours(23, 59, 59, 999); return date; }
function dayIndex(day: string) { const normalised = day.trim().toLowerCase(); const aliases: Record<string, number> = { monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3, thursday: 4, thu: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6, sunday: 0, sun: 0 }; return aliases[normalised]; }

export function GoalPlanner({ userId, onCreated, onCancel }: { userId: string; onCreated: () => void; onCancel: () => void }) {
  const [rawInput, setRawInput] = useState('');
  const [whyItMatters, setWhyItMatters] = useState('');
  const [horizon, setHorizon] = useState<Horizon>('auto');
  const [references, setReferences] = useState<Reference[]>([]);
  const [referenceUrl, setReferenceUrl] = useState('');
  const [referenceTitle, setReferenceTitle] = useState('');
  const [clarification, setClarification] = useState<Clarification | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [availableDays, setAvailableDays] = useState<string[]>(['Monday', 'Wednesday', 'Saturday']);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addReference() {
    const url = referenceUrl.trim();
    if (!url) return;
    setReferences((current) => [...current, { url, title: referenceTitle.trim() || url, resource_type: 'link' }]);
    setReferenceUrl(''); setReferenceTitle('');
  }

  async function askClarifyingQuestions() {
    if (!rawInput.trim() || planning) return;
    setPlanning(true); setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('vow-goal-ai', {
        body: { mode: 'goal-clarify', goal: { title: rawInput.trim(), why_it_matters: whyItMatters.trim() || null }, message: `Goal: ${rawInput.trim()}\nWhy it matters: ${whyItMatters.trim() || 'Not supplied yet.'}\nPreferred horizon: ${horizon}. Ask only 2–3 high-value follow-up questions.`, scope: 'goal-commitment-planning', references },
      });
      if (invokeError || !data?.structured) throw new Error('VOW AI could not prepare the follow-up questions.');
      const next = data.structured as Clarification;
      setClarification(next);
      setAnswers(next.questions.map(() => ''));
    } catch (err) { setError(err instanceof Error ? err.message : 'VOW AI is unavailable right now.'); }
    finally { setPlanning(false); }
  }

  async function buildPlan() {
    if (!clarification || planning || answers.some((answer) => !answer.trim()) || availableDays.length === 0) return;
    setPlanning(true); setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('vow-goal-ai', {
        body: {
          mode: 'goal-plan',
          goal: { title: rawInput.trim(), why_it_matters: whyItMatters.trim() || null, horizon: horizon === 'auto' ? 'AI-selected' : horizon },
          message: `Follow-up answers:\n${clarification.questions.map((question, index) => `Q: ${question}\nA: ${answers[index]}`).join('\n')}\n\nSuitable days: ${availableDays.join(', ')}\n\nRecommended horizon from VOW AI: ${clarification.recommended_duration_weeks} weeks.\nUser horizon preference: ${horizon}. Build the final custom plan and weekly schedule.`,
          scope: 'goal-plan-generation',
          references,
        },
      });
      if (invokeError || !data?.structured) throw new Error('VOW AI could not build the plan.');
      setPlan(data.structured as Plan);
    } catch (err) { setError(err instanceof Error ? err.message : 'VOW AI is unavailable right now.'); }
    finally { setPlanning(false); }
  }

  async function handleCreate() {
    if (!plan || saving) return;
    setSaving(true); setError('');
    try {
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const weeks = horizonWeeks(horizon, clarification?.recommended_duration_weeks || 8);
      const deadline = durationDeadline(now, weeks);
      const duration = durationCode(weeks);
      const { data: goalData, error: goalError } = await supabase.from('goals').insert({ user_id: userId, title: plan.outcome, outcome: plan.outcome, why_it_matters: whyItMatters.trim() || null, start_date: toDateString(now), duration, deadline: toDateString(deadline), status: 'active', weekly_commitment_target: plan.weekly_schedule.length }).select().single();
      if (goalError) throw goalError;

      const milestoneRows = plan.milestones.map((milestone, index) => ({ goal_id: goalData.id, title: milestone.title, description: milestone.description, sort_order: index, deadline: toDateString(addDays(now, Math.min(weeks, milestone.week) * 7)), status: index === 0 ? 'in_progress' : 'pending' as const }));
      const { data: milestoneData, error: milestoneError } = await supabase.from('milestones').insert(milestoneRows).select().order('sort_order');
      if (milestoneError) throw milestoneError;

      if (references.length) {
        const { error: referenceError } = await supabase.from('goal_resources').insert(references.map((reference) => ({ goal_id: goalData.id, url: reference.url, title: reference.title, resource_type: reference.resource_type })));
        if (referenceError) throw referenceError;
      }

      const sessions: Array<Record<string, unknown>> = [];
      const schedule = plan.weekly_schedule.filter((item) => availableDays.some((day) => day.toLowerCase() === item.day.toLowerCase() || dayIndex(day) === dayIndex(item.day)));
      const usableSchedule = schedule.length ? schedule : plan.weekly_schedule;
      for (let week = 0; week < weeks; week += 1) {
        for (const item of usableSchedule) {
          const targetDay = dayIndex(item.day);
          if (targetDay === undefined) continue;
          const weekStart = new Date(now); const currentDay = weekStart.getDay(); const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; weekStart.setDate(weekStart.getDate() + mondayOffset + week * 7);
          const sessionDate = new Date(weekStart); const offset = targetDay === 0 ? 6 : targetDay - 1; sessionDate.setDate(weekStart.getDate() + offset); sessionDate.setHours(9, 0, 0, 0);
          if (sessionDate <= now || sessionDate > deadline) continue;
          const milestoneIndex = Math.min((milestoneData || []).length - 1, Math.floor((week / Math.max(1, weeks)) * (milestoneData || []).length));
          const milestone = (milestoneData || [])[Math.max(0, milestoneIndex)];
          sessions.push({ goal_id: goalData.id, milestone_id: milestone?.id ?? null, user_id: userId, title: item.session, scheduled_at: sessionDate.toISOString(), duration_minutes: item.duration_minutes, status: 'scheduled' });
        }
      }
      const { data: createdSessions, error: sessionError } = sessions.length ? await supabase.from('sessions').insert(sessions).select('*') : { data: [], error: null };
      if (sessionError) throw sessionError;
      if (createdSessions) await syncUpcomingSessionNotifications(createdSessions as Session[]);
      onCreated();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create goal.'); }
    finally { setSaving(false); }
  }

  if (plan) return <div><button onClick={() => setPlan(null)} className="text-sm text-vow-muted hover:text-vow-ink mb-6 flex items-center gap-1"><ArrowLeft className="w-4 h-4" />Adjust answers</button><PageHeader title="Your VOW plan" subtitle="A plan built around your goal, answers, availability and references." /><div className="max-w-3xl space-y-6"><section className="border border-vow-border p-5"><p className="vow-label mb-2">Outcome</p><p className="text-lg font-medium text-vow-ink">{plan.outcome}</p><p className="text-sm text-vow-muted mt-3">{plan.summary}</p></section><section className="border border-vow-border p-5"><p className="vow-label mb-3">Success metric</p><p className="text-sm text-vow-ink">{plan.success_metric}</p><p className="vow-label mt-5 mb-2">Baseline</p><p className="text-sm text-vow-muted">{plan.baseline}</p></section><section className="border border-vow-border p-5"><p className="vow-label mb-4">Weekly rhythm</p><div className="divide-y divide-vow-border">{plan.weekly_schedule.map((item, index) => <div key={`${item.day}-${item.session}-${index}`} className="py-4 first:pt-0 last:pb-0 flex gap-4"><div className="w-24 shrink-0 text-xs text-vow-muted font-medium">{item.day}</div><div><p className="text-sm text-vow-ink font-medium">{item.session}</p><p className="text-xs text-vow-muted mt-1">{item.duration_minutes} min · {item.purpose}</p></div></div>)}</div></section><section className="border border-vow-border p-5"><p className="vow-label mb-4">Milestones & progression</p><div className="space-y-4">{plan.milestones.map((item) => <div key={`${item.week}-${item.title}`} className="flex gap-4"><span className="text-xs text-vow-muted w-16 shrink-0">Week {item.week}</span><div><p className="text-sm text-vow-ink font-medium">{item.title}</p><p className="text-xs text-vow-muted mt-1">{item.description}</p></div></div>)}</div><p className="text-sm text-vow-muted mt-5 pt-5 border-t border-vow-border">{plan.progression}</p></section>{(plan.risks.length > 0 || plan.fallback_rules.length > 0) && <section className="border border-vow-border p-5"><p className="vow-label mb-3">Risks & fallback</p><ul className="space-y-2 text-xs text-vow-muted list-disc pl-4">{plan.risks.map((item) => <li key={item}>{item}</li>)}{plan.fallback_rules.map((item) => <li key={item}>{item}</li>)}</ul></section>}{error && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">{error}</p>}<div className="flex gap-3"><button onClick={onCancel} className="vow-btn-ghost">Cancel</button><button onClick={handleCreate} disabled={saving} className="vow-btn-primary flex-1"><Lock className="w-4 h-4" />{saving ? 'Building your calendar…' : 'Lock in this VOW'}</button></div></div></div>;

  if (clarification) return <div><button onClick={() => setClarification(null)} className="text-sm text-vow-muted hover:text-vow-ink mb-6 flex items-center gap-1"><ArrowLeft className="w-4 h-4" />Back</button><PageHeader title="A few questions" subtitle="VOW only needs the details that materially change your plan." /><div className="max-w-2xl space-y-6"><section className="border border-vow-border p-5"><p className="text-sm text-vow-muted">VOW recommends roughly <span className="text-vow-ink font-medium">{clarification.recommended_duration_weeks} weeks</span> for this goal.</p><p className="text-xs text-vow-muted mt-2">{clarification.rationale}</p></section>{clarification.questions.map((question, index) => <label key={question} className="block"><span className="vow-label block mb-2">Question {index + 1}</span><span className="block text-sm text-vow-ink mb-2">{question}</span><textarea value={answers[index] || ''} onChange={(e) => setAnswers((current) => current.map((answer, i) => i === index ? e.target.value : answer))} rows={3} className="vow-input resize-none" /></label>)}<section className="border border-vow-border p-5"><p className="vow-label mb-2">Suitable days</p><p className="text-xs text-vow-muted mb-4">Which days can you realistically protect for this VOW? VOW AI will decide what each session should do.</p><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{DAY_NAMES.map((day) => <label key={day} className={`border px-3 py-2 text-xs cursor-pointer transition-colors ${availableDays.includes(day) ? 'border-vow-ink bg-vow-surface' : 'border-vow-border'}`}><input type="checkbox" className="sr-only" checked={availableDays.includes(day)} onChange={() => setAvailableDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])} />{day}</label>)}</div></section>{error && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">{error}</p>}<button onClick={buildPlan} disabled={planning || answers.some((answer) => !answer.trim()) || availableDays.length === 0} className="vow-btn-primary w-full">{planning ? 'Designing your plan…' : 'Build my custom VOW plan'}</button></div></div>;

  return <div><PageHeader title="New Goal" subtitle="Tell VOW what you actually want. It will ask only what it needs, choose a sensible horizon, and build a plan around your life." /><div className="max-w-2xl space-y-6"><section><label className="vow-label block mb-2">What do you want to accomplish?</label><textarea value={rawInput} onChange={(e) => setRawInput(e.target.value)} rows={4} className="vow-input resize-none" placeholder="e.g. I want to become a better runner" autoFocus /></section><section><label className="vow-label block mb-2">Why does this matter?</label><textarea value={whyItMatters} onChange={(e) => setWhyItMatters(e.target.value)} rows={2} className="vow-input resize-none" placeholder="Optional, but useful for making the plan personal." /></section><section><label className="vow-label block mb-2">Planning horizon</label><select value={horizon} onChange={(e) => setHorizon(e.target.value as Horizon)} className="vow-input">{HORIZONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><p className="text-xs text-vow-muted mt-2">This is the container for the plan, not a schedule. VOW will recommend a sensible horizon when you let it choose.</p></section><section className="border border-vow-border p-5"><div className="flex items-start justify-between gap-4 mb-4"><div><p className="vow-label">Goal references</p><p className="text-xs text-vow-muted mt-1">Add useful links here and they stay attached to this goal.</p></div></div><div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input value={referenceUrl} onChange={(e) => setReferenceUrl(e.target.value)} className="vow-input" placeholder="https://…" /><input value={referenceTitle} onChange={(e) => setReferenceTitle(e.target.value)} className="vow-input" placeholder="Reference name (optional)" /><button onClick={addReference} disabled={!referenceUrl.trim()} className="vow-btn-soft disabled:opacity-40"><Plus className="w-4 h-4" />Add</button></div>{references.length > 0 && <div className="mt-4 space-y-2">{references.map((reference, index) => <div key={`${reference.url}-${index}`} className="flex items-center gap-3 border border-vow-border px-3 py-2"><div className="min-w-0 flex-1"><p className="text-xs text-vow-ink truncate">{reference.title}</p><p className="text-[10px] text-vow-muted truncate">{reference.url}</p></div><button onClick={() => setReferences((current) => current.filter((_, i) => i !== index))} className="text-vow-muted hover:text-vow-ink" aria-label="Remove reference"><X className="w-4 h-4" /></button></div>)}</div>}</section>{error && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">{error}</p>}<div className="flex gap-3"><button onClick={onCancel} className="vow-btn-ghost">Cancel</button><button onClick={askClarifyingQuestions} disabled={planning || !rawInput.trim()} className="vow-btn-primary flex-1">{planning ? 'Thinking through your goal…' : 'Continue with VOW AI'}</button></div></div></div>;
}
