import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { addDays, toDateString } from '@/lib/dates';
import { syncUpcomingSessionNotifications } from '@/lib/notifications';
import type { Session } from '@/types/database';
import { PageHeader } from './AppShell';

type Horizon = 'auto' | '4w' | '8w' | '12w' | '26w';
type Clarification = { questions: string[]; recommended_duration_weeks: number; rationale: string };
type PlanItem = { week: number; day: string; task: string; purpose: string; target_metric: string; duration_minutes: number; preferred_time: string };
type Plan = { outcome: string; success_metric: string; baseline: string; assumptions: string[]; milestones: Array<{ title: string; description: string; week: number }>; schedule: PlanItem[]; progression: string; checkpoints: string[]; risks: string[]; fallback_rules: string[]; summary: string };
type Reference = { url: string; title: string; resource_type: string };

const HORIZONS: Array<{ value: Horizon; label: string }> = [
  { value: 'auto', label: 'Let VOW choose a sensible horizon' },
  { value: '4w', label: '4 weeks' },
  { value: '8w', label: '8 weeks' },
  { value: '12w', label: '12 weeks' },
  { value: '26w', label: '6 months' },
];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function dayIndex(day: string) { const aliases: Record<string, number> = { sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3, thursday: 4, thu: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6 }; return aliases[day.trim().toLowerCase()]; }
function horizonWeeks(value: Horizon, recommended: number) { if (value !== 'auto') return Number(value.replace('w', '')); if (recommended <= 4) return 4; if (recommended <= 8) return 8; if (recommended <= 12) return 12; return 26; }
function durationCode(weeks: number): Exclude<Horizon, 'auto'> { return weeks <= 4 ? '4w' : weeks <= 8 ? '8w' : weeks <= 12 ? '12w' : '26w'; }
function nextMonday() { const date = new Date(); const day = date.getDay(); const offset = day === 0 ? 1 : 8 - day; date.setHours(0, 0, 0, 0); date.setDate(date.getDate() + offset); return date; }
function deadlineFor(start: Date, weeks: number) { return toDateString(addDays(start, weeks * 7 - 1)); }

