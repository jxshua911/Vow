import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { addDays, toDateString } from '@/lib/dates';
import { syncUpcomingSessionNotifications } from '@/lib/notifications';
import { consumeEntitlement, type EntitlementResult } from '@/lib/entitlements';
import { UpgradePrompt } from './UpgradePrompt';
import { checkContentSafety } from '@/lib/contentSafety';
import type { Session } from '@/types/database';
import { PageHeader } from './AppShell';
import { normalizeGoalCategory, type GoalCategory } from '@/lib/goalCategories';
import { userFacingError } from '@/lib/userFacingError';
import { analyseGoalForEvidence, recommendGoalIntegrations } from '@/lib/armadillo';
import { openExternalLink } from '@/lib/externalLinks';

type Clarification = {
  questions: string[];
  recommended_duration_weeks: number;
  rationale: string;
  category?: unknown;
  goal_type?: unknown;
  classification_confidence?: unknown;
};
type GoalDomain = { category: GoalCategory; goal_type: string };
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
type PlanReference = {
  url: string;
  title: string | null;
  resource_type: 'youtube' | 'instagram' | 'image' | 'video' | 'link';
};
type Plan = {
  category: GoalCategory;
  goal_type: string;
  outcome: string;
  success_metric: string;
  baseline: string;
  assumptions: string[];
  milestones: Array<{ title: string; description: string; week: number }>;
  schedule: PlanItem[];
  progression: string;
  checkpoints: string[];
  risks: string[];
  fallback_rules: string[];
  summary: string;
  duration_weeks: number;
  weekly_commitment_target: number;
  available_days: string[];
  references?: PlanReference[];
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const GOAL_PLACEHOLDERS = [
  'Finish a first 5K without stopping',
  'Practise conversational Spanish',
  'Build a portfolio for a new role',
  'Read for 20 minutes each day',
  'Learn to cook five healthy dinners',
  'Complete a small woodworking project',
  'Meditate for ten minutes each morning',
  'Save enough for a planned trip',
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

type DurationUnit = 'days' | 'weeks' | 'months';
function customDurationWeeks(value: string, unit: DurationUnit): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const days = unit === 'days' ? amount : unit === 'weeks' ? amount * 7 : amount * 30;
  return Math.max(1, Math.ceil(days / 7));
}

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
  const option = DURATION_OPTIONS.find(x => x.weeks === w);
  return option?.label || `${w} weeks`;
}
function canonicalDay(day: unknown): string | null {
  const value = String(day ?? '').trim().toLowerCase();
  const idx = DAYS.findIndex(
    d => d.toLowerCase() === value || (value.length >= 3 && d.toLowerCase().slice(0, 3) === value.slice(0, 3))
  );
  return idx >= 0 ? DAYS[idx] : null;
}
function isYoutubeUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
  } catch {
    return false;
  }
}
function youtubeSearchReference(goalText: string, goalType: string): PlanReference {
  const query = [goalType, goalText, 'guide'].filter(Boolean).join(' ');
  return {
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    title: `YouTube videos for ${goalText}`,
    resource_type: 'youtube',
  };
}
function normalizePlan(
  raw: Plan,
  durationWeeks: number,
  domain: GoalDomain,
  goalText: string,
  whyItMatters: string
): Plan | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.schedule) || !Array.isArray(raw.milestones))
    return null;
  const milestones = raw.milestones
    .slice(0, 12)
    .map(m => ({
      title: String(m?.title ?? '').trim().slice(0, 200),
      description: String(m?.description ?? '').trim().slice(0, 600),
      week: Math.max(1, Math.min(durationWeeks, Math.round(Number(m?.week) || 1))),
    }))
    .filter(m => m.title);
  const schedule = raw.schedule
    .slice(0, 300)
    .map(item => ({
      week: Math.max(1, Math.min(durationWeeks, Math.round(Number(item?.week) || 1))),
      day: canonicalDay(item?.day) ?? 'Monday',
      task: String(item?.task ?? '').trim().slice(0, 300),
      purpose: String(item?.purpose ?? '').trim().slice(0, 300),
      target_metric: String(item?.target_metric ?? '').trim().slice(0, 120),
      duration_minutes: Math.max(5, Math.min(240, Math.round(Number(item?.duration_minutes) || 30))),
      preferred_time: String(item?.preferred_time ?? '09:00').trim().slice(0, 8),
    }))
    .filter(item => item.task);
  if (!schedule.length || !milestones.length) return null;
  const candidateReferences = (Array.isArray(raw.references) ? raw.references : [])
    .map(reference => {
      const url = String(reference?.url || '').trim().slice(0, 1000);
      const resourceType = reference?.resource_type;
      return {
        url,
        title: reference?.title ? String(reference.title).trim().slice(0, 200) : null,
        resource_type: isYoutubeUrl(url)
          ? 'youtube'
          : (['instagram', 'image', 'video', 'link'].includes(resourceType || '')
            ? resourceType
            : 'link') as PlanReference['resource_type'],
      };
    })
    .filter(reference => {
      try {
        return new URL(reference.url).protocol === 'https:';
      } catch {
        return false;
      }
    })
    .filter((reference, index, references) => references.findIndex((candidate) => candidate.url === reference.url) === index);
  const youtubeReference = candidateReferences.find((reference) => isYoutubeUrl(reference.url));
  const websiteReference = candidateReferences.find((reference) => reference !== youtubeReference);
  const references: PlanReference[] = [
    youtubeReference || youtubeSearchReference(goalText, domain.goal_type),
  ];
  if (websiteReference) references.push(websiteReference);
  const suggestedApps = recommendGoalIntegrations({
    title: goalText,
    outcome: raw.outcome,
    why_it_matters: whyItMatters,
  })
    .filter((integration) => integration.websiteUrl)
    .slice(0, 2);
  for (const integration of suggestedApps) {
    const url = integration.websiteUrl;
    if (!url || references.some((reference) => reference.url === url)) continue;
    references.push({
      url,
      title: `Suggested app: ${integration.name} — ${integration.status === 'available' ? 'available in VOW' : 'VOW connection not available yet'}`,
      resource_type: 'link',
    });
  }
  return {
    ...raw,
    category: domain.category,
    goal_type: domain.goal_type,
    milestones,
    schedule,
    references,
    outcome: String(raw.outcome || '').trim().slice(0, 300),
    success_metric: String(raw.success_metric || '').trim().slice(0, 300),
    baseline: String(raw.baseline || '').trim().slice(0, 600),
    summary: String(raw.summary || '').trim().slice(0, 1200),
    progression: String(raw.progression || '').trim().slice(0, 600),
  };
}

