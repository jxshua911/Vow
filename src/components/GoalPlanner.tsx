import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { addDays, toDateString } from '@/lib/dates';
import { syncUpcomingSessionNotifications } from '@/lib/notifications';
import type { Goal, GoalClarificationAnswer, Session } from '@/types/database';
import { PageHeader } from './AppShell';
import { buildGoalContext, goalContextPrompt, buildResourceSearchPlan } from '@/lib/goalContext';
import { parseClarification, parsePlan, type GoalClarification, type GoalPlan } from '@/lib/goalAI';

type PlanItem = GoalPlan['schedule'][number];
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DURATION_OPTIONS = [
  { weeks: 1, label: '1 week', detail: 'Quick start' },
  { weeks: 2, label: '2 weeks', detail: 'Short sprint' },
  { weeks: 4, label: '1 month', detail: 'Build momentum' },
  { weeks: 8, label: '2 months', detail: 'Build consistency' },
  { weeks: 12, label: '3 months', detail: 'Meaningful change' },
  { weeks: 26, label: '6 months', detail: 'Long-term build' },
  { weeks: 52, label: '1 year', detail: 'Full-year commitment' },
];

function nextMonday() {
  const date = new Date();
  const day = date.getDay();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + (day === 0 ? 1 : 8 - day));
  return date;
}

function deadlineFor(start: Date, weeks: number) {
  return toDateString(addDays(start, weeks * 7 - 1));
}

function durationLabel(weeks: number) {
  return DURATION_OPTIONS.find((option) => option.weeks === weeks)?.label || `${weeks} weeks`;
}

function fallbackQuestions(title: string, durationWeeks: number): GoalClarification {
  return {
    questions: [
      `What is your current level or baseline for ${title}?`,
      `What specifically will count as success for ${title}?`,
      'What constraints, preferences, equipment, resources or schedule limits should VOW design around?',
    ],
    recommended_duration_weeks: durationWeeks,
    rationale: 'VOW will use your baseline, success criteria and real-world constraints to make the plan specific.',
  };
}

function fallbackPlan(title: string, durationWeeks: number, availableDays: string[]): GoalPlan {
  const templates = availableDays.map((day, index) => ({
    day,
    task: index === 0 ? `Build the foundation for ${title}` : index === availableDays.length - 1 ? `Apply and review progress toward ${title}` : `Develop a key skill or behaviour for ${title}`,
    purpose: 'Use this session to make measurable progress toward the goal.',
    target_metric: 'Complete the planned work and record one useful result.',
    duration_minutes: 30,
    preferred_time: '09:00',
  }));
  return {
    outcome: title,
    success_metric: `Make measurable progress toward ${title}.`,
    baseline: 'Establish a baseline during week 1.',
    assumptions: ['The selected days are available each week.'],
    milestones: [
      { title: 'Baseline', description: 'Measure the starting point and establish the first routine.', week: 1 },
      { title: 'Build', description: 'Progress the highest-value work while reviewing evidence weekly.', week: Math.max(1, Math.ceil(durationWeeks / 2)) },
      { title: 'Finish', description: 'Consolidate progress and test the intended outcome.', week: durationWeeks },
    ],
    session_templates: templates,
    weekly_focus: Array.from({ length: durationWeeks }, (_, index) => `Week ${index + 1}: progress the highest-value work for ${title}, using evidence from the previous week.`),
    progression: 'Increase difficulty only when the current workload is handled consistently.',
    checkpoints: ['Review progress weekly.', 'Adjust the next block from evidence rather than guesswork.', 'Keep the next action concrete and measurable.'],
    risks: ['Inconsistency', 'Overloading too quickly', 'Poor fit between the plan and real constraints'],
    fallback_rules: ['If a session is missed, resume at the next available day rather than doubling the workload.', 'If progress stalls, reduce complexity before increasing volume.'],
    summary: `A ${durationWeeks}-week plan for ${title}, built around ${availableDays.join(', ')}.`,
    duration_weeks: durationWeeks,
    weekly_commitment_target: availableDays.length,
    available_days: availableDays,
    schedule: [],
  };
}

