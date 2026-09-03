import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const aiFallback = (init?: RequestInit) => {
  try {
    const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
    const goal = body?.goal || {};
    const armadillo = body?.armadillo || {};
    const mode = body?.mode;
    const title = String(goal?.title || goal?.outcome || 'your goal');
    const metric = String(armadillo?.metric || 'measurable progress');
    const category = String(armadillo?.category || 'General');
    const goalType = String(armadillo?.goal_type || 'Goal');

    if (mode === 'goal-clarify') {
      const first = category === 'Sports'
        ? `What is your recent baseline for ${title}, and what does meaningful progress look like?`
        : category === 'Education'
          ? `What is your current level in this area, and what result are you aiming for?`
          : category === 'Reading'
            ? `What are you reading or studying now, and what outcome do you want to reach?`
            : `What is your current baseline for ${title}, and what would meaningful progress look like?`;
      return {
        structured: {
          questions: [
            first,
            `What would make this ${goalType.toLowerCase()} successful in a way we can measure?`,
            'What real-world constraints or preferences should VOW design around?'
          ],
          recommended_duration_weeks: Number(goal?.duration_weeks) || 8,
          rationale: `Armadillo classified this as ${category} / ${goalType} using ${metric}. VOW is using a local fallback so you can keep moving.`
        },
        armadillo,
        fallback: true,
        text: 'VOW AI fallback'
      };
    }

    if (mode === 'goal-plan') {
      const weeks = Math.max(1, Math.min(52, Number(goal?.duration_weeks) || 8));
      const selectedDays = Array.isArray(body?.available_days) && body.available_days.length
        ? body.available_days
        : ['Monday', 'Wednesday', 'Saturday'];
      const schedule = [];
      for (let week = 1; week <= weeks; week += 1) {
        for (const day of selectedDays) {
          schedule.push({
            week,
            day: String(day),
            task: week === 1 ? `Build the foundation for ${title}` : `Progress toward ${title}`,
            purpose: 'Make useful, measurable progress without overloading the commitment.',
            target_metric: metric,
            duration_minutes: 30,
            preferred_time: '09:00'
          });
        }
      }
      const plan = {
        outcome: title,
        success_metric: `Progress using ${metric}.`,
        baseline: 'Establish the starting point in week 1.',
        assumptions: [`Armadillo classified this as ${category} / ${goalType}.`],
        milestones: [
          { title: 'Baseline', description: 'Measure the starting point.', week: 1 },
          { title: 'Build', description: 'Build consistency from the baseline.', week: Math.max(1, Math.ceil(weeks / 2)) },
          { title: 'Finish', description: 'Review the outcome and evidence.', week: weeks }
        ],
        schedule,
        progression: 'Progress only when the current workload is being handled consistently.',
        checkpoints: ['Review progress weekly.', 'Adjust from evidence rather than guessing.'],
        risks: ['Inconsistency', 'Increasing workload too quickly'],
        fallback_rules: ['If a session is missed, resume at the next available day rather than doubling the workload.'],
        summary: `A ${weeks}-week ${goalType.toLowerCase()} plan for ${title}.`,
        duration_weeks: weeks,
        weekly_commitment_target: selectedDays.length,
        available_days: selectedDays,
        armadillo
      };
      return { structured: plan, armadillo, fallback: true, text: 'VOW AI fallback' };
    }

    return { text: 'VOW AI is ready to help.' };
  } catch {
    return { error: 'VOW AI fallback could not parse the request.' };
  }
};

const resilientFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
  const isGoalAi = url.includes('/functions/v1/vow-goal-ai');
  if (!isGoalAi) return fetch(input, init);

  try {
    const response = await fetch(input, init);
    if (response.ok) return response;
    return new Response(JSON.stringify(aiFallback(init)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {
    return new Response(JSON.stringify(aiFallback(init)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: resilientFetch,
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
