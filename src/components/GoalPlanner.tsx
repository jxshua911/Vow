import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { addDays, toDateString } from '@/lib/dates';
import { syncUpcomingSessionNotifications } from '@/lib/notifications';
import type { Session } from '@/types/database';
import {
  analyseGoalForEvidence,
  type ArmadilloResult,
} from '@/lib/armadillo';
import { PageHeader } from './AppShell';

type Clarification = {
  questions: string[];
  recommended_duration_weeks: number;
  rationale: string;
};

type PlanItem = {
  week: number;
  day: string;
  task: string;
  purpose: string;
  target_metric: string;
  duration_minutes: number;
  preferred_time: string;
  scheduled_at?: string;
};

type Plan = {
  outcome: string;
  success_metric: string;
  baseline: string;
  assumptions: string[];
  milestones: Array<{
    title: string;
    description: string;
    week: number;
  }>;
  schedule: PlanItem[];
  progression: string;
  checkpoints: string[];
  risks: string[];
  fallback_rules: string[];
  summary: string;
  duration_weeks: number;
  weekly_commitment_target: number;
  available_days: string[];
  armadillo?: ArmadilloResult;
};

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

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
  const d = new Date();
  const day = d.getDay();

  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + (day === 0 ? 1 : 8 - day));

  return d;
}

function deadlineFor(start: Date, weeks: number) {
  return toDateString(addDays(start, weeks * 7 - 1));
}

function durationLabel(w: number) {
  const option = DURATION_OPTIONS.find((x) => x.weeks === w);
  return option?.label || `${w} weeks`;
}