function normaliseSchedule(plan: GoalPlan, start: Date, durationWeeks: number, availableDays: string[]): GoalPlan {
  const schedule: PlanItem[] = [];
  for (let week = 1; week <= durationWeeks; week += 1) {
    for (const day of availableDays) {
      const source = plan.schedule.find((item) => item.week === week && item.day.toLowerCase() === day.toLowerCase())
        || plan.schedule.find((item) => item.day.toLowerCase() === day.toLowerCase())
        || plan.schedule[(week - 1) % Math.max(1, plan.schedule.length)];
      const date = new Date(start);
      date.setDate(date.getDate() + (week - 1) * 7 + DAYS.indexOf(day));
      const time = /^\d{1,2}:\d{2}$/.test(source?.preferred_time || '') ? source.preferred_time : '09:00';
      const [hours, minutes] = time.split(':').map(Number);
      date.setHours(Math.min(23, hours), Math.min(59, minutes), 0, 0);
      schedule.push({
        week,
        day,
        task: source?.task || plan.outcome,
        purpose: source?.purpose || 'Progress toward the goal.',
        target_metric: source?.target_metric || plan.success_metric,
        duration_minutes: Math.max(5, Math.min(240, Number(source?.duration_minutes) || 30)),
        preferred_time: time,
        scheduled_at: date.toISOString(),
      });
    }
  }
  return { ...plan, duration_weeks: durationWeeks, weekly_commitment_target: availableDays.length, available_days: availableDays, schedule };
}