async function invokeGoalAI(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke('vow-goal-ai', {
    headers: sessionData.session?.access_token
      ? { Authorization: `Bearer ${sessionData.session.access_token}` }
      : undefined,
    body,
  });
  if (!error) return data;
  const context = (error as { context?: unknown }).context;
  try {
    if (context instanceof Response) {
      const payload = await context.clone().json();
      if (payload?.error) throw new Error(String(payload.error));
    }
  } catch (contextError) {
    if (contextError instanceof Error && contextError.message !== error.message) throw contextError;
  }
  throw error;
}

export function GoalPlanner({
  userId,
  onCreated,
  onCancel,
  initialGoal = '',
  initialWhy = '',
}: {
  userId: string;
  onCreated: () => void;
  onCancel: () => void;
  initialGoal?: string;
  initialWhy?: string;
}) {
  const [rawInput, setRawInput] = useState(initialGoal);
  const [goalPlaceholder] = useState(() => GOAL_PLACEHOLDERS[Math.floor(Math.random() * GOAL_PLACEHOLDERS.length)]);

  const draftStorageKey = 'vow-goal-planner-draft:' + userId;
  const [why, setWhy] = useState(initialWhy);
  const [durationWeeks, setDurationWeeks] = useState<number | null>(null);
  const [customDurationValue, setCustomDurationValue] = useState('');
  const [customDurationUnit, setCustomDurationUnit] = useState<DurationUnit>('months');
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [sessionTimes, setSessionTimes] = useState<Record<string, string>>({});
  const [domain, setDomain] = useState<GoalDomain | null>(null);
  const [clarification, setClarification] = useState<Clarification | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [draftGoalId, setDraftGoalId] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resourceError, setResourceError] = useState('');
  const [upgrade, setUpgrade] = useState<EntitlementResult | null>(null);
  const selectedDurationWeeks = durationWeeks ?? customDurationWeeks(customDurationValue, customDurationUnit);
  const selectedDurationLabel = durationWeeks ? durationLabel(durationWeeks) : selectedDurationWeeks ? customDurationValue.trim() + ' ' + customDurationUnit : 'Choose a duration';
  const missingSessionTimes = availableDays.filter((day) => !sessionTimes[day]);

  useEffect(() => {
    if (typeof window === 'undefined' || initialGoal || initialWhy) return;
    try {
      const saved = window.localStorage.getItem(draftStorageKey);
      if (!saved) return;
      const draft = JSON.parse(saved) as {
        rawInput?: string;
        why?: string;
        durationWeeks?: number | null;
        customDurationValue?: string;
        customDurationUnit?: DurationUnit;
        availableDays?: string[];
        sessionTimes?: Record<string, string>;
        clarification?: Clarification | null;
        answers?: string[];
        domain?: GoalDomain | null;
        draftGoalId?: string | null;
      };
      if (typeof draft.rawInput === 'string') setRawInput(draft.rawInput);
      if (typeof draft.why === 'string') setWhy(draft.why);
      if (typeof draft.durationWeeks === 'number' || draft.durationWeeks === null) setDurationWeeks(draft.durationWeeks);
      if (typeof draft.customDurationValue === 'string') setCustomDurationValue(draft.customDurationValue);
      if (draft.customDurationUnit) setCustomDurationUnit(draft.customDurationUnit);
      if (Array.isArray(draft.availableDays)) setAvailableDays(draft.availableDays);
      if (draft.sessionTimes) setSessionTimes(draft.sessionTimes);
      if (draft.clarification) setClarification(draft.clarification);
      if (Array.isArray(draft.answers)) setAnswers(draft.answers);
      if (draft.domain) setDomain(draft.domain);
      if (draft.draftGoalId) setDraftGoalId(draft.draftGoalId);
    } catch (error) {
      console.warn('[VOW] Could not restore goal planner draft:', error);
    }
  }, [draftStorageKey, initialGoal, initialWhy]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify({
        rawInput,
        why,
        durationWeeks,
        customDurationValue,
        customDurationUnit,
        availableDays,
        sessionTimes,
        clarification,
        answers,
        domain,
        draftGoalId,
      }));
    } catch (error) {
      console.warn('[VOW] Could not save goal planner draft:', error);
    }
  }, [
    draftStorageKey,
    rawInput,
    why,
    durationWeeks,
    customDurationValue,
    customDurationUnit,
    availableDays,
    sessionTimes,
    clarification,
    answers,
    domain,
    draftGoalId,
  ]);

  async function openPlanReference(url: string) {
    setResourceError('');
    try {
      await openExternalLink(url);
    } catch (openError) {
      console.error('[VOW] Goal resource could not be opened:', openError);
      setResourceError('We could not open this resource. Please try again.');
    }
  }

  function toggleDay(day: string) {
    setAvailableDays((current) => {
      if (current.includes(day)) {
        setSessionTimes((times) => {
          const next = { ...times };
          delete next[day];
          return next;
        });
        return current.filter((d) => d !== day);
      }
      return current.length < 7 ? [...current, day] : current;
    });
  }

  async function ensureDraft(goalDomain: GoalDomain) {
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
        deadline: deadlineFor(start, selectedDurationWeeks || 1),
        duration: `${selectedDurationWeeks || 1}w`,
        status: 'draft',
        weekly_commitment_target: availableDays.length,
        plan_json: { category: goalDomain.category, goal_type: goalDomain.goal_type },
      })
      .select('id')
      .single();
    if (e || !data) throw e || new Error('Could not start this goal.');
    setDraftGoalId(data.id);
    return data.id;
  }

  async function checkCreateEntitlement() {
    const result = await consumeEntitlement('create_goal', { surface: 'goal_planner' });
    if (!result.allowed) {
      setUpgrade(result);
      return false;
    }
    return true;
  }

  async function loadReferences(goalId: string) {
    const { data, error: loadError } = await supabase
      .from('goal_resources')
      .select('url,title,resource_type')
      .eq('goal_id', goalId)
      .order('created_at', { ascending: false })
      .limit(4);
    if (loadError) throw loadError;
    return data || [];
  }

  async function askQuestions() {
    if (!rawInput.trim() || planning || availableDays.length === 0 || !selectedDurationWeeks || missingSessionTimes.length > 0) return;
    if (rawInput.trim().length < 3) {
      setError('Please describe your goal in at least a few characters.');
      return;
    }
    if (rawInput.trim().length > 5000 || why.trim().length > 5000) {
      setError('Please keep your goal and context under 5,000 characters each.');
      return;
    }
    setPlanning(true);
    setError('');
    setUpgrade(null);
    try {
      const safety = await checkContentSafety(rawInput);
      if (safety.status !== 'safe') {
        setError(safety.message || 'VOW cannot plan that request.');
        if (safety.status === 'suspended' || safety.status === 'banned') {
          const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
          if (signOutError) console.warn('[VOW] Could not clear the local session after a moderation suspension:', signOutError);
        }
        return;
      }
      if (!(await checkCreateEntitlement())) return;
      const goalAnalysis = analyseGoalForEvidence({
        title: rawInput.trim(),
        outcome: rawInput.trim(),
        why_it_matters: why.trim() || null,
      });
      const data = await invokeGoalAI({
          mode: 'goal-clarify',
          goal: {
            title: rawInput.trim(),
            outcome: rawInput.trim(),
            why_it_matters: why.trim() || null,
            duration_weeks: selectedDurationWeeks,
            weekly_commitment_target: availableDays.length,
            domain: goalAnalysis,
          },
          message: `Goal: ${rawInput.trim()}\nWhy it matters: ${why.trim() || 'Not supplied.'}\nDuration: ${selectedDurationLabel}.\nAvailable days: ${availableDays.join(', ')}\nSession times: ${availableDays.map((day) => `${day} ${sessionTimes[day]}`).join(', ')}\nIdentify the right kind of activity or outcome, then ask 2-3 high-value questions that resolve the most important missing inputs.`,
          available_days: availableDays,
          references: [],
        });
      if (!data?.structured) throw new Error(data?.error || 'VOW AI could not prepare the follow-up questions.');
      const next = data.structured as Clarification;
      const category = normalizeGoalCategory(next.category);
      const goalType = typeof next.goal_type === 'string' ? next.goal_type.trim().slice(0, 80) : '';
      if (!category || !goalType) {
        throw new Error('GOAL_CATEGORY_UNCLEAR');
      }
      if (!Array.isArray(next.questions) || next.questions.length === 0)
        throw new Error('VOW AI returned no follow-up questions.');
      const goalDomain = { category, goal_type: goalType };
      setDomain(goalDomain);
      const goalId = await ensureDraft(goalDomain);
      setClarification(next);
      setAnswers(next.questions.map(() => ''));
      const { error: ae } = await supabase.from('goal_clarification_answers').delete().eq('goal_id', goalId);
      if (ae) throw ae;
      const { error: ie } = await supabase.from('goal_clarification_answers').insert(
        next.questions.map((question, index) => ({
          goal_id: goalId,
          user_id: userId,
          question,
          answer: null,
          question_order: index,
        }))
      );
      if (ie) throw ie;
    } catch (err) {
      setError(userFacingError(err, 'VOW could not prepare the follow-up questions. Please try again.'));
    } finally {
      setPlanning(false);
    }
  }

  async function buildPlan() {
    if (!clarification || !domain || planning || availableDays.length === 0 || !selectedDurationWeeks || missingSessionTimes.length > 0) return;
    setPlanning(true);
    setError('');
    try {
      if (rawInput.trim().length > 5000 || why.trim().length > 5000) {
        setError('Please keep your goal and context under 5,000 characters each.');
        return;
      }
      const safety = await checkContentSafety(rawInput);
      if (safety.status !== 'safe') {
        setError(safety.message || 'VOW cannot plan that request.');
        if (safety.status === 'suspended' || safety.status === 'banned') {
          const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
          if (signOutError) console.warn('[VOW] Could not clear the local session after a moderation suspension:', signOutError);
        }
        return;
      }
      const goalId = await ensureDraft(domain);
      const clean = answers.map((answer) => String(answer ?? '').trim());
      const unknown = /^(i\s*(don['']?t|do not)\s*know|not sure|unsure|unknown|n\/a)$/i;
      const isUnanswered = (a: string) => !a || unknown.test(a);
      const unresolved = clean.filter(isUnanswered).length;
      console.log('[VOW] Clarification answers:', { answers, clean, unresolved });
      if (unresolved === clean.length) {
        setError(
          'VOW needs one decision before it can build a responsible plan. Please answer at least one follow-up question.'
        );
        return;
      }
      const { error: de } = await supabase.from('goal_clarification_answers').delete().eq('goal_id', goalId);
      if (de) throw de;
      const { error: ie } = await supabase.from('goal_clarification_answers').insert(
        clarification.questions.map((question, index) => ({
          goal_id: goalId,
          user_id: userId,
          question,
          answer: clean[index] || null,
          question_order: index,
        }))
      );
      if (ie) throw ie;
      const references = await loadReferences(goalId);
      const start = nextMonday();
            const data = await invokeGoalAI({
          mode: 'goal-plan',
          goal: {
            id: goalId,
            title: rawInput.trim(),
            outcome: rawInput.trim(),
            why_it_matters: why.trim() || null,
            domain,
            start_date: toDateString(start),
            deadline: deadlineFor(start, selectedDurationWeeks),
            duration_weeks: selectedDurationWeeks,
            weekly_commitment_target: availableDays.length,
            plan_generated_at: null,
          },
          message: `Build a genuinely personalised ${domain.goal_type} plan in the ${domain.category} category.\nFollow-up answers:\n${clarification.questions.map((q, i) => `Q: ${q}\nA: ${clean[i] || 'Not supplied'}`).join('\n')}\n\nThe user's duration is exactly ${selectedDurationLabel}. Available days are exactly: ${availableDays.join(', ')}. Session times by day are exactly: ${availableDays.map((day) => `${day} ${sessionTimes[day]}`).join(', ')}. Use these times for the selected days. Use the domain context and answers; if a critical input is still missing, return a clarification request rather than generic sessions.`,
          answers: clarification.questions.map((question, index) => ({ question, answer: clean[index] || '' })),
          available_days: availableDays,
          references,
        });
      if (!data?.structured) throw new Error(data?.error || 'VOW AI could not build the plan.');
      if (data.structured?.clarification_needed) {
        const followUp = data.structured as Clarification;
        setClarification(followUp);
        setAnswers(followUp.questions.map(() => ''));
        setError('VOW needs a bit more detail before it can build a reliable plan — please answer the follow-up below.');
        return;
      }
      const next = data.structured as Plan;
      if (next.duration_weeks !== selectedDurationWeeks)
        throw new Error('VOW AI returned a plan for a different duration than you selected. Please try again.');
      const normalized = normalizePlan(next, selectedDurationWeeks, domain, rawInput.trim(), why.trim());
      if (!normalized) throw new Error('VOW AI returned an incomplete plan. Please try again.');
      normalized.schedule = normalized.schedule.map((item) => ({ ...item, preferred_time: sessionTimes[item.day] || item.preferred_time }));
      setPlan(normalized);
    } catch (err) {
      setError(userFacingError(err, 'VOW could not build the plan. Please try again.'));
    } finally {
      setPlanning(false);
    }
  }

  async function handleCreate() {
    if (!plan || !draftGoalId || saving) return;
    setSaving(true);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const start = nextMonday();

      function buildDate(week: number, day: string, preferredTime: string): Date {
        const w = Math.max(1, Math.min(selectedDurationWeeks || 1, week));
        const dayIndex = Math.max(0, DAYS.indexOf(day));
        const date = addDays(start, (w - 1) * 7 + dayIndex);
        const match = /^(\d{1,2}):(\d{2})/.exec(sessionTimes[day] || preferredTime || '09:00');
        date.setHours(Math.min(23, Number(match?.[1] || 9)), Math.min(59, Number(match?.[2] || 0)), 0, 0);
        return date;
      }

      const filteredItems = plan.schedule.filter(x => availableDays.includes(x.day));
      if (!filteredItems.length)
        throw new Error('The generated schedule does not match your selected days. Please rebuild the plan.');

      const milestoneRows = plan.milestones.map((m, i) => ({
        title: m.title,
        description: m.description,
        sort_order: i,
        deadline: deadlineFor(start, Math.min(selectedDurationWeeks || 1, Math.max(1, m.week))),
        status: i === 0 ? 'in_progress' : 'pending',
      }));

      const planItemRows = filteredItems.map(item => {
        const date = buildDate(item.week, item.day, item.preferred_time);
        return {
          plan_version: 1,
          week_number: Math.max(1, Math.min(selectedDurationWeeks || 1, item.week)),
          day_of_week: item.day,
          scheduled_at: date.toISOString(),
          task: item.task,
          purpose: item.purpose || null,
          target_metric: item.target_metric || null,
          duration_minutes: Math.max(5, Number(item.duration_minutes) || 30),
          status: 'scheduled',
        };
      });

      const sessionRows = filteredItems.map(item => {
        const date = buildDate(item.week, item.day, item.preferred_time);
        const milestoneIndex = Math.min(
          Math.max(0, Math.floor(((item.week - 1) / Math.max(1, selectedDurationWeeks || 1)) * plan.milestones.length)),
          Math.max(0, plan.milestones.length - 1)
        );
        return {
          title: item.task,
          scheduled_at: date.toISOString(),
          duration_minutes: Math.max(5, Number(item.duration_minutes) || 30),
          status: 'scheduled',
          milestone_sort_order: milestoneIndex,
          notes: [item.purpose, item.target_metric ? `Target: ${item.target_metric}` : null]
            .filter(Boolean)
            .join('\n') || null,
        };
      });

      const { data: lockedGoalId, error: lockError } = await supabase.rpc('lock_goal_plan', {
        p_goal_id: draftGoalId,
        p_goal: {
          title: rawInput.trim(),
          outcome: plan.outcome || rawInput.trim(),
          why_it_matters: why.trim() || null,
          start_date: toDateString(start),
          deadline: deadlineFor(start, selectedDurationWeeks || 1),
          duration: `${selectedDurationWeeks || 1}w`,
          status: 'active',
          weekly_commitment_target: availableDays.length,
          plan_json: plan,
          plan_version: 1,
          plan_generated_at: new Date().toISOString(),
          planning_horizon_weeks: selectedDurationWeeks || 1,
          planning_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        },
        p_milestones: milestoneRows,
        p_plan_items: planItemRows,
        p_sessions: sessionRows,
      });
      if (lockError || !lockedGoalId) throw lockError || new Error('VOW could not lock the plan safely.');

      if (plan.references?.length) {
        const { error: referenceError } = await supabase.from('goal_resources').insert(
          plan.references.map(reference => ({
            goal_id: draftGoalId,
            user_id: userId,
            url: reference.url,
            title: reference.title,
            resource_type: reference.resource_type,
          }))
        );
        if (referenceError) console.warn('[VOW] Plan references could not be saved:', referenceError.message);
      }

      const { data: sessions, error: sessionLoadError } = await supabase
        .from('sessions')
        .select('*')
        .eq('goal_id', draftGoalId)
        .eq('user_id', userId)
        .order('scheduled_at', { ascending: true });
      if (sessionLoadError) throw sessionLoadError;

      try {
        await syncUpcomingSessionNotifications((sessions || []) as Session[]);
      } catch {
        console.warn('[VOW] Session notifications could not be synced.');
      }

      try {
                const { error: calendarError } = await supabase.functions.invoke('google-calendar-sync-goal', {
          headers: sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : undefined,
          body: { goalId: draftGoalId },
        });
        if (calendarError) console.warn('[VOW] Google Calendar sync could not be completed:', calendarError.message);
      } catch {
        console.warn('[VOW] Google Calendar sync could not be completed.');
      }

      if (typeof window !== 'undefined') window.localStorage.removeItem(draftStorageKey);
      onCreated();
    } catch (err) {
      console.error('[VOW] Goal creation failed:', err);
      setError(userFacingError(err, 'VOW could not finish creating your goal. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  // ── Upgrade wall ─────────────────────────────────────────────────────────────
  if (upgrade)
    return (
      <div>
        <PageHeader
          title="New goal"
          subtitle="VOW keeps the first goal free. Premium lets you run multiple active goals at once."
        />
        <div className="max-w-xl">
          <UpgradePrompt result={upgrade} title="Your next goal is ready for Premium" />
          <button onClick={onCancel} className="vow-btn-ghost mt-4">
            Back to goals
          </button>
        </div>
      </div>
    );

  // ── Step 3 — Plan review ──────────────────────────────────────────────────────
  if (plan)
    return (
      <div>
        <button onClick={() => setPlan(null)} className="text-sm text-vow-muted hover:text-vow-ink mb-6">
          ← Adjust answers
        </button>
        <PageHeader title="Your VOW plan" subtitle={`${selectedDurationLabel} · ${availableDays.length} sessions/week`} />
        <div className="max-w-3xl space-y-6">
          <section className="border border-vow-border p-5">
            <p className="vow-label mb-2">Outcome</p>
            <p className="text-lg font-medium text-vow-ink">{plan.outcome}</p>
            <p className="text-sm text-vow-muted mt-3">{plan.summary}</p>
          </section>
          <section className="border border-vow-border p-5">
            <p className="vow-label mb-2">Success metric</p>
            <p className="text-sm text-vow-ink">{plan.success_metric}</p>
            <p className="vow-label mt-5 mb-2">Baseline</p>
            <p className="text-sm text-vow-muted">{plan.baseline}</p>
          </section>
          <section className="border border-vow-border p-5">
            <p className="vow-label mb-4">Schedule · {selectedDurationLabel}</p>
            <div className="divide-y divide-vow-border">
              {plan.schedule.map((item, i) => (
                <div key={`${item.week}-${item.day}-${i}`} className="py-3 flex gap-3">
                  <span className="text-xs text-vow-muted w-12 shrink-0">W{item.week}</span>
                  <span className="text-xs text-vow-muted w-20 shrink-0">{item.day}</span>
                  <div>
                    <p className="text-sm text-vow-ink font-medium">{item.task}</p>
                    <p className="text-xs text-vow-muted mt-1">
                      {item.duration_minutes} min · {item.target_metric}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="border border-vow-border p-5">
            <p className="vow-label mb-4">Milestones &amp; progression</p>
            {plan.milestones.map(m => (
              <div key={`${m.week}-${m.title}`} className="mb-4">
                <p className="text-sm text-vow-ink font-medium">
                  Week {m.week} · {m.title}
                </p>
                <p className="text-xs text-vow-muted mt-1">{m.description}</p>
              </div>
            ))}
            <p className="text-sm text-vow-muted pt-4 border-t border-vow-border">{plan.progression}</p>
          </section>
          {plan.references?.some(reference => isYoutubeUrl(reference.url)) && (
            <section className="border border-vow-border p-5" aria-live="polite">
              <p className="vow-label mb-1">Recommended YouTube videos</p>
              <p className="mb-4 text-xs leading-5 text-vow-muted">These goal-specific video links are ready to open now; they do not depend on saving the goal first.</p>
              {plan.references.filter(reference => isYoutubeUrl(reference.url)).map(reference => (
                <button
                  type="button"
                  key={reference.url}
                  onClick={() => void openPlanReference(reference.url)}
                  className="mb-3 block text-left text-sm text-vow-ink underline underline-offset-4 last:mb-0"
                >
                  {reference.title || 'Open YouTube video'}
                </button>
              ))}
            </section>
          )}
          {plan.references?.some(reference => !isYoutubeUrl(reference.url)) ? (
            <section className="border border-vow-border p-5">
              <p className="vow-label mb-1">Other resources for this goal</p>
              <p className="mb-4 text-xs leading-5 text-vow-muted">Trusted websites and goal-matched app suggestions. App connection status is noted.</p>
              {plan.references.filter(reference => !isYoutubeUrl(reference.url)).map(reference => (
                <button
                  type="button"
                  key={reference.url}
                  onClick={() => void openPlanReference(reference.url)}
                  className="mb-3 block text-left text-sm text-vow-ink underline underline-offset-4 last:mb-0"
                >
                  {reference.title || reference.url}
                </button>
              ))}
              {resourceError && <p role="alert" className="mt-3 text-xs text-vow-muted">{resourceError}</p>}
            </section>
          ) : null}
          {error && (
            <div className="flex items-start gap-3 border-l-2 border-vow-ink pl-3">
              <p className="text-sm text-vow-ink flex-1">{error}</p>
              <button onClick={handleCreate} className="text-xs text-vow-ink underline underline-offset-4 shrink-0">
                Retry
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => setPlan(null)} className="vow-btn-ghost">
              Back
            </button>
            <button onClick={handleCreate} disabled={saving} className="vow-btn-primary flex-1">
              {saving ? 'Locking in…' : 'Lock in VOW'}
            </button>
          </div>
        </div>
      </div>
    );

  // ── Step 2 — Clarification answers ────────────────────────────────────────────
  if (clarification)
    return (
      <div>
        <button onClick={() => setClarification(null)} className="text-sm text-vow-muted hover:text-vow-ink mb-6">
          ← Adjust goal
        </button>
        <PageHeader
          title="A few questions first"
          subtitle="VOW uses your answers to make the commitment genuinely yours."
        />
        <div className="max-w-xl space-y-6">
          <div className="border border-vow-border p-4 space-y-1">
            <p className="text-xs text-vow-muted uppercase tracking-wider">
              {domain?.category ?? 'General'} · {domain?.goal_type ?? 'Goal'}
            </p>
            <p className="text-sm text-vow-ink">VOW is tailoring the next questions around this type of goal.</p>
          </div>
          <section className="border border-vow-border p-4" aria-live="polite">
            <p className="vow-label mb-1">Recommended YouTube videos</p>
            <p className="text-xs leading-5 text-vow-muted mb-3">A goal-specific video search is available now while VOW prepares your plan.</p>
            <button
              type="button"
              onClick={() => void openPlanReference(youtubeSearchReference(rawInput.trim(), domain?.goal_type || '').url)}
              className="text-sm text-vow-ink underline underline-offset-4"
            >
              Browse YouTube videos for this goal
            </button>
          </section>
          {clarification.questions.map((question, index) => (
            <div key={`${index}-${question}`}>
              <label className="vow-label block mb-2">{question}</label>
              <textarea
                value={answers[index] || ''}
                onChange={e => setAnswers(x => x.map((a, i) => (i === index ? e.target.value : a)))}
                rows={3}
                className="vow-input resize-none"
                placeholder="Your answer…"
              />
            </div>
          ))}
          <p className="text-xs text-vow-muted">{clarification.rationale}</p>
          {error && (
            <div className="flex items-start gap-3 border-l-2 border-vow-ink pl-3">
              <p className="text-sm text-vow-ink flex-1">{error}</p>
              <button onClick={buildPlan} className="text-xs text-vow-ink underline underline-offset-4 shrink-0">
                Retry
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => setClarification(null)} className="vow-btn-ghost">
              Back
            </button>
            <button onClick={buildPlan} disabled={planning} className="vow-btn-primary flex-1">
              {planning ? 'VOW is building your plan…' : 'Build my VOW plan'}
            </button>
          </div>
        </div>
      </div>
    );

  // ── Step 0 / 1 — Goal entry ───────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="New goal"
        subtitle="Tell VOW what you want to accomplish. It will ask the right questions before building your plan."
      />
      <div className="max-w-xl space-y-6">
        <textarea
          value={rawInput}
          onChange={e => setRawInput(e.target.value)}
          rows={4}
          maxLength={300}
          className="vow-input resize-none"
          placeholder={`e.g. ${goalPlaceholder}`}
          autoFocus
        />

        {rawInput.trim().length >= 3 && (
          <div className="border border-vow-border p-4 space-y-1">
            <p className="text-xs text-vow-muted uppercase tracking-wider">
              Detected · {domain?.category ?? 'General'} — {domain?.goal_type ?? 'Goal'}
            </p>
            <p className="text-sm text-vow-ink">VOW is shaping the plan around this goal type and your available time.</p>
          </div>
        )}

        <div>
          <label className="vow-label block mb-2">Why does this matter?</label>
          <textarea
            value={why}
            onChange={e => setWhy(e.target.value)}
            rows={2}
            maxLength={500}
            className="vow-input resize-none"
            placeholder="Give VOW the reason behind the commitment."
          />
        </div>

        <div className="bg-vow-gray/10 border border-vow-border p-4">
          <label className="vow-label block mb-3">How long are you committing?</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DURATION_OPTIONS.map(option => (
              <button key={option.weeks} type="button" onClick={() => setDurationWeeks(option.weeks)} className={`text-left border px-3 py-3 transition-colors ${durationWeeks === option.weeks ? 'border-vow-ink bg-vow-ink text-vow-bg' : 'border-vow-border text-vow-muted hover:text-vow-ink'}`}>
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-[10px] mt-1 text-vow-muted">{option.detail}</span>
              </button>
            ))}
            <button type="button" onClick={() => setDurationWeeks(null)} className={`text-left border px-3 py-3 transition-colors ${durationWeeks === null ? 'border-vow-ink bg-vow-ink text-vow-bg' : 'border-vow-border text-vow-muted hover:text-vow-ink'}`}>
              <span className="block text-sm font-medium">Custom</span><span className="block text-[10px] mt-1 text-vow-muted">Any duration</span>
            </button>
          </div>
          {durationWeeks === null && <div className="grid grid-cols-[1fr_auto] gap-2 mt-3">
            <input type="number" min="1" max="3650" value={customDurationValue} onChange={e => setCustomDurationValue(e.target.value)} placeholder="e.g. 4" className="vow-input" aria-label="Custom duration amount" />
            <select value={customDurationUnit} onChange={e => setCustomDurationUnit(e.target.value as DurationUnit)} className="vow-input" aria-label="Custom duration unit"><option value="days">days</option><option value="weeks">weeks</option><option value="months">months</option></select>
          </div>}
          <p className="text-xs text-vow-muted mt-3">{selectedDurationWeeks ? `Selected: ${selectedDurationLabel} · VOW plans in ${selectedDurationWeeks} week${selectedDurationWeeks === 1 ? '' : 's'}.` : 'Choose a duration before continuing.'}</p>
        </div>

        <div className="bg-vow-gray/10 border border-vow-border p-4">
          <label className="vow-label block mb-3">Available days</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DAYS.map(day => <button key={day} type="button" onClick={() => toggleDay(day)} className={`border px-3 py-2 text-xs transition-colors ${availableDays.includes(day) ? 'border-vow-ink bg-vow-ink text-vow-bg' : 'border-vow-border text-vow-muted hover:text-vow-ink'}`}>{day}</button>)}
          </div>
          <p className="text-xs text-vow-muted mt-3">Select every day you can genuinely commit to. Nothing is pre-selected.</p>
        </div>

        {availableDays.length > 0 && <div className="bg-vow-gray/10 border border-vow-border p-4">
          <label className="vow-label block mb-3">Session time for each day</label>
          <div className="space-y-3">
            {availableDays.map(day => <div key={day} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-vow-border pb-3 last:border-b-0 last:pb-0">
              <div><p className="text-sm text-vow-ink">{day}</p>{!sessionTimes[day] && <p className="text-[11px] text-vow-muted mt-1">Choose a time</p>}</div>
              <input type="time" value={sessionTimes[day] || ''} onChange={e => setSessionTimes(current => ({ ...current, [day]: e.target.value }))} className="vow-input w-auto min-h-11" aria-label={`Session time for ${day}`} />
            </div>)}
          </div>
        </div>}

        {error && (
          <div className="flex items-start gap-3 border-l-2 border-vow-ink pl-3">
            <p className="text-sm text-vow-ink flex-1">{error}</p>
            <button onClick={askQuestions} className="text-xs text-vow-ink underline underline-offset-4 shrink-0">
              Retry
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onCancel} className="vow-btn-ghost">
            Cancel
          </button>
          <button
            onClick={askQuestions}
            disabled={!rawInput.trim() || planning || availableDays.length === 0 || !selectedDurationWeeks || missingSessionTimes.length > 0}
            className="vow-btn-primary flex-1"
          >
            {planning ? 'VOW is preparing questions…' : missingSessionTimes.length > 0 ? `Choose time for ${missingSessionTimes.length} day${missingSessionTimes.length === 1 ? '' : 's'}` : !selectedDurationWeeks ? 'Choose a duration' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
