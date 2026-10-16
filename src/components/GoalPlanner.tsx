import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';
import { addDays, toDateString } from '@/lib/dates';
import { syncUpcomingSessionNotifications } from '@/lib/notifications';
import { consumeEntitlement, FREE_PLANNING_ACTION_LIMIT, getEntitlementSnapshot, refreshEntitlementSnapshot, type EntitlementResult } from '@/lib/entitlements';
import { UpgradePrompt } from './UpgradePrompt';
import { checkContentSafety } from '@/lib/contentSafety';
import type { Session } from '@/types/database';
import { PageHeader } from './AppShell';
import { normalizeGoalCategory, type GoalCategory } from '@/lib/goalCategories';
import { userFacingError } from '@/lib/userFacingError';
import { analyseGoalForEvidence, recommendGoalIntegrations } from '@/lib/armadillo';
import { openExternalLink } from '@/lib/externalLinks';
import { TimeWheelPicker } from './TimeWheelPicker';
import { listNativeCalendarEvents, type NativeCalendarEvent } from '@/lib/nativeCalendar';
import { answerForPlanning, CLARIFICATION_SKIP, rememberClarificationAnswers, reuseClarificationAnswers } from '@/lib/clarification';

type Clarification = {
  questions: string[];
  recommended_duration_weeks: number;
  rationale: string;
  category?: unknown;
  goal_type?: unknown;
  classification_confidence?: unknown;
};
type GoalDomain = { category: GoalCategory; goal_type: string };
type SavedPlannerDraft = {
  rawInput?: string;
  why?: string;
  durationWeeks?: number | null;
  customDurationValue?: string;
  customDurationUnit?: DurationUnit;
  availableDays?: string[];
  sessionTimes?: Record<string, string>;
  scheduleTimesEnabled?: boolean;
  scheduleMode?: 'timed' | 'flexible-day' | 'unscheduled';
  answerHistory?: Record<string, string>;
  clarification?: Clarification | null;
  isPlanFollowup?: boolean;
  answers?: string[];
  domain?: GoalDomain | null;
  plan?: Plan | null;
  draftGoalId?: string | null;
};
type PlanAction = { title: string; name?: string; purpose?: string; instructions?: string; sets?: number | null; reps?: string | null; duration_minutes?: number | null; rest_seconds?: number | null; substeps?: string[] };
type PlanItem = {
  week: number;
  day: string;
  task: string;
  purpose: string;
  target_metric: string;
  duration_minutes: number;
  preferred_time: string | null;
  scheduled_at?: string | null;
  video_url?: string;
  substeps?: string[];
  actions?: PlanAction[];
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

function currentLocalTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
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
function conciseSessionTitle(task: string, week: number): string {
  const compact = task.trim().replace(/^(practice|practise|work on|complete|perform|train|study|review)\s+/i, '').split(/\s+/).slice(0, 5).join(' ').replace(/[.,:;]+$/, '');
  const readable = compact ? compact.charAt(0).toUpperCase() + compact.slice(1) : 'Practice';
  return `${readable.slice(0, 36)} · W${week}`;
}
function youtubeSearchReference(goalText: string, goalType: string): PlanReference {
  const query = [goalType, goalText, 'guide'].filter(Boolean).join(' ');
  return {
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    title: `YouTube videos for ${goalText}`,
    resource_type: 'youtube',
  };
}
function readablePlanValue(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value.trim().slice(0, 600) || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => readablePlanValue(item, '')).filter(Boolean);
    return items.join(' · ').slice(0, 600) || fallback;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const preferredKeys = ['description', 'value', 'current', 'current_level', 'starting_point', 'measure', 'metric', 'details', 'summary'];
    const parts = preferredKeys.map((key) => record[key]).filter((item) => item !== undefined && item !== null && item !== '');
    const values = (parts.length ? parts : Object.values(record)).map((item) => readablePlanValue(item, '')).filter(Boolean);
    return [...new Set(values)].join(' · ').slice(0, 600) || fallback;
  }
  return fallback;
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
  // The database requires at least two milestones for an active plan.
  // Keep a sparse but otherwise usable AI response saveable by adding a
  // distinct end-of-horizon review checkpoint when only one was returned.
  if (milestones.length === 1) {
    milestones.push({
      title: 'Review progress and record the outcome',
      description: `Review the progress made toward “${goalText}” and record the measurable result against the intended outcome.`,
      week: durationWeeks,
    });
  }
  const schedule = raw.schedule
    .slice(0, 300)
    .map(item => ({
      week: Math.max(1, Math.min(durationWeeks, Math.round(Number(item?.week) || 1))),
      day: canonicalDay(item?.day) ?? 'Monday',
      task: String(item?.task ?? '').trim().slice(0, 300),
      purpose: String(item?.purpose ?? '').trim().slice(0, 300),
      target_metric: String(item?.target_metric ?? '').trim().slice(0, 120),
      duration_minutes: Math.max(5, Math.min(240, Math.round(Number(item?.duration_minutes) || 30))),
      preferred_time: /^\d{1,2}:\d{2}$/.test(String(item?.preferred_time ?? '')) ? String(item.preferred_time).trim().slice(0, 8) : null,
      video_url: (() => { const url = String(item?.video_url ?? '').trim().slice(0, 1000); return isYoutubeUrl(url) ? url : ''; })(),
      substeps: Array.isArray(item?.substeps) ? item.substeps.map((step: unknown) => String(step ?? '').trim().slice(0, 300)).filter(Boolean).slice(0, 12) : [],
      actions: Array.isArray(item?.actions) ? item.actions.slice(0, 8).map((action) => ({
        title: String(action?.title ?? action?.name ?? '').trim().slice(0, 160),
        instructions: String(action?.instructions ?? action?.purpose ?? '').trim().slice(0, 500) || undefined,
        sets: Number.isFinite(Number(action?.sets)) && Number(action.sets) > 0 ? Math.min(100, Math.round(Number(action.sets))) : null,
        reps: action?.reps == null ? null : String(action.reps).trim().slice(0, 80),
        duration_minutes: Number.isFinite(Number(action?.duration_minutes)) && Number(action.duration_minutes) > 0 ? Math.min(240, Math.round(Number(action.duration_minutes))) : null,
        rest_seconds: Number.isFinite(Number(action?.rest_seconds)) && Number(action.rest_seconds) >= 0 ? Math.min(3600, Math.round(Number(action.rest_seconds))) : null,
        substeps: Array.isArray(action?.substeps) ? action.substeps.map((step: unknown) => String(step ?? '').trim().slice(0, 300)).filter(Boolean).slice(0, 8) : [],
      })).filter((action: PlanAction) => action.title) : [],
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
  const fallbackYoutube = youtubeReference?.url || youtubeSearchReference(goalText, domain.goal_type).url;
  for (const item of schedule) if (!item.video_url) item.video_url = fallbackYoutube;
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
      title: `Suggested app: ${integration.name}`,
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
    success_metric: readablePlanValue(raw.success_metric, 'Track progress against the goal outcome.' ).slice(0, 300),
    baseline: readablePlanValue(raw.baseline, 'Baseline not provided yet.'),
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
  resumeDraftId,
}: {
  userId: string;
  onCreated: () => void;
  onCancel: () => void;
  initialGoal?: string;
  initialWhy?: string;
  resumeDraftId?: string | null;
}) {
  const [rawInput, setRawInput] = useState(initialGoal);
  const [goalPlaceholder] = useState(() => GOAL_PLACEHOLDERS[Math.floor(Math.random() * GOAL_PLACEHOLDERS.length)]);

  const draftStorageKey = 'vow-goal-planner-draft:' + userId + (resumeDraftId ? ':' + resumeDraftId : ':new');
  const legacyDraftStorageKey = 'vow-goal-planner-draft:' + userId;
  const [why, setWhy] = useState(initialWhy);
  const [durationWeeks, setDurationWeeks] = useState<number | null>(null);
  const [customDurationValue, setCustomDurationValue] = useState('');
  const [customDurationUnit, setCustomDurationUnit] = useState<DurationUnit>('months');
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [sessionTimes, setSessionTimes] = useState<Record<string, string>>({});
  const [scheduleMode, setScheduleMode] = useState<'timed' | 'flexible-day' | 'unscheduled'>('flexible-day');
  const scheduleTimesEnabled = scheduleMode === 'timed';
  const [domain, setDomain] = useState<GoalDomain | null>(null);
  const [clarification, setClarification] = useState<Clarification | null>(null);
  const [isPlanFollowup, setIsPlanFollowup] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [answerHistory, setAnswerHistory] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<Plan | null>(null);
  const [draftGoalId, setDraftGoalId] = useState<string | null>(resumeDraftId || null);
  const activeDraftStorageKey = 'vow-goal-planner-draft:' + userId + (resumeDraftId || draftGoalId ? ':' + (resumeDraftId || draftGoalId) : ':new');
  const [draftReady, setDraftReady] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resourceError, setResourceError] = useState('');
  const [calendarConflicts, setCalendarConflicts] = useState<string[]>([]);
  const [expandedScheduleKey, setExpandedScheduleKey] = useState<string | null>(null);
  const [showAllPlanReferences, setShowAllPlanReferences] = useState(false);
  const [upgrade, setUpgrade] = useState<EntitlementResult | null>(null);

  useEffect(() => {
    const handleHardwareBack = (event: Event) => {
      event.preventDefault();
      onCancel();
    };
    window.addEventListener('vow:hardware-back', handleHardwareBack);
    return () => window.removeEventListener('vow:hardware-back', handleHardwareBack);
  }, [onCancel]);

  const selectedDurationWeeks = durationWeeks ?? customDurationWeeks(customDurationValue, customDurationUnit);
  const selectedDurationLabel = durationWeeks ? durationLabel(durationWeeks) : selectedDurationWeeks ? customDurationValue.trim() + ' ' + customDurationUnit : 'Choose a duration';
  const missingSessionTimes = scheduleTimesEnabled ? availableDays.filter((day) => !sessionTimes[day]) : [];
  const previewDomain = rawInput.trim().length >= 3
    ? analyseGoalForEvidence({ title: rawInput.trim(), outcome: rawInput.trim(), why_it_matters: why.trim() || null })
    : null;

  useEffect(() => {
    let cancelled = false;

    async function hydrateDraft() {
      try {
        let savedDraft: SavedPlannerDraft | null = null;

        if (typeof window !== 'undefined') {
          try {
            let saved = window.localStorage.getItem(draftStorageKey);
            let cameFromLegacyKey = false;
            // The legacy key may contain a previous goal from an older app build.
            // Only consult it when explicitly reopening that same saved draft.
            if (!saved && resumeDraftId) {
              saved = window.localStorage.getItem(legacyDraftStorageKey);
              cameFromLegacyKey = Boolean(saved);
            }
            if (saved) {
              const parsed = JSON.parse(saved) as SavedPlannerDraft | null;
              const legacyMatchesThisFlow = !cameFromLegacyKey
                || (resumeDraftId ? parsed?.draftGoalId === resumeDraftId : !parsed?.draftGoalId);
              if (legacyMatchesThisFlow) savedDraft = parsed;
            }
          } catch (storageError) {
            console.warn('[VOW] Could not read saved goal planner draft:', storageError);
          }
        }

        // A new goal must always start clean. Local drafts are restored only
        // when the user explicitly opens a saved draft from the Goals screen.
        if (!resumeDraftId) savedDraft = null;
        const savedMatchesRequestedDraft = resumeDraftId
          ? savedDraft?.draftGoalId === resumeDraftId
          : false;
        if (savedDraft && savedMatchesRequestedDraft && !initialGoal && !initialWhy) {
          if (typeof savedDraft.rawInput === 'string') setRawInput(savedDraft.rawInput);
          if (typeof savedDraft.why === 'string') setWhy(savedDraft.why);
          if (typeof savedDraft.durationWeeks === 'number') setDurationWeeks(savedDraft.durationWeeks);
          else if (savedDraft.durationWeeks === null && typeof savedDraft.customDurationValue === 'string' && savedDraft.customDurationValue.trim()) setDurationWeeks(null);
          if (typeof savedDraft.customDurationValue === 'string') setCustomDurationValue(savedDraft.customDurationValue);
          if (savedDraft.customDurationUnit) setCustomDurationUnit(savedDraft.customDurationUnit);
          if (Array.isArray(savedDraft.availableDays)) setAvailableDays(savedDraft.availableDays);
          if (savedDraft.sessionTimes) setSessionTimes(savedDraft.sessionTimes);
          if (savedDraft.scheduleMode) setScheduleMode(savedDraft.scheduleMode);
          else if (typeof savedDraft.scheduleTimesEnabled === 'boolean') setScheduleMode(savedDraft.scheduleTimesEnabled ? 'timed' : 'flexible-day');
          if (savedDraft.clarification) setClarification(savedDraft.clarification);
          if (savedDraft.answerHistory) setAnswerHistory(savedDraft.answerHistory);
          if (typeof savedDraft.isPlanFollowup === 'boolean') setIsPlanFollowup(savedDraft.isPlanFollowup);
          if (Array.isArray(savedDraft.answers)) setAnswers(savedDraft.answers);
          if (savedDraft.domain) setDomain(savedDraft.domain);
          if (savedDraft.plan && Array.isArray(savedDraft.plan.schedule) && Array.isArray(savedDraft.plan.milestones)) {
            setPlan(savedDraft.plan);
          }
          if (savedDraft.draftGoalId) setDraftGoalId(savedDraft.draftGoalId);
        }

        if (resumeDraftId) {
          const { data: goal, error: goalError } = await supabase
            .from('goals')
            .select('id,title,outcome,why_it_matters,duration,plan_json')
            .eq('id', resumeDraftId)
            .eq('user_id', userId)
            .eq('status', 'draft')
            .maybeSingle();
          if (goalError) throw goalError;
          if (!goal) throw new Error('This saved draft could not be found. Return to Drafts and try again.');

          if (!savedMatchesRequestedDraft) {
            setRawInput(String(goal.title || goal.outcome || ''));
            setWhy(String(goal.why_it_matters || ''));
            const durationMatch = /^(\d+)w$/i.exec(String(goal.duration || ''));
            if (durationMatch) setDurationWeeks(Math.max(1, Math.min(52, Number(durationMatch[1]))));
            setAvailableDays([]);
            setSessionTimes({});
            setClarification(null);
            setAnswers([]);
            const storedDomain = goal.plan_json as { category?: unknown; goal_type?: unknown } | null;
            const category = normalizeGoalCategory(storedDomain?.category);
            const goalType = typeof storedDomain?.goal_type === 'string' ? storedDomain.goal_type.trim() : '';
            setDomain(category && goalType ? { category, goal_type: goalType } : null);
          }
          setDraftGoalId(goal.id);

          // A generated plan is stored in the draft row so leaving the planner
          // or reopening the app does not force the user to regenerate it.
          const storedPlan = goal.plan_json as Partial<Plan> | null;
          if (storedPlan && Array.isArray(storedPlan.schedule) && Array.isArray(storedPlan.milestones)) {
            const restoredPlan = storedPlan as Plan;
            setPlan(restoredPlan);
            if (Number.isFinite(Number(restoredPlan.duration_weeks)) && Number(restoredPlan.duration_weeks) > 0) {
              setDurationWeeks(Math.max(1, Math.min(52, Number(restoredPlan.duration_weeks))));
            }
            const restoredDays = Array.isArray(restoredPlan.available_days) && restoredPlan.available_days.length
              ? restoredPlan.available_days.filter((day): day is string => DAYS.includes(day))
              : [...new Set(restoredPlan.schedule.map((item) => item.day).filter((day): day is string => DAYS.includes(day)))];
            if (restoredDays.length) setAvailableDays(restoredDays);
            const restoredTimes: Record<string, string> = {};
            for (const item of restoredPlan.schedule) {
              if (restoredDays.includes(item.day) && item.preferred_time && !restoredTimes[item.day]) {
                restoredTimes[item.day] = item.preferred_time;
              }
            }
            if (Object.keys(restoredTimes).length) setSessionTimes(restoredTimes);
          }

          if (savedMatchesRequestedDraft) {
            const { data: rows, error: rowsError } = await supabase
              .from('goal_clarification_answers')
              .select('question,answer,question_order')
              .eq('goal_id', resumeDraftId)
              .eq('user_id', userId)
              .order('question_order', { ascending: true });
            if (rowsError) throw rowsError;
            if (rows?.length) {
              setClarification((current) => current || {
                questions: rows.map((row) => row.question),
                recommended_duration_weeks: 8,
                rationale: 'Resuming your saved goal draft.',
              });
              setAnswers((current) => current.length === rows.length
                ? rows.map((row, index) => row.answer ?? current[index] ?? '')
                : rows.map((row) => row.answer ?? ''));
            }
          }
        }
      } catch (hydrateError) {
        console.error('[VOW] Could not restore goal planner draft:', hydrateError);
        if (!cancelled) setError(userFacingError(hydrateError, 'Could not reopen this draft. Please return to Drafts and try again.'));
      } finally {
        if (!cancelled) setDraftReady(true);
      }
    }

    void hydrateDraft();
    return () => { cancelled = true; };
  }, [draftStorageKey, legacyDraftStorageKey, initialGoal, initialWhy, resumeDraftId, userId]);

  useEffect(() => {
    if (!draftReady || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(activeDraftStorageKey, JSON.stringify({
        rawInput,
        why,
        durationWeeks,
        customDurationValue,
        customDurationUnit,
        availableDays,
        sessionTimes,
        scheduleMode,
        clarification,
        answerHistory,
        isPlanFollowup,
        answers,
        domain,
        plan,
        draftGoalId,
      }));
    } catch (storageError) {
      console.warn('[VOW] Could not save goal planner draft:', storageError);
    }
  }, [
    draftReady,
    activeDraftStorageKey,
    rawInput,
    why,
    durationWeeks,
    customDurationValue,
    customDurationUnit,
    availableDays,
    sessionTimes,
    scheduleMode,
    clarification,
    answerHistory,
    isPlanFollowup,
    answers,
    domain,
    plan,
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
    // Do not let the pre-draft form snapshot repopulate a future New Goal flow.
    if (typeof window !== 'undefined') window.localStorage.removeItem(draftStorageKey);
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

  // Check the planning allowance before spending time on AI clarification or
  // generation. The server remains authoritative when the plan is generated.
  async function checkPlanningEntitlement(): Promise<boolean> {
    const snapshot = await getEntitlementSnapshot();
    if (!snapshot || snapshot.plan === 'premium') return true;
    const limit = Math.min(
      snapshot.planning_limit ?? FREE_PLANNING_ACTION_LIMIT,
      FREE_PLANNING_ACTION_LIMIT,
    );
    if (snapshot.planning_used >= limit) {
      setUpgrade({
        allowed: false,
        reason: 'usage_limit',
        feature: 'planning_action',
        used: snapshot.planning_used,
        limit,
      });
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
    if (rawInput.trim().length > 300) {
      setError('Please keep your goal under 300 characters.');
      return;
    }
    if (why.trim().length > 5000) {
      setError('Please keep your context under 5,000 characters.');
      return;
    }
    if (selectedDurationWeeks < 1 || selectedDurationWeeks > 52) {
      setError('Please choose a duration between 1 and 52 weeks.');
      return;
    }
    if (availableDays.length < 1 || availableDays.length > 7 || missingSessionTimes.length > 0) {
      setError(scheduleTimesEnabled ? 'Choose at least one day and time for your plan.' : 'Choose at least one day for your plan.');
      return;
    }
    setPlanning(true);
    setError('');
    setUpgrade(null);
    try {
      if (!(await checkPlanningEntitlement())) return;
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
            schedule_times_enabled: scheduleTimesEnabled,
            schedule_mode: scheduleMode,
            available_days: availableDays,
          },
          message: `Goal: ${rawInput.trim()}\nWhy it matters: ${why.trim() || 'Not supplied.'}\nDuration: ${selectedDurationLabel}.\nAvailable days: ${availableDays.join(', ')}\n${scheduleTimesEnabled ? `Session times: ${availableDays.map((day) => `${day} ${sessionTimes[day]}`).join(', ')}. Schedule at these times.` : scheduleMode === 'unscheduled' ? 'The user chose unscheduled sessions. Use the selected days only as a weekly workload/frequency guide; do not assign a weekday or clock time to persisted sessions, leave preferred_time null, and do not invent a time.' : 'The user chose flexible-day sessions. Organise the plan by selected weekday only; leave preferred_time null and do not invent a clock time.'}\nThe deterministic domain analysis is ${goalAnalysis.category} / ${goalAnalysis.goal_type}; preserve this specialist classification unless the goal text clearly contradicts it. Identify the right kind of activity or outcome, then ask at most 2-3 genuinely useful personal-context questions. Never ask users to supply facts VOW can look up (for example a known book's page count, a food's published nutrition facts, or public information about a named person, place, product, event, or topic). Do not ask users to predict unknowable future measurements such as exact running distance, calorie burn, pace, or future performance; establish a baseline with a simple optional test or use a clearly labelled adjustable estimate. Do not require the user to own a book or product just because they want to plan around it. Accept 'I don't know' and blank answers; treat them as uncertainty to plan around, not as a reason to block generation. Ask only about meaningful personal preferences, current experience, constraints, or desired outcome. Use plain, direct language and briefly explain specialist terms.`,
          available_days: availableDays,
          schedule_times_enabled: scheduleTimesEnabled,
          schedule_mode: scheduleMode,
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
      setIsPlanFollowup(false);
      setAnswers(reuseClarificationAnswers(next.questions, answerHistory));
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
      setUpgrade(null);
      if (rawInput.trim().length > 300) {
        setError('Please keep your goal under 300 characters.');
        return;
      }
      if (why.trim().length > 5000) {
        setError('Please keep your context under 5,000 characters.');
        return;
      }
      if (selectedDurationWeeks < 1 || selectedDurationWeeks > 52) {
        setError('Please choose a duration between 1 and 52 weeks.');
        return;
      }
      if (availableDays.length < 1 || availableDays.length > 7 || missingSessionTimes.length > 0) {
        setError('Choose at least one day and time for your plan.');
        return;
      }
      if (!(await checkPlanningEntitlement())) return;
      const safety = await checkContentSafety(rawInput);
      if (safety.status !== 'safe') {
        setError(safety.message || 'VOW cannot plan that request.');
        if (safety.status === 'suspended' || safety.status === 'banned') {
          const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
          if (signOutError) console.warn('[VOW] Could not clear the local session after a moderation suspension:', signOutError);
        }
        return;
      }
      const nextAnswerHistory = rememberClarificationAnswers(answerHistory, clarification.questions, answers);
      setAnswerHistory(nextAnswerHistory);
      const clean = answers.map(answerForPlanning);
      const unknown = /^(i\s*(don['']?t|do not)\s*know|not sure|unsure|unknown|n\/a)$/i;
      const unresolved = clean.filter((answer) => unknown.test(answer)).length;
      console.log('[VOW] Clarification answers:', { answers, clean, unresolved });
      // Missing personal estimates are not blockers. Tell the planner to use a
      // transparent, adjustable assumption rather than forcing users to guess.
      const goalId = await ensureDraft(domain);
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
          is_followup: isPlanFollowup,
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
            schedule_times_enabled: scheduleTimesEnabled,
            schedule_mode: scheduleMode,
            available_days: availableDays,
          },
          message: `Build a genuinely personalised ${domain.goal_type} plan in the ${domain.category} category.\nFollow-up answers:\n${clarification.questions.map((q, i) => `Q: ${q}\nA: ${clean[i] || 'Not supplied'}`).join('\n')}\n\nThe user's duration is exactly ${selectedDurationLabel}. Available days are exactly: ${availableDays.join(', ')}. ${scheduleTimesEnabled ? `Session times by day are exactly: ${availableDays.map((day) => `${day} ${sessionTimes[day]}`).join(', ')}. Use these times for the selected days.` : scheduleMode === 'unscheduled' ? 'The user chose unscheduled sessions. Selected days indicate weekly frequency only; persisted session weekdays and timestamps must remain null. Do not invent a day or time.' : 'The user chose flexible-day sessions. Organise by selected weekday, return preferred_time as null, and do not invent a clock time.'} Use the domain context and answers; if a critical input is still missing, return a clarification request rather than generic sessions. Use plain, direct wording. Every session must contain executable details, not just a theme: include named drills or sub-steps, sets/repetitions/rounds and rest when appropriate, the order to do them, and a clear finish condition. For sessions in weeks 1–4, each schedule item must include an actions array of 3–6 named actions, not just one flat list. Each action needs a title, clear instructions, sets/reps or duration as appropriate, rest_seconds when relevant, and 2–5 ordered substeps with time/repetitions and a measurable finish condition. For later weeks, include concise top-level substeps as a backwards-compatible actionable outline. Every schedule item must also include video_url with a directly relevant, valid YouTube video URL for that exact session topic; do not invent URLs, and if you cannot verify a specific video use the goal-level YouTube reference instead. For sport or martial-arts goals, match the user's stated level, build skills progressively, and do not prescribe unsupervised sparring or promise belt readiness; distinguish practice goals from formal instructor assessment. Make each day's session specific enough that the user can follow it without guessing.`,
          answers: clarification.questions.map((question, index) => ({ question, answer: clean[index] || '' })),
          available_days: availableDays,
          schedule_times_enabled: scheduleTimesEnabled,
          schedule_mode: scheduleMode,
          references,
        });
      if (!data?.structured) throw new Error(data?.error || 'VOW AI could not build the plan.');
      if (data.structured?.clarification_needed) {
        const followUp = data.structured as Clarification;
        setClarification(followUp);
        setIsPlanFollowup(true);
        setAnswers(reuseClarificationAnswers(followUp.questions, nextAnswerHistory));
        setError('VOW needs a bit more detail before it can build a reliable plan — please answer the follow-up below.');
        return;
      }
      const next = data.structured as Plan;
      if (next.duration_weeks !== selectedDurationWeeks)
        throw new Error('VOW AI returned a plan for a different duration than you selected. Please try again.');
      const normalized = normalizePlan(next, selectedDurationWeeks, domain, rawInput.trim(), why.trim());
      if (!normalized) throw new Error('VOW AI returned an incomplete plan. Please try again.');
      normalized.schedule = normalized.schedule.map((item) => ({ ...item, preferred_time: scheduleTimesEnabled ? (sessionTimes[item.day] || item.preferred_time || null) : null, scheduled_at: null }));
      // Keep the exact generated plan recoverable before the user confirms it.
      // The local draft effect provides immediate device recovery; this database
      // write makes recovery survive route changes, app restarts, and device reloads.
      setPlan(normalized);
      const { error: draftPlanError } = await supabase
        .from('goals')
        .update({
          plan_json: { ...normalized, goal_title: rawInput.trim() },
          plan_generated_at: new Date().toISOString(),
        })
        .eq('id', goalId)
        .eq('user_id', userId)
        .eq('status', 'draft');
      if (draftPlanError) {
        console.warn('[VOW] Generated plan could not be persisted to the draft row:', draftPlanError.message);
      }
    } catch (err) {
      setError(userFacingError(err, 'VOW could not build the plan. Please try again.'));
    } finally {
      setPlanning(false);
    }
  }

  async function handleCreate(ignoreCalendarConflicts = false) {
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
        const match = /^(\d{1,2}):(\d{2})/.exec(sessionTimes[day] || preferredTime || currentLocalTime());
        date.setHours(Math.min(23, Number(match?.[1] ?? new Date().getHours())), Math.min(59, Number(match?.[2] ?? new Date().getMinutes())), 0, 0);
        return date;
      }

      const filteredItems = plan.schedule.filter(x => availableDays.includes(x.day));
      if (!filteredItems.length)
        throw new Error('The generated schedule does not match your selected days. Please rebuild the plan.');

      // Only inspect the device calendar when the user has already opted into
      // calendar sync; do not trigger a surprise permission prompt during planning.
      if (!ignoreCalendarConflicts && scheduleTimesEnabled && Capacitor.isNativePlatform() && localStorage.getItem('vow:native-calendar-sync') === 'true') {
        const rangeEnd = addDays(start, (selectedDurationWeeks || 1) * 7);
        let events: NativeCalendarEvent[];
        try {
          events = await listNativeCalendarEvents(start, rangeEnd);
        } catch (calendarError) {
          console.warn('[VOW] Calendar collision check could not complete:', calendarError);
          setCalendarConflicts(['VOW could not check your device calendar. Overlapping events may not be detected.']);
          setSaving(false);
          return;
        }
        const conflicts: string[] = [];
        for (const item of filteredItems) {
          const sessionStart = buildDate(item.week, item.day, item.preferred_time || currentLocalTime()).getTime();
          const sessionEnd = sessionStart + Math.max(5, Number(item.duration_minutes) || 30) * 60_000;
          const collision = events.find((event) => {
            if (event.summary.startsWith('VOW ·')) return false;
            const eventStart = event.start.dateTime ? new Date(event.start.dateTime).getTime() : NaN;
            const eventEnd = event.end.dateTime ? new Date(event.end.dateTime).getTime() : NaN;
            return Number.isFinite(eventStart) && Number.isFinite(eventEnd) && sessionStart < eventEnd && sessionEnd > eventStart;
          });
          if (collision) {
            const sessionDate = new Date(sessionStart);
            const dateLabel = sessionDate.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            const itemLabel = `${dateLabel}: ${collision.summary}`;
            if (!conflicts.includes(itemLabel)) conflicts.push(itemLabel);
          }
        }
        if (conflicts.length) {
          setCalendarConflicts(conflicts.slice(0, 8));
          setSaving(false);
          return;
        }
      }
      setCalendarConflicts([]);

      const milestoneRows = plan.milestones.map((m, i) => ({
        title: m.title,
        description: m.description || `Make measurable progress toward “${rawInput.trim()}” during week ${m.week}.`,
        week: Math.max(1, Math.min(selectedDurationWeeks || 1, Number(m.week) || 1)),
        sort_order: i,
        deadline: deadlineFor(start, Math.min(selectedDurationWeeks || 1, Math.max(1, m.week))),
        status: i === 0 ? 'in_progress' : 'pending',
      }));

      const planItemRows = filteredItems.map(item => {
        const date = scheduleTimesEnabled ? buildDate(item.week, item.day, item.preferred_time || currentLocalTime()) : null;
        const duration = Math.max(5, Number(item.duration_minutes) || 30);
        return {
          plan_version: 1,
          week_number: Math.max(1, Math.min(selectedDurationWeeks || 1, item.week)),
          day_of_week: scheduleMode === 'unscheduled' ? null : item.day,
          scheduled_at: date?.toISOString() ?? null,
          task: item.task,
          purpose: item.purpose?.trim() || `Complete the scheduled task and build consistency toward “${rawInput.trim()}”.`,
          target_metric: item.target_metric?.trim() || `Complete the planned ${duration}-minute session and record the result.`,
          duration_minutes: duration,
          status: 'scheduled',
        };
      });

      const sessionRows = filteredItems.map(item => {
        const date = scheduleTimesEnabled ? buildDate(item.week, item.day, item.preferred_time || currentLocalTime()) : null;
        const milestoneIndex = Math.min(
          Math.max(0, Math.floor(((item.week - 1) / Math.max(1, selectedDurationWeeks || 1)) * plan.milestones.length)),
          Math.max(0, plan.milestones.length - 1)
        );
        return {
          title: conciseSessionTitle(item.task, item.week),
          day_of_week: scheduleMode === 'unscheduled' ? null : item.day,
          scheduled_at: date?.toISOString() ?? null,
          duration_minutes: Math.max(5, Number(item.duration_minutes) || 30),
          status: 'scheduled',
          milestone_sort_order: milestoneIndex,
          notes: [
            scheduleMode === 'unscheduled' ? `Plan cadence: Week ${item.week}` : `Plan day: Week ${item.week}, ${item.day}`,
            `Task: ${item.task}`,
            item.purpose ? `Purpose: ${item.purpose}` : null,
            item.target_metric ? `Target: ${item.target_metric}` : null,
            item.actions?.length ? `Action tree: ${JSON.stringify(item.actions)}` : null,
            ...((item.substeps?.length ? item.substeps : [item.task, item.purpose, item.target_metric ? `Finish when: ${item.target_metric}` : 'Finish by recording what you completed and what needs more practice.']).map((step, index) => `Step ${index + 1}: ${step}`)),
            item.video_url ? `Video: ${item.video_url}` : null
          ].filter(Boolean).join('\n') || null,
        };
      });

      // The database still enforces its legacy executable-step guard for all
      // active goals. Supply a compatibility projection alongside the modern
      // schedule, without discarding the full generated plan.
      const compatibilitySteps = filteredItems.map((item) => ({
        title: item.task,
        purpose: item.purpose || `Complete the planned ${item.duration_minutes}-minute session.`,
        target: item.target_metric || `Complete ${item.duration_minutes} minutes of the scheduled task.`,
        evidence: `Record completion and the result: ${item.target_metric || item.task}`,
      }));
      for (const milestone of plan.milestones) {
        if (compatibilitySteps.length >= 2) break;
        compatibilitySteps.push({
          title: milestone.title,
          purpose: milestone.description || `Progress toward the goal during week ${milestone.week}.`,
          target: `Complete the week ${milestone.week} milestone.`,
          evidence: `Record the completed milestone: ${milestone.title}`,
        });
      }
      const lockedPlan = {
        ...plan,
        goal_title: rawInput.trim(),
        horizon: `${selectedDurationWeeks || 1} weeks`,
        deadline: deadlineFor(start, selectedDurationWeeks || 1),
        steps: compatibilitySteps,
      };

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
          plan_json: lockedPlan,
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
      await refreshEntitlementSnapshot();

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
        if (scheduleTimesEnabled) {
                const { error: calendarError } = await supabase.functions.invoke('google-calendar-sync-goal', {
          headers: sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : undefined,
          body: { goalId: draftGoalId },
        });
        if (calendarError) console.warn('[VOW] Google Calendar sync could not be completed:', calendarError.message);
        }
      } catch {
        console.warn('[VOW] Google Calendar sync could not be completed.');
      }

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(activeDraftStorageKey);
        window.localStorage.removeItem(draftStorageKey);
        const legacySaved = window.localStorage.getItem(legacyDraftStorageKey);
        if (legacySaved) {
          try {
            const legacyDraft = JSON.parse(legacySaved) as { draftGoalId?: string | null };
            if (legacyDraft.draftGoalId === draftGoalId) window.localStorage.removeItem(legacyDraftStorageKey);
          } catch {
            // Leave unrecognised legacy storage untouched.
          }
        }
      }
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
          title={upgrade.feature === 'planning_action' ? 'Planning limit reached' : 'New goal'}
          subtitle={upgrade.feature === 'planning_action'
            ? 'Your free planning actions are used for this month. You can still review saved plans and goals.'
            : 'VOW keeps the first goal free. Premium lets you run multiple active goals at once.'}
        />
        <div className="max-w-xl">
          <UpgradePrompt
            result={upgrade}
            title={upgrade.feature === 'planning_action' ? 'Keep planning with Premium' : 'Your next goal is ready for Premium'}
          />
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
            <p className="text-sm text-vow-ink">{plan.success_metric.trim().toLowerCase() === plan.outcome.trim().toLowerCase() ? `Track progress toward: ${plan.outcome}` : plan.success_metric}</p>
            <p className="vow-label mt-5 mb-2">Baseline</p>
            <p className="text-sm text-vow-muted">{plan.baseline}</p>
          </section>
          <section className="border border-vow-border p-5">
            <p className="vow-label mb-4">Schedule · {selectedDurationLabel}</p>
            <p className="text-xs text-vow-muted -mt-2 mb-3">Select any session to open its step-by-step details and a matching video search.</p>
            <div className="divide-y divide-vow-border">
              {plan.schedule.map((item, i) => {
                const scheduleKey = `${item.week}-${item.day}-${i}`;
                const expanded = expandedScheduleKey === scheduleKey;
                const videoSearch = youtubeSearchReference(item.task, domain?.goal_type || 'goal-specific practice');
                return (
                  <div key={scheduleKey} className="py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedScheduleKey(expanded ? null : scheduleKey)}
                      aria-expanded={expanded}
                      className="w-full flex gap-3 text-left items-start hover:opacity-75"
                    >
                      <span className="text-xs text-vow-muted w-12 shrink-0 pt-0.5">W{item.week}</span>
                      <span className="text-xs text-vow-muted w-20 shrink-0 pt-0.5">{item.day}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-vow-ink font-medium">{item.task}</span>
                        <span className="block text-xs text-vow-muted mt-1">{item.duration_minutes} min · {item.target_metric}</span>
                      </span>
                      <span className="text-xs text-vow-muted shrink-0">{expanded ? '−' : '+'}</span>
                    </button>
                    {expanded && (
                      <div className="ml-32 mt-3 space-y-3 border-l border-vow-border pl-4">
                        <div>
                          <p className="vow-label mb-1">What to do</p>
                          <p className="text-sm leading-6 text-vow-ink">{item.purpose || item.task}</p>
                        </div>
                        <div>
                          <p className="vow-label mb-1">Step-by-step session</p>
                          {item.substeps?.length ? <ol className="list-decimal pl-5 space-y-2">{item.substeps.map((step, stepIndex) => <li key={stepIndex} className="text-sm leading-6 text-vow-ink">{step}</li>)}</ol> : <p className="text-sm leading-6 text-vow-muted">Follow the session task in order, then record the result.</p>}
                        </div>
                        <div>
                          <p className="vow-label mb-1">How to measure it</p>
                          <p className="text-sm leading-6 text-vow-muted">{item.target_metric || 'Complete the session and record what you practised.'}</p>
                        </div>
                        <p className="text-xs text-vow-muted">{item.preferred_time ? `Planned time: ${item.preferred_time} · ` : 'Day-based session · '}{item.duration_minutes} minutes</p>
                        <button
                          type="button"
                          onClick={() => void openPlanReference(item.video_url || videoSearch.url)}
                          className="text-sm text-vow-ink underline underline-offset-4"
                        >
                          {item.video_url && !item.video_url.includes('/results?') ? 'Watch the recommended session video' : 'Find videos for this session'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
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
          {(plan.references?.length || 0) > 0 && (
            <section className="border border-vow-border p-5">
              <p className="vow-label mb-1">Helpful links</p>
              <p className="mb-4 text-xs leading-5 text-vow-muted">A short list of useful resources for the overall goal. Session-specific videos stay inside each session.</p>
              {(showAllPlanReferences ? (plan.references || []) : (plan.references || []).slice(0, 2)).map(reference => (
                <button
                  type="button"
                  key={reference.url}
                  onClick={() => void openPlanReference(reference.url)}
                  className="mb-3 block max-w-full break-words text-left text-sm text-vow-ink underline underline-offset-4 last:mb-0"
                >
                  {reference.title || (isYoutubeUrl(reference.url) ? 'Open YouTube resource' : reference.url)}
                </button>
              ))}
              {(plan.references || []).length > 2 && (
                <button
                  type="button"
                  onClick={() => setShowAllPlanReferences(current => !current)}
                  aria-expanded={showAllPlanReferences}
                  className="mt-1 text-xs text-vow-muted underline underline-offset-4 hover:text-vow-ink"
                >
                  {showAllPlanReferences ? 'Show less' : `More · ${(plan.references || []).length - 2} additional links`}
                </button>
              )}
              {resourceError && <p role="alert" className="mt-3 text-xs text-vow-muted">{resourceError}</p>}
            </section>
          )}
          {calendarConflicts.length > 0 && (
            <section className="border-l-2 border-amber-500 bg-vow-gray/10 p-4 space-y-3" role="alert">
              <p className="text-sm font-medium text-vow-ink">Possible calendar conflicts</p>
              <p className="text-xs leading-5 text-vow-muted">Some planned sessions overlap events already in your device calendar. Adjust your selected days or times, or continue if these events can move.</p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-vow-ink">
                {calendarConflicts.map((conflict) => <li key={conflict}>{conflict}</li>)}
              </ul>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setCalendarConflicts([]); setPlan(null); }} className="vow-btn-ghost">Adjust schedule</button>
                <button type="button" onClick={() => void handleCreate(true)} disabled={saving} className="vow-btn-primary">{saving ? 'Saving your plan…' : 'Continue anyway'}</button>
              </div>
            </section>
          )}
          {error && (
            <div className="flex items-start gap-3 border-l-2 border-vow-ink pl-3">
              <p className="text-sm text-vow-ink flex-1">{error}</p>
              <button onClick={() => void handleCreate()} className="text-xs text-vow-ink underline underline-offset-4 shrink-0">
                Retry
              </button>
            </div>
          )}
          <p className="text-xs leading-5 text-vow-muted">
            Confirming saves this plan and schedules your sessions. You can review future changes at your weekly review.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setPlan(null)} className="vow-btn-ghost">
              Back
            </button>
            <button onClick={() => void handleCreate()} disabled={saving} className="vow-btn-primary flex-1">
              {saving ? 'Saving your plan…' : 'Confirm plan'}
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
              {domain?.goal_type ?? 'Goal'}
            </p>
            <p className="text-sm text-vow-ink">VOW is preparing questions around your goal.</p>
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
                value={answers[index] === CLARIFICATION_SKIP ? '' : (answers[index] || '')}
                onChange={e => setAnswers(x => x.map((a, i) => (i === index ? e.target.value : a)))}
                rows={3}
                className="vow-input resize-none"
                placeholder="Your answer…"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[11px] text-vow-muted">{answers[index] === CLARIFICATION_SKIP ? 'Skipped — VOW will state and use an adjustable assumption.' : 'Answer only if you know; you can skip this.'}</p>
                <button type="button" onClick={() => setAnswers(x => x.map((a, i) => i === index ? (a === CLARIFICATION_SKIP ? '' : CLARIFICATION_SKIP) : a))} className="text-xs text-vow-ink underline underline-offset-4">
                  {answers[index] === CLARIFICATION_SKIP ? 'Undo skip' : 'Skip question'}
                </button>
              </div>
            </div>
          ))}
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
              Goal type · {domain?.goal_type ?? previewDomain?.goal_type ?? 'Not identified yet'}
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
          <p className="text-xs text-vow-muted mt-3">Select the days you can genuinely commit to. Nothing is pre-selected—you choose.</p>
        </div>

        {availableDays.length > 0 && <div className="bg-vow-gray/10 border border-vow-border p-4">
          <label className="vow-label block mb-3">How should VOW schedule your sessions?</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {([
              { value: 'timed', title: 'Timed', detail: 'Set a day and clock time.' },
              { value: 'flexible-day', title: 'Flexible day', detail: 'Keep the day, choose the time later.' },
              { value: 'unscheduled', title: 'Unscheduled', detail: 'Leave sessions in your queue.' },
            ] as const).map(option => <button key={option.value} type="button" aria-pressed={scheduleMode === option.value} onClick={() => setScheduleMode(option.value)} className={scheduleMode === option.value ? 'border border-vow-ink bg-vow-ink text-vow-bg p-3 text-left' : 'border border-vow-border text-vow-ink p-3 text-left hover:border-vow-ink'}>
              <span className="block text-sm font-medium">{option.title}</span>
              <span className="block text-[11px] mt-1 opacity-75">{option.detail}</span>
            </button>)}
          </div>
          {scheduleTimesEnabled && <div className="space-y-3 mt-4">
            {availableDays.map(day => <div key={day} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-vow-border pb-3 last:border-b-0 last:pb-0">
              <div><p className="text-sm text-vow-ink">{day}</p>{!sessionTimes[day] && <p className="text-[11px] text-vow-muted mt-1">Choose a reminder time</p>}</div>
              <TimeWheelPicker value={sessionTimes[day] || currentLocalTime()} onChange={value => setSessionTimes(current => ({ ...current, [day]: value }))} label={day + ' session time'} />
            </div>)}
            <p className="text-xs text-vow-muted">Times can be changed later. VOW will only create reminders for timed sessions.</p>
          </div>}
          {scheduleMode === 'flexible-day' && <p className="text-xs text-vow-muted mt-3">VOW keeps each session on its selected weekday without setting a clock time or reminder.</p>}
          {scheduleMode === 'unscheduled' && <p className="text-xs text-vow-muted mt-3">Sessions will be saved without a weekday or clock time, ready for you to schedule when it suits you.</p>}
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