export function GoalPlanner({ userId, onCreated, onCancel }: { userId: string; onCreated: () => void; onCancel: () => void }) {
  const [rawInput, setRawInput] = useState('');
  const [why, setWhy] = useState('');
  const [durationWeeks, setDurationWeeks] = useState(8);
  const [availableDays, setAvailableDays] = useState<string[]>(['Monday', 'Wednesday', 'Saturday']);
  const [clarification, setClarification] = useState<GoalClarification | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [plan, setPlan] = useState<GoalPlan | null>(null);
  const [draftGoalId, setDraftGoalId] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggleDay(day: string) {
    setAvailableDays((current) => current.includes(day) ? current.filter((item) => item !== day) : current.length < 7 ? [...current, day] : current);
  }

  async function ensureDraft() {
    if (draftGoalId) return draftGoalId;
    const start = nextMonday();
    const { data, error: insertError } = await supabase.from('goals').insert({
      user_id: userId,
      title: rawInput.trim(),
      outcome: rawInput.trim(),
      why_it_matters: why.trim() || null,
      start_date: toDateString(start),
      deadline: deadlineFor(start, durationWeeks),
      duration: `${durationWeeks}w`,
      status: 'draft',
      weekly_commitment_target: availableDays.length,
      planning_horizon_weeks: durationWeeks,
      planning_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).select('id').single();
    if (insertError || !data) throw insertError || new Error('Could not start this goal.');
    setDraftGoalId(data.id);
    return data.id;
  }

  async function loadGoal(goalId: string) {
    const [{ data: goal, error: goalError }, { data: answerRows, error: answerError }] = await Promise.all([
      supabase.from('goals').select('*').eq('id', goalId).single(),
      supabase.from('goal_clarification_answers').select('*').eq('goal_id', goalId).order('question_order'),
    ]);
    if (goalError || !goal) throw goalError || new Error('Could not load the goal context.');
    if (answerError) throw answerError;
    return buildGoalContext(goal as Goal, (answerRows || []) as GoalClarificationAnswer[]);
  }

  async function saveClarificationQuestions(goalId: string, next: GoalClarification) {
    const { error: deleteError } = await supabase.from('goal_clarification_answers').delete().eq('goal_id', goalId);
    if (deleteError) throw deleteError;
    const { error: insertError } = await supabase.from('goal_clarification_answers').insert(next.questions.map((question, index) => ({ goal_id: goalId, user_id: userId, question, answer: null, question_order: index })));
    if (insertError) throw insertError;
  }

  async function askQuestions() {
    if (!rawInput.trim() || planning || availableDays.length === 0) return;
    setPlanning(true);
    setError('');
    try {
      const goalId = await ensureDraft();
      const context = await loadGoal(goalId);
      const resourcePlan = buildResourceSearchPlan(context);
      const { data, error: invokeError } = await supabase.functions.invoke('vow-goal-ai', {
        body: {
          mode: 'goal-clarify',
          goal: context.goal,
          goal_context: context,
          resource_search: resourcePlan,
          message: `${goalContextPrompt(context)}\n\nAsk 2-3 high-value, domain-specific follow-up questions. Do not ask for information already supplied.`,
          available_days: availableDays,
          references: [],
        },
      });
      const fallback = fallbackQuestions(rawInput.trim(), durationWeeks);
      if (invokeError && !data?.structured) throw invokeError;
      const next = parseClarification(data?.structured, fallback);
      setClarification(next);
      setAnswers(next.questions.map(() => ''));
      await saveClarificationQuestions(goalId, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'VOW could not prepare the follow-up questions.');
    } finally {
      setPlanning(false);
    }
  }

  async function buildPlan() {
    if (!clarification || planning || availableDays.length === 0) return;
    setPlanning(true);
    setError('');
    try {
      const goalId = await ensureDraft();
      const clean = answers.map((answer) => answer.trim());
      const { error: deleteError } = await supabase.from('goal_clarification_answers').delete().eq('goal_id', goalId);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabase.from('goal_clarification_answers').insert(clarification.questions.map((question, index) => ({ goal_id: goalId, user_id: userId, question, answer: clean[index] || null, question_order: index })));
      if (insertError) throw insertError;
      const context = await loadGoal(goalId);
      const resourcePlan = buildResourceSearchPlan(context);
      const start = nextMonday();
      const fallback = fallbackPlan(rawInput.trim(), durationWeeks, availableDays);
      const { data, error: invokeError } = await supabase.functions.invoke('vow-goal-ai', {
        body: {
          mode: 'goal-plan',
          goal: { ...context.goal, start_date: toDateString(start), deadline: deadlineFor(start, durationWeeks), duration_weeks: durationWeeks, weekly_commitment_target: availableDays.length },
          goal_context: context,
          resource_search: resourcePlan,
          message: `${goalContextPrompt(context)}\n\nBuild the final personalised VOW plan. Duration is exactly ${durationLabel(durationWeeks)}. Available days are exactly ${availableDays.join(', ')}. Follow-up answers are binding context.`,
          answers: context.answers.map((answer) => ({ question: answer.question, answer: answer.answer || '' })),
          available_days: availableDays,
          references: [],
        },
      });
      if (invokeError && !data?.structured) throw invokeError;
      const next = parsePlan(data?.structured, fallback);
      if (next.duration_weeks !== durationWeeks) throw new Error('VOW returned a plan with the wrong duration.');
      setPlan(normaliseSchedule(next, start, durationWeeks, availableDays));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'VOW could not build the plan.');
    } finally {
      setPlanning(false);
    }
  }

  async function handleCreate() {
    if (!plan || !draftGoalId || saving) return;
    setSaving(true);
    setError('');
    try {
      const start = nextMonday();
      const { error: goalError } = await supabase.from('goals').update({
        title: rawInput.trim(),
        outcome: plan.outcome || rawInput.trim(),
        why_it_matters: why.trim() || null,
        start_date: toDateString(start),
        deadline: deadlineFor(start, durationWeeks),
        duration: `${durationWeeks}w`,
        status: 'active',
        weekly_commitment_target: availableDays.length,
        plan_json: plan,
        plan_version: 2,
        plan_generated_at: new Date().toISOString(),
        planning_horizon_weeks: durationWeeks,
        planning_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }).eq('id', draftGoalId).eq('user_id', userId);
      if (goalError) throw goalError;
      const { data: milestones, error: milestoneError } = await supabase.from('milestones').insert(plan.milestones.map((milestone, index) => ({
        goal_id: draftGoalId,
        title: milestone.title,
        description: milestone.description,
        sort_order: index,
        deadline: deadlineFor(start, Math.min(durationWeeks, Math.max(1, milestone.week))),
        status: index === 0 ? 'in_progress' : 'pending',
      }))).select('id,sort_order').order('sort_order');
      if (milestoneError) throw milestoneError;
      const milestoneRows = (milestones || []) as Array<{ id: string; sort_order: number }>;
      const rows = plan.schedule.map((item) => {
        const milestoneIndex = Math.min(Math.max(0, Math.floor(((item.week - 1) / Math.max(1, durationWeeks)) * milestoneRows.length)), Math.max(0, milestoneRows.length - 1));
        return {
          goal_id: draftGoalId,
          milestone_id: milestoneRows[milestoneIndex]?.id ?? null,
          user_id: userId,
          title: item.task,
          scheduled_at: item.scheduled_at,
          duration_minutes: Math.max(5, Number(item.duration_minutes) || 30),
          status: 'scheduled',
          notes: [item.purpose, item.target_metric ? `Target: ${item.target_metric}` : null].filter(Boolean).join('\n') || null,
        };
      });
      if (!rows.length) throw new Error('The generated schedule is empty.');
      const { data: sessions, error: sessionError } = await supabase.from('sessions').insert(rows).select('*');
      if (sessionError) throw sessionError;
      if (sessions) {
        try { await syncUpcomingSessionNotifications(sessions as Session[]); } catch { console.warn('[VOW] Session notifications could not be synced.'); }
      }
      try { await supabase.functions.invoke('google-calendar-sync-goal', { body: { goalId: draftGoalId } }); } catch { console.warn('[VOW] Google Calendar sync could not be completed.'); }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create goal.');
    } finally {
      setSaving(false);
    }
  }

  if (plan) return <div>
    <button onClick={() => setPlan(null)} className="text-sm text-vow-muted hover:text-vow-ink mb-6">← Adjust answers</button>
    <PageHeader title="Your VOW plan" subtitle={`${durationLabel(durationWeeks)} · ${availableDays.length} sessions/week`} />
    <div className="max-w-3xl space-y-6">
      <section className="border border-vow-border p-5"><p className="vow-label mb-2">Outcome</p><p className="text-lg font-medium text-vow-ink">{plan.outcome}</p><p className="text-sm text-vow-muted mt-3">{plan.summary}</p></section>
      <section className="border border-vow-border p-5"><p className="vow-label mb-2">Success metric</p><p className="text-sm text-vow-ink">{plan.success_metric}</p><p className="vow-label mt-5 mb-2">Baseline</p><p className="text-sm text-vow-muted">{plan.baseline}</p></section>
      <section className="border border-vow-border p-5"><p className="vow-label mb-4">Schedule · {durationLabel(durationWeeks)}</p><div className="divide-y divide-vow-border">{plan.schedule.map((item, index) => <div key={`${item.week}-${item.day}-${index}`} className="py-3 flex gap-3"><span className="text-xs text-vow-muted w-12 shrink-0">W{item.week}</span><span className="text-xs text-vow-muted w-20 shrink-0">{item.day}</span><div><p className="text-sm text-vow-ink font-medium">{item.task}</p><p className="text-xs text-vow-muted mt-1">{item.duration_minutes} min · {item.target_metric}</p></div></div>)}</div></section>
      <section className="border border-vow-border p-5"><p className="vow-label mb-4">Milestones & progression</p>{plan.milestones.map((milestone) => <div key={`${milestone.week}-${milestone.title}`} className="mb-4"><p className="text-sm text-vow-ink font-medium">Week {milestone.week} · {milestone.title}</p><p className="text-xs text-vow-muted mt-1">{milestone.description}</p></div>)}<p className="text-sm text-vow-muted pt-4 border-t border-vow-border">{plan.progression}</p></section>
      {error && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">{error}</p>}
      <div className="flex gap-3"><button onClick={() => setPlan(null)} className="vow-btn-ghost">Back</button><button onClick={handleCreate} disabled={saving} className="vow-btn-primary flex-1">{saving ? 'Locking in...' : 'Lock in VOW'}</button></div>
    </div>
  </div>;

  if (clarification) return <div>
    <button onClick={() => setClarification(null)} className="text-sm text-vow-muted hover:text-vow-ink mb-6">← Adjust goal</button>
    <PageHeader title="A few questions first" subtitle="VOW uses your answers to make the commitment genuinely yours." />
    <div className="max-w-xl space-y-6">{clarification.questions.map((question, index) => <div key={`${index}-${question}`}><label className="vow-label block mb-2" htmlFor={`clarification-${index}`}>{question}</label><textarea id={`clarification-${index}`} value={answers[index] || ''} onChange={(event) => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))} rows={3} className="vow-input resize-none" placeholder="Your answer..." /></div>)}<p className="text-xs text-vow-muted">{clarification.rationale}</p>{error && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">{error}</p>}<div className="flex gap-3"><button onClick={() => setClarification(null)} className="vow-btn-ghost">Back</button><button onClick={buildPlan} disabled={planning} className="vow-btn-primary flex-1">{planning ? 'VOW is building your plan...' : 'Build my VOW plan'}</button></div></div>
  </div>;

  return <div>
    <PageHeader title="New goal" subtitle="Tell VOW what you want to accomplish. It will ask the right questions before building your plan." />
    <div className="max-w-xl space-y-6">
      <textarea value={rawInput} onChange={(event) => setRawInput(event.target.value)} rows={4} className="vow-input resize-none" placeholder="e.g. Run a sub-60-minute 10K" autoFocus />
      <div><label className="vow-label block mb-2" htmlFor="goal-why">Why does this matter?</label><textarea id="goal-why" value={why} onChange={(event) => setWhy(event.target.value)} rows={2} className="vow-input resize-none" placeholder="Give VOW the reason behind the commitment." /></div>
      <div><label className="vow-label block mb-3">How long are you committing?</label><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{DURATION_OPTIONS.map((option) => <button key={option.weeks} type="button" onClick={() => setDurationWeeks(option.weeks)} className={`text-left border px-3 py-3 transition-colors ${durationWeeks === option.weeks ? 'border-vow-ink bg-vow-ink text-vow-bg' : 'border-vow-border text-vow-muted hover:text-vow-ink'}`}><span className="block text-sm font-medium">{option.label}</span><span className={`block text-[10px] mt-1 ${durationWeeks === option.weeks ? 'text-vow-bg/70' : 'text-vow-muted'}`}>{option.detail}</span></button>)}</div></div>
      <div><label className="vow-label block mb-3">Available days</label><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{DAYS.map((day) => <button key={day} type="button" onClick={() => toggleDay(day)} className={`border px-3 py-2 text-xs transition-colors ${availableDays.includes(day) ? 'border-vow-ink bg-vow-ink text-vow-bg' : 'border-vow-border text-vow-muted hover:text-vow-ink'}`}>{day}</button>)}</div></div>
      {error && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">{error}</p>}
      <div className="flex gap-3"><button onClick={onCancel} className="vow-btn-ghost">Cancel</button><button onClick={askQuestions} disabled={!rawInput.trim() || planning || availableDays.length === 0} className="vow-btn-primary flex-1">{planning ? 'VOW is preparing questions...' : 'Continue'}</button></div>
    </div>
  </div>;
}