export function GoalPlanner({
  userId,
  onCreated,
  onCancel,
}: {
  userId: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [rawInput, setRawInput] = useState('');
  const [why, setWhy] = useState('');
  const [durationWeeks, setDurationWeeks] = useState(8);

  const [availableDays, setAvailableDays] = useState<string[]>([
    'Monday',
    'Wednesday',
    'Saturday',
  ]);

  const [clarification, setClarification] =
    useState<Clarification | null>(null);

  const [answers, setAnswers] = useState<string[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [draftGoalId, setDraftGoalId] = useState<string | null>(null);

  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggleDay(day: string) {
    setAvailableDays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : current.length < 7
          ? [...current, day]
          : current
    );
  }

  function getArmadillo(): ArmadilloResult {
    return analyseGoalForEvidence({
      title: rawInput.trim(),
      outcome: rawInput.trim(),
      why_it_matters: why.trim() || null,
    });
  }

  async function ensureDraft() {
    if (draftGoalId) return draftGoalId;

    const start = nextMonday();

    const { data, error: e } = await supabase
      .from('goals')
      .insert({
        user_id: userId,
        title: rawInput.trim(),
        outcome: rawInput.trim(),
        why_it_matters: why.trim() || null,
        start_date: toDateString(start),
        deadline: deadlineFor(start, durationWeeks),
        duration: `${durationWeeks}w`,
        status: 'draft',
        weekly_commitment_target: availableDays.length,
      })
      .select('id')
      .single();

    if (e || !data) {
      throw e || new Error('Could not start this goal.');
    }

    setDraftGoalId(data.id);

    return data.id;
  }

  async function loadReferences(goalId: string) {
    const { data } = await supabase
      .from('goal_resources')
      .select('url,title,resource_type')
      .eq('goal_id', goalId)
      .order('created_at', { ascending: false })
      .limit(4);

    return data || [];
  }

  async function saveClarificationQuestions(
    goalId: string,
    questions: string[]
  ) {
    const { error: deleteError } = await supabase
      .from('goal_clarification_answers')
      .delete()
      .eq('goal_id', goalId);

    if (deleteError) {
      throw deleteError;
    }

    const { error: insertError } = await supabase
      .from('goal_clarification_answers')
      .insert(
        questions.map((question, index) => ({
          goal_id: goalId,
          user_id: userId,
          question,
          answer: null,
          question_order: index,
        }))
      );

    if (insertError) {
      throw insertError;
    }
  }

  async function askQuestions() {
    if (!rawInput.trim() || planning || availableDays.length === 0) {
      return;
    }

    setPlanning(true);
    setError('');

    try {
      const goalId = await ensureDraft();
      const references = await loadReferences(goalId);
      const armadillo = getArmadillo();

      /*
       * This is VOW's guaranteed local fallback.
       *
       * AI can improve these questions, but AI is NOT allowed
       * to block the user from continuing.
       */
      const localQuestions: Clarification = {
        questions: [
          `What does success look like for your ${armadillo.metric} target?`,
          `What is your current level with this goal?`,
          'Is there anything VOW should work around?',
        ],
        recommended_duration_weeks: durationWeeks,
        rationale:
          'These questions help VOW personalise your plan without blocking you when AI is unavailable.',
      };

      try {
        const { data, error: functionError } =
          await supabase.functions.invoke('vow-goal-ai', {
            body: {
              mode: 'goal-clarify',

              goal: {
                id: goalId,
                title: rawInput.trim(),
                outcome: rawInput.trim(),
                why_it_matters: why.trim() || null,
                duration_weeks: durationWeeks,
                weekly_commitment_target: availableDays.length,
              },

              armadillo,

              message: `Goal: ${rawInput.trim()}
Why it matters: ${why.trim() || 'Not supplied.'}
Duration: ${durationLabel(durationWeeks)}.
Available days: ${availableDays.join(', ')}

Armadillo:
Category: ${armadillo.category}
Goal type: ${armadillo.goal_type}
Metric: ${armadillo.metric}
Evidence: ${armadillo.evidence.join(', ')}
Suggested integration: ${armadillo.integration || 'none'}

Ask 2-3 high-value follow-up questions that materially improve a personalised plan.
Do not ask about information already supplied.`,

              available_days: availableDays,
              references,
            },
          });

        /*
         * AI worked.
         */
        if (
          !functionError &&
          data?.structured &&
          Array.isArray(data.structured.questions) &&
          data.structured.questions.length > 0
        ) {
          const next = data.structured as Clarification;

          setClarification(next);
          setAnswers(next.questions.map(() => ''));

          await saveClarificationQuestions(
            goalId,
            next.questions
          );

          return;
        }

        /*
         * AI returned an error/malformed response.
         * Continue locally instead of showing the old fatal error.
         */
        console.warn(
          '[VOW] Goal AI clarification unavailable. Using local fallback.',
          functionError || data
        );

        setClarification(localQuestions);
        setAnswers(localQuestions.questions.map(() => ''));

        await saveClarificationQuestions(
          goalId,
          localQuestions.questions
        );
      } catch (aiError) {
        /*
         * Network failure, Edge Function failure, auth issue,
         * timeout, Capacitor fetch issue, etc.
         *
         * None of these should stop goal creation.
         */
        console.warn(
          '[VOW] Goal AI clarification failed. Using local fallback.',
          aiError
        );

        setClarification(localQuestions);
        setAnswers(localQuestions.questions.map(() => ''));

        await saveClarificationQuestions(
          goalId,
          localQuestions.questions
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start this goal.'
      );
    } finally {
      setPlanning(false);
    }
  }

  async function buildPlan() {
    if (
      !clarification ||
      planning ||
      availableDays.length === 0
    ) {
      return;
    }

    setPlanning(true);
    setError('');

    try {
      const goalId = await ensureDraft();

      const clean = answers.map((answer) => answer.trim());

      const { error: deleteError } = await supabase
        .from('goal_clarification_answers')
        .delete()
        .eq('goal_id', goalId);

      if (deleteError) {
        throw deleteError;
      }

      const { error: insertError } = await supabase
        .from('goal_clarification_answers')
        .insert(
          clarification.questions.map((question, index) => ({
            goal_id: goalId,
            user_id: userId,
            question,
            answer: clean[index] || null,
            question_order: index,
          }))
        );

      if (insertError) {
        throw insertError;
      }

      const references = await loadReferences(goalId);
      const armadillo = getArmadillo();
      const start = nextMonday();

      const { data, error: functionError } =
        await supabase.functions.invoke('vow-goal-ai', {
          body: {
            mode: 'goal-plan',

            goal: {
              id: goalId,
              title: rawInput.trim(),
              outcome: rawInput.trim(),
              why_it_matters: why.trim() || null,
              start_date: toDateString(start),
              deadline: deadlineFor(start, durationWeeks),
              duration_weeks: durationWeeks,
              weekly_commitment_target: availableDays.length,
            },

            armadillo,

            message: `Build the final personalised VOW plan using these follow-up answers:

${clarification.questions
  .map(
    (question, index) =>
      `Q: ${question}\nA: ${
        clean[index] || 'Skipped / not supplied'
      }`
  )
  .join('\n')}

Armadillo intelligence:
${JSON.stringify(armadillo)}

The user's duration is exactly ${durationLabel(
              durationWeeks
            )}.

Available days are exactly:
${availableDays.join(', ')}

Use the answers and references to tailor the plan, progression, sessions, targets and fallback rules.`,

            answers: clarification.questions.map(
              (question, index) => ({
                question,
                answer: clean[index] || '',
              })
            ),

            available_days: availableDays,
            references,
          },
        });

      /*
       * If AI works, use the generated plan.
       */
      if (
        !functionError &&
        data?.structured
      ) {
        const next = data.structured as Plan;

        if (
          next.duration_weeks === durationWeeks &&
          Array.isArray(next.schedule) &&
          next.schedule.length > 0
        ) {
          next.armadillo =
            data.armadillo || armadillo;

          setPlan(next);

          return;
        }
      }

      /*
       * AI failed.
       *
       * Instead of killing the flow, create a useful local
       * plan based on Armadillo and the user's selected days.
       */
      console.warn(
        '[VOW] Goal AI planning unavailable. Using local fallback.',
        functionError || data
      );

      const fallbackSchedule: PlanItem[] =
        availableDays.flatMap((day) => {
          const items: PlanItem[] = [];

          for (
            let week = 1;
            week <= durationWeeks;
            week++
          ) {
            items.push({
              week,
              day,
              task: `${armadillo.goal_type} — focused session`,
              purpose:
                `Build consistent progress toward ${rawInput.trim()}.`,
              target_metric:
                armadillo.metric || 'Progress toward goal',
              duration_minutes: 30,
              preferred_time: '09:00',
            });
          }

          return items;
        });

      const fallbackPlan: Plan = {
        outcome: rawInput.trim(),

        success_metric:
          `${armadillo.metric} progress toward your stated goal.`,

        baseline:
          'Starting baseline will be established through your first sessions and ongoing evidence.',

        assumptions: [
          'Your selected available days are realistic for your routine.',
          'Progress should build gradually rather than forcing maximum effort.',
          'Manual tracking remains available if no integration is connected.',
        ],

        milestones: Array.from(
          {
            length: Math.max(
              1,
              Math.ceil(durationWeeks / 4)
            ),
          },
          (_, index) => {
            const week = Math.min(
              durationWeeks,
              (index + 1) * 4
            );

            return {
              title: `Week ${week} checkpoint`,
              description:
                `Review your ${armadillo.metric} progress and adjust the next phase based on what you actually achieved.`,
              week,
            };
          }
        ),

        schedule: fallbackSchedule,

        progression:
          'Start consistently, establish your baseline, then gradually increase the quality or amount of work as your evidence shows you can handle it.',

        checkpoints: [
          'Review progress weekly.',
          'Compare actual evidence against the target.',
          'Adjust the next week rather than abandoning the commitment.',
        ],

        risks: [
          'Doing too much too quickly.',
          'Missing sessions and trying to compensate by overloading the next one.',
          'Treating the original plan as more important than real-world feedback.',
        ],

        fallback_rules: [
          'If a session is missed, resume at the next available session.',
          'Do not double the workload to compensate for a missed session.',
          'If progress stalls, reassess the next checkpoint before increasing difficulty.',
        ],

        summary:
          `A ${durationLabel(
            durationWeeks
          )} VOW built around ${armadillo.goal_type} with ${
            availableDays.length
          } planned sessions per week.`,

        duration_weeks: durationWeeks,

        weekly_commitment_target:
          availableDays.length,

        available_days: availableDays,

        armadillo,
      };

      setPlan(fallbackPlan);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'VOW could not build the plan.'
      );
    } finally {
      setPlanning(false);
    }
  }

  async function handleCreate() {
    if (!plan || !draftGoalId || saving) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      const start = nextMonday();

      const { error: goalError } = await supabase
        .from('goals')
        .update({
          title: rawInput.trim(),
          outcome:
            plan.outcome || rawInput.trim(),
          why_it_matters:
            why.trim() || null,
          start_date: toDateString(start),
          deadline: deadlineFor(
            start,
            durationWeeks
          ),
          duration: `${durationWeeks}w`,
          status: 'active',
          weekly_commitment_target:
            availableDays.length,
          plan_json: plan,
          plan_version: 1,
          plan_generated_at:
            new Date().toISOString(),
          planning_horizon_weeks:
            durationWeeks,
          planning_timezone:
            Intl.DateTimeFormat().resolvedOptions()
              .timeZone,
        })
        .eq('id', draftGoalId);

      if (goalError) {
        throw goalError;
      }

      const {
        data: milestones,
        error: milestoneError,
      } = await supabase
        .from('milestones')
        .insert(
          plan.milestones.map((milestone, index) => ({
            goal_id: draftGoalId,
            title: milestone.title,
            description:
              milestone.description,
            sort_order: index,
            deadline: deadlineFor(
              start,
              Math.min(
                durationWeeks,
                Math.max(
                  1,
                  milestone.week
                )
              )
            ),
            status:
              index === 0
                ? 'in_progress'
                : 'pending',
          }))
        )
        .select('id,sort_order')
        .order('sort_order');

      if (milestoneError) {
        throw milestoneError;
      }

      const rows = plan.schedule
        .filter((item) =>
          availableDays.includes(item.day)
        )
        .map((item) => {
          const week = Math.max(
            1,
            Math.min(
              durationWeeks,
              item.week
            )
          );

          const dayIndex = Math.max(
            0,
            DAYS.indexOf(item.day)
          );

          const date = addDays(
            start,
            (week - 1) * 7 + dayIndex
          );

          const match =
            /^(\d{1,2}):(\d{2})/.exec(
              item.preferred_time ||
                '09:00'
            );

          date.setHours(
            Math.min(
              23,
              Number(match?.[1] || 9)
            ),
            Math.min(
              59,
              Number(match?.[2] || 0)
            ),
            0,
            0
          );

          const milestoneCount =
            milestones?.length || 0;

          const milestoneIndex =
            milestoneCount > 0
              ? Math.min(
                  Math.max(
                    0,
                    Math.floor(
                      ((week - 1) /
                        Math.max(
                          1,
                          durationWeeks
                        )) *
                        milestoneCount
                    )
                  ),
                  milestoneCount - 1
                )
              : 0;

          return {
            goal_id: draftGoalId,
            milestone_id:
              milestones?.[
                milestoneIndex
              ]?.id ?? null,
            user_id: userId,
            title: item.task,
            scheduled_at:
              date.toISOString(),
            duration_minutes: Math.max(
              5,
              Number(
                item.duration_minutes
              ) || 30
            ),
            status: 'scheduled',
            notes:
              [
                item.purpose,
                item.target_metric
                  ? `Target: ${item.target_metric}`
                  : null,
              ]
                .filter(Boolean)
                .join('\n') || null,
          };
        });

      if (!rows.length) {
        throw new Error(
          'The generated schedule does not match your selected days.'
        );
      }

      const {
        data: sessions,
        error: sessionError,
      } = await supabase
        .from('sessions')
        .insert(rows)
        .select('*');

      if (sessionError) {
        throw sessionError;
      }

      if (sessions) {
        try {
          await syncUpcomingSessionNotifications(
            sessions as Session[]
          );
        } catch {
          console.warn(
            '[VOW] Session notifications could not be synced.'
          );
        }
      }

      try {
        await supabase.functions.invoke(
          'google-calendar-sync-goal',
          {
            body: {
              goalId: draftGoalId,
            },
          }
        );
      } catch {
        console.warn(
          '[VOW] Google Calendar sync could not be completed.'
        );
      }

      onCreated();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create goal.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (plan) {
    return (
      <div>
        <button
          onClick={() => setPlan(null)}
          className="text-sm text-vow-muted hover:text-vow-ink mb-6"
        >
          ← Adjust answers
        </button>

        <PageHeader
          title="Your VOW plan"
          subtitle={`${durationLabel(
            durationWeeks
          )} · ${
            availableDays.length
          } sessions/week`}
        />

        <div className="max-w-3xl space-y-6">
          <section className="border border-vow-border p-5">
            <p className="vow-label mb-2">
              Outcome
            </p>

            <p className="text-lg font-medium text-vow-ink">
              {plan.outcome}
            </p>

            <p className="text-sm text-vow-muted mt-3">
              {plan.summary}
            </p>
          </section>

          {plan.armadillo && (
            <section className="border border-vow-border p-5">
              <p className="vow-label mb-3">
                Armadillo intelligence
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-vow-muted">
                    Category
                  </p>
                  <p className="text-vow-ink mt-1">
                    {plan.armadillo.category}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-vow-muted">
                    Goal type
                  </p>
                  <p className="text-vow-ink mt-1">
                    {plan.armadillo.goal_type}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-vow-muted">
                    Metric
                  </p>
                  <p className="text-vow-ink mt-1">
                    {plan.armadillo.metric}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-vow-muted">
                    Evidence
                  </p>
                  <p className="text-vow-ink mt-1">
                    {plan.armadillo.evidence.join(
                      ', '
                    )}
                  </p>
                </div>
              </div>

              {plan.armadillo.integration && (
                <p className="text-xs text-vow-muted mt-4">
                  Suggested evidence source:{' '}
                  {plan.armadillo.integration}.
                  Manual tracking remains available.
                </p>
              )}
            </section>
          )}

          <section className="border border-vow-border p-5">
            <p className="vow-label mb-2">
              Success metric
            </p>

            <p className="text-sm text-vow-ink">
              {plan.success_metric}
            </p>

            <p className="vow-label mt-5 mb-2">
              Baseline
            </p>

            <p className="text-sm text-vow-muted">
              {plan.baseline}
            </p>
          </section>

          <section className="border border-vow-border p-5">
            <p className="vow-label mb-4">
              Schedule ·{' '}
              {durationLabel(durationWeeks)}
            </p>

            <div className="divide-y divide-vow-border">
              {plan.schedule.map(
                (item, index) => (
                  <div
                    key={`${item.week}-${item.day}-${index}`}
                    className="py-3 flex gap-3"
                  >
                    <span className="text-xs text-vow-muted w-12 shrink-0">
                      W{item.week}
                    </span>

                    <span className="text-xs text-vow-muted w-20 shrink-0">
                      {item.day}
                    </span>

                    <div>
                      <p className="text-sm text-vow-ink font-medium">
                        {item.task}
                      </p>

                      <p className="text-xs text-vow-muted mt-1">
                        {item.duration_minutes}{' '}
                        min ·{' '}
                        {item.target_metric}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>

          <section className="border border-vow-border p-5">
            <p className="vow-label mb-4">
              Milestones & progression
            </p>

            {plan.milestones.map(
              (milestone) => (
                <div
                  key={`${milestone.week}-${milestone.title}`}
                  className="mb-4"
                >
                  <p className="text-sm text-vow-ink font-medium">
                    Week {milestone.week} ·{' '}
                    {milestone.title}
                  </p>

                  <p className="text-xs text-vow-muted mt-1">
                    {milestone.description}
                  </p>
                </div>
              )
            )}

            <p className="text-sm text-vow-muted pt-4 border-t border-vow-border">
              {plan.progression}
            </p>
          </section>

          {error && (
            <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setPlan(null)}
              className="vow-btn-ghost"
            >
              Back
            </button>

            <button
              onClick={handleCreate}
              disabled={saving}
              className="vow-btn-primary flex-1"
            >
              {saving
                ? 'Locking in...'
                : 'Lock in VOW'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (clarification) {
    return (
      <div>
        <button
          onClick={() =>
            setClarification(null)
          }
          className="text-sm text-vow-muted hover:text-vow-ink mb-6"
        >
          ← Adjust goal
        </button>

        <PageHeader
          title="A few questions first"
          subtitle="VOW uses your answers to make the commitment genuinely yours."
        />

        <div className="max-w-xl space-y-6">
          {clarification.questions.map(
            (question, index) => (
              <div
                key={`${index}-${question}`}
              >
                <label className="vow-label block mb-2">
                  {question}
                </label>

                <textarea
                  value={
                    answers[index] || ''
                  }
                  onChange={(event) =>
                    setAnswers((current) =>
                      current.map(
                        (answer, i) =>
                          i === index
                            ? event.target.value
                            : answer
                      )
                    )
                  }
                  rows={3}
                  className="vow-input resize-none"
                  placeholder="Your answer..."
                />
              </div>
            )
          )}

          <p className="text-xs text-vow-muted">
            {clarification.rationale}
          </p>

          {error && (
            <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() =>
                setClarification(null)
              }
              className="vow-btn-ghost"
            >
              Back
            </button>

            <button
              onClick={buildPlan}
              disabled={planning}
              className="vow-btn-primary flex-1"
            >
              {planning
                ? 'VOW is building your plan...'
                : 'Build my VOW plan'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="New goal"
        subtitle="Tell VOW what you want to accomplish. It will ask the right questions before building your plan."
      />

      <div className="max-w-xl space-y-6">
        <textarea
          value={rawInput}
          onChange={(event) =>
            setRawInput(event.target.value)
          }
          rows={4}
          className="vow-input resize-none"
          placeholder="e.g. Run a sub-60-minute 10K"
          autoFocus
        />

        <div>
          <label className="vow-label block mb-2">
            Why does this matter?
          </label>

          <textarea
            value={why}
            onChange={(event) =>
              setWhy(event.target.value)
            }
            rows={2}
            className="vow-input resize-none"
            placeholder="Give VOW the reason behind the commitment."
          />
        </div>

        <div>
          <label className="vow-label block mb-3">
            How long are you committing?
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DURATION_OPTIONS.map(
              (option) => (
                <button
                  key={option.weeks}
                  type="button"
                  onClick={() =>
                    setDurationWeeks(
                      option.weeks
                    )
                  }
                  className={`text-left border px-3 py-3 transition-colors ${
                    durationWeeks ===
                    option.weeks
                      ? 'border-vow-ink bg-vow-ink text-vow-bg'
                      : 'border-vow-border text-vow-muted hover:text-vow-ink'
                  }`}
                >
                  <span className="block text-sm font-medium">
                    {option.label}
                  </span>

                  <span
                    className={`block text-[10px] mt-1 ${
                      durationWeeks ===
                      option.weeks
                        ? 'text-vow-bg/70'
                        : 'text-vow-muted'
                    }`}
                  >
                    {option.detail}
                  </span>
                </button>
              )
            )}
          </div>
        </div>

        <div>
          <label className="vow-label block mb-3">
            Available days
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DAYS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() =>
                  toggleDay(day)
                }
                className={`border px-3 py-2 text-xs transition-colors ${
                  availableDays.includes(day)
                    ? 'border-vow-ink bg-vow-ink text-vow-bg'
                    : 'border-vow-border text-vow-muted hover:text-vow-ink'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="vow-btn-ghost"
          >
            Cancel
          </button>

          <button
            onClick={askQuestions}
            disabled={
              !rawInput.trim() ||
              planning ||
              availableDays.length === 0
            }
            className="vow-btn-primary flex-1"
          >
            {planning
              ? 'VOW is preparing questions...'
              : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