export function GoalPlanner({ userId, onCreated, onCancel }: { userId: string; onCreated: () => void; onCancel: () => void }) {
  const [rawInput, setRawInput] = useState('');
  const [whyItMatters, setWhyItMatters] = useState('');
  const [horizon, setHorizon] = useState<Horizon>('auto');
  const [references, setReferences] = useState<Reference[]>([]);
  const [referenceUrl, setReferenceUrl] = useState('');
  const [referenceTitle, setReferenceTitle] = useState('');
  const [draftGoalId, setDraftGoalId] = useState<string | null>(null);
  const [clarification, setClarification] = useState<Clarification | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [availableDays, setAvailableDays] = useState<string[]>(['Monday', 'Wednesday', 'Saturday']);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addReference() { const url = referenceUrl.trim(); if (!url) return; setReferences((current) => [...current, { url, title: referenceTitle.trim() || url, resource_type: 'link' }]); setReferenceUrl(''); setReferenceTitle(''); }

  async function ensureDraftGoal() {
    if (draftGoalId) return draftGoalId;
    const { data, error: insertError } = await supabase.from('goals').insert({ user_id: userId, title: rawInput.trim(), outcome: rawInput.trim(), why_it_matters: whyItMatters.trim() || null, status: 'draft', weekly_commitment_target: availableDays.length }).select('id').single();
    if (insertError || !data) throw insertError || new Error('Could not start this goal.');
    setDraftGoalId(data.id);
    if (references.length) { const { error: referenceError } = await supabase.from('goal_resources').insert(references.map((reference) => ({ goal_id: data.id, url: reference.url, title: reference.title, resource_type: reference.resource_type }))); if (referenceError) throw referenceError; }
    return data.id;
  }

  async function loadCalendarContext() {
    try { const { data: status } = await supabase.functions.invoke('google-calendar-auth', { body: { action: 'status' } }); if (!status?.connected) return []; const { data } = await supabase.functions.invoke('google-calendar-events', { body: { action: 'list' } }); return Array.isArray(data?.events) ? data.events : []; } catch { return []; }
  }

  async function askClarifyingQuestions() {
    if (!rawInput.trim() || planning) return;
    setPlanning(true); setError('');
    try {
      const goalId = await ensureDraftGoal();
      const { data, error: invokeError } = await supabase.functions.invoke('vow-goal-ai', { body: { mode: 'goal-clarify', goal: { id: goalId, title: rawInput.trim(), why_it_matters: whyItMatters.trim() || null, horizon: horizon === 'auto' ? 'AI-selected' : horizon }, message: `Goal: ${rawInput.trim()}\nWhy it matters: ${whyItMatters.trim() || 'Not supplied.'}\nThe user can protect these days: ${availableDays.join(', ')}. Ask only the high-value questions that are still missing.`, scope: 'goal-commitment-planning', references } });
      if (invokeError || !data?.structured) throw new Error('VOW AI could not prepare the follow-up questions.');
      const next = data.structured as Clarification;
      setClarification(next); setAnswers(next.questions.map(() => ''));
      await supabase.from('goal_clarification_answers').delete().eq('goal_id', goalId);
      const { error: answerError } = await supabase.from('goal_clarification_answers').insert(next.questions.map((question, index) => ({ goal_id: goalId, user_id: userId, question, answer: null, question_order: index })));
      if (answerError) throw answerError;
    } catch (err) { setError(err instanceof Error ? err.message : 'VOW AI is unavailable right now.'); }
    finally { setPlanning(false); }
  }

  async function buildPlan() {
    if (!clarification || planning || availableDays.length === 0) return;
    setPlanning(true); setError('');
    try {
      const goalId = await ensureDraftGoal();
      const calendar = await loadCalendarContext();
      const cleanAnswers = answers.map((answer) => answer.trim());
      const { error: answerError } = await supabase.from('goal_clarification_answers').delete().eq('goal_id', goalId); if (answerError) throw answerError;
      const { error: insertAnswerError } = await supabase.from('goal_clarification_answers').insert(clarification.questions.map((question, index) => ({ goal_id: goalId, user_id: userId, question, answer: cleanAnswers[index] || null, question_order: index }))); if (insertAnswerError) throw insertAnswerError;
      const { data, error: invokeError } = await supabase.functions.invoke('vow-goal-ai', { body: { mode: 'goal-plan', goal: { id: goalId, title: rawInput.trim(), why_it_matters: whyItMatters.trim() || null, horizon: horizon === 'auto' ? 'AI-selected' : horizon }, message: `Follow-up answers:\n${clarification.questions.map((question, index) => `Q: ${question}\nA: ${cleanAnswers[index] || 'Skipped / not supplied'}`).join('\n')}\n\nSuitable days: ${availableDays.join(', ')}\n\nRecommended horizon: ${clarification.recommended_duration_weeks} weeks.\nUser horizon preference: ${horizon}. Generate the complete day-by-day schedule for the chosen horizon.`, scope: 'goal-plan-generation', calendar, references } });
      if (invokeError || !data?.structured) throw new Error('VOW AI could not build the plan.');
      const next = data.structured as Plan; if (!next.schedule?.length) throw new Error('VOW AI returned no actionable schedule.'); setPlan(next);
    } catch (err) { setError(err instanceof Error ? err.message : 'VOW AI is unavailable right now.'); }
    finally { setPlanning(false); }
  }

  async function handleCreate() {
    if (!plan || !draftGoalId || saving) return;
    setSaving(true); setError('');
    try {
      const weeks = horizonWeeks(horizon, clarification?.recommended_duration_weeks || 8);
      const start = nextMonday();
      const { error: goalError } = await supabase.from('goals').update({ title: rawInput.trim(), outcome: plan.outcome, why_it_matters: whyItMatters.trim() || null, start_date: toDateString(start), duration: durationCode(weeks), deadline: deadlineFor(start, weeks), status: 'active', weekly_commitment_target: availableDays.length, plan_json: plan, plan_version: 1, plan_generated_at: new Date().toISOString(), planning_horizon_weeks: weeks, planning_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }).eq('id', draftGoalId); if (goalError) throw goalError;
      const { data: milestoneData, error: milestoneError } = await supabase.from('milestones').insert(plan.milestones.map((milestone, index) => ({ goal_id: draftGoalId, title: milestone.title, description: milestone.description, sort_order: index, deadline: toDateString(addDays(start, Math.min(weeks, milestone.week) * 7 - 1)), status: index === 0 ? 'in_progress' : 'pending' as const }))).select('id, sort_order').order('sort_order'); if (milestoneError) throw milestoneError;
      const schedule = plan.schedule.filter((item) => availableDays.some((day) => dayIndex(day) === dayIndex(item.day))); if (!schedule.length) throw new Error('The generated schedule does not match the selected days.');
      const planRows = schedule.map((item) => { const itemWeek = Math.max(1, Math.min(weeks, item.week)); const weekStart = addDays(start, (itemWeek - 1) * 7); const targetDay = dayIndex(item.day); const offset = targetDay === 0 ? 6 : targetDay - 1; const date = addDays(weekStart, offset); const timeMatch = /^(\d{1,2}):(\d{2})/.exec(item.preferred_time || '09:00'); date.setHours(Math.min(23, Number(timeMatch?.[1] || 9)), Number(timeMatch?.[2] || 0), 0, 0); const milestoneIndex = Math.min(Math.max(0, (milestoneData || []).length - 1), Math.floor(((itemWeek - 1) / Math.max(1, weeks)) * (milestoneData || []).length)); return { goal_id: draftGoalId, user_id: userId, plan_version: 1, week_number: itemWeek, day_of_week: DAY_NAMES[targetDay === 0 ? 6 : targetDay - 1], scheduled_at: date.toISOString(), task: item.task, purpose: item.purpose, target_metric: item.target_metric, duration_minutes: item.duration_minutes, status: 'scheduled', milestone_id: milestoneData?.[milestoneIndex]?.id ?? null }; });
      const { data: planItems, error: planItemError } = await supabase.from('goal_plan_items').insert(planRows).select('*'); if (planItemError) throw planItemError;
      const sessionRows = (planItems || []).map((item: { goal_id: string; user_id: string; milestone_id: string | null; task: string; scheduled_at: string; duration_minutes: number; purpose: string | null; target_metric: string | null }) => ({ goal_id: item.goal_id, milestone_id: item.milestone_id, user_id: item.user_id, title: item.task, scheduled_at: item.scheduled_at, duration_minutes: item.duration_minutes, status: 'scheduled', notes: [item.purpose, item.target_metric ? `Target: ${item.target_metric}` : null].filter(Boolean).join('\n') || null }));
      const { data: sessions, error: sessionError } = await supabase.from('sessions').insert(sessionRows).select('*'); if (sessionError) throw sessionError; if (sessions) await syncUpcomingSessionNotifications(sessions as Session[]);
      try { await supabase.functions.invoke('google-calendar-sync-goal', { body: { goalId: draftGoalId } }); } catch { /* Calendar is optional; the VOW plan remains intact. */ }
      onCreated();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create goal.'); }
    finally { setSaving(false); }
  }

  if (plan) return <div><button onClick={() => setPlan(null)} className="text-sm text-vow-muted hover:text-vow-ink mb-6">← Adjust answers</button><PageHeader title="Your VOW plan" subtitle="Review the concrete schedule before you lock it in." /><div className="max-w-3xl space-y-6"><section className="border border-vow-border p-5"><p className="vow-label mb-2">Outcome</p><p className="text-lg font-medium text-vow-ink">{plan.outcome}</p><p className="text-sm text-vow-muted mt-3">{plan.summary}</p></section><section className="border border-vow-border p-5"><p className="vow-label mb-3">Success metric</p><p className="text-sm text-vow-ink">{plan.success_metric}</p><p className="vow-label mt-5 mb-2">Baseline</p><p className="text-sm text-vow-muted">{plan.baseline}</p>{plan.assumptions.length > 0 && <><p className="vow-label mt-5 mb-2">Assumptions</p><ul className="text-xs text-vow-muted list-disc pl-4 space-y-1">{plan.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></>}</section><section className="border border-vow-border p-5"><p className="vow-label mb-4">Day-by-day schedule</p><div className="divide-y divide-vow-border">{plan.schedule.map((item, index) => <div key={`${item.week}-${item.day}-${item.task}-${index}`} className="py-4 first:pt-0 last:pb-0"><div className="flex gap-3 items-baseline"><span className="w-14 shrink-0 text-xs text-vow-muted">W{item.week}</span><span className="w-24 shrink-0 text-xs text-vow-muted font-medium">{item.day}</span><p className="text-sm text-vow-ink font-medium">{item.task}</p></div><p className="text-xs text-vow-muted mt-1 ml-[8.5rem]">{item.duration_minutes} min · {item.purpose} · Target: {item.target_metric}</p></div>)}</div></section><section className="border border-vow-border p-5"><p className="vow-label mb-4">Milestones & progression</p><div className="space-y-4">{plan.milestones.map((item) => <div key={`${item.week}-${item.title}`} className="flex gap-4"><span className="text-xs text-vow-muted w-16 shrink-0">Week {item.week}</span><div><p className="text-sm text-vow-ink font-medium">{item.title}</p><p className="text-xs text-vow-muted mt-1">{item.description}</p></div></div>)}</div><p className="text-sm text-vow-muted mt-5 pt-5 border-t border-vow-border">{plan.progression}</p></section>{(plan.checkpoints.length > 0 || plan.risks.length > 0 || plan.fallback_rules.length > 0) && <section className="border border-vow-border p-5"><p className="vow-label mb-3">Checkpoints, risks & fallback</p><ul className="space-y-2 text-xs text-vow-muted list-disc pl-4">{plan.checkpoints.map((item) => <li key={item}>{item}</li>)}{plan.risks.map((item) => <li key={item}>{item}</li>)}{plan.fallback_rules.map((item) => <li key={item}>{item}</li>)}</ul></section>}{error && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">{error}</p>}<div className="flex gap-3"><button onClick={onCancel} className="vow-btn-ghost">Cancel</button><button onClick={handleCreate} disabled={saving} className="vow-btn-primary flex-1">{saving ? 'Saving plan…' : 'Lock in this VOW'}</button></div></div></div>;

  if (clarification) return <div><button onClick={() => setClarification(null)} className="text-sm text-vow-muted hover:text-vow-ink mb-6">← Back</button><PageHeader title="A few questions" subtitle="These are tailored to what will actually change your plan." /><div className="max-w-2xl space-y-6"><section className="border border-vow-border p-5"><p className="text-sm text-vow-muted">VOW recommends roughly <span className="text-vow-ink font-medium">{clarification.recommended_duration_weeks} weeks</span>.</p><p className="text-xs text-vow-muted mt-2">{clarification.rationale}</p></section>{clarification.questions.map((question, index) => <label key={question} className="block"><span className="vow-label block mb-2">Question {index + 1}</span><span className="block text-sm text-vow-ink mb-2">{question}</span><textarea value={answers[index] || ''} onChange={(e) => setAnswers((current) => current.map((answer, i) => i === index ? e.target.value : answer))} placeholder="Optional — skip if you don't know yet" rows={3} className="vow-input resize-none" /></label>)}<section className="border border-vow-border p-5"><p className="vow-label mb-2">Suitable days</p><p className="text-xs text-vow-muted mb-4">Which days can you realistically protect? VOW will assign the actual work.</p><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{DAY_NAMES.map((day) => <label key={day} className={`border px-3 py-2 text-xs cursor-pointer transition-colors ${availableDays.includes(day) ? 'border-vow-ink bg-vow-surface' : 'border-vow-border'}`}><input type="checkbox" className="sr-only" checked={availableDays.includes(day)} onChange={() => setAvailableDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])} />{day}</label>)}</div></section>{error && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">{error}</p>}<button onClick={buildPlan} disabled={planning || availableDays.length === 0} className="vow-btn-primary w-full">{planning ? 'Designing your plan…' : 'Build my custom VOW plan'}</button></div></div>;

  return <div><PageHeader title="New Goal" subtitle="Tell VOW what you actually want. It will ask what matters, research when useful, and build a concrete plan." /><div className="max-w-2xl space-y-6"><label className="block"><span className="vow-label block mb-2">What is your goal?</span><textarea value={rawInput} onChange={(e) => setRawInput(e.target.value)} placeholder="e.g. Run a faster 10K, learn Spanish, save $5,000" rows={4} className="vow-input resize-none" /></label><label className="block"><span className="vow-label block mb-2">Why does it matter?</span><textarea value={whyItMatters} onChange={(e) => setWhyItMatters(e.target.value)} placeholder="Optional" rows={3} className="vow-input resize-none" /></label><section className="border border-vow-border p-5"><p className="vow-label mb-3">Planning horizon</p><div className="space-y-2">{HORIZONS.map((item) => <label key={item.value} className={`flex items-center gap-3 border px-3 py-3 text-sm cursor-pointer ${horizon === item.value ? 'border-vow-ink bg-vow-surface' : 'border-vow-border'}`}><input type="radio" name="goal-horizon" checked={horizon === item.value} onChange={() => setHorizon(item.value)} />{item.label}</label>)}</div></section><section className="border border-vow-border p-5"><p className="vow-label mb-3">Goal references</p><p className="text-xs text-vow-muted mb-4">Add useful sources VOW can research alongside its own knowledge.</p><div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input value={referenceUrl} onChange={(e) => setReferenceUrl(e.target.value)} placeholder="https://…" className="vow-input" /><input value={referenceTitle} onChange={(e) => setReferenceTitle(e.target.value)} placeholder="Optional title" className="vow-input" /><button type="button" onClick={addReference} className="vow-btn-ghost">Add</button></div>{references.length > 0 && <div className="mt-4 space-y-2">{references.map((reference, index) => <div key={`${reference.url}-${index}`} className="flex items-center justify-between gap-3 border border-vow-border px-3 py-2 text-xs"><span className="truncate text-vow-ink">{reference.title}</span><button type="button" onClick={() => setReferences((current) => current.filter((_, i) => i !== index))} className="text-vow-muted">Remove</button></div>)}</div>}</section>{error && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">{error}</p>}<div className="flex gap-3"><button onClick={onCancel} className="vow-btn-ghost">Cancel</button><button onClick={askClarifyingQuestions} disabled={planning || !rawInput.trim()} className="vow-btn-primary flex-1">{planning ? 'Thinking…' : 'Continue'}</button></div></div></div>;
}
