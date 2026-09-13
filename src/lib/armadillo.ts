import { specialistFor } from './domainRouter';

export type ArmadilloResult = {
  category: string;
  goal_type: string;
  metric: string;
  target: string | null;
  direction: 'increase' | 'decrease' | 'complete' | 'maintain' | 'build' | 'progress';
  secondary_metric: string | null;
  time_target: string | null;
  evidence: string[];
  evidence_source: string[];
  integration: string | null;
  planning_strategy: string;
  needs_clarification: boolean;
  clarification_reasons: string[];
  safety_flag: boolean;
  safety_note: string | null;
  fallback: string;
  confidence: number;
};

type CanonicalBase = {
  category: string;
  goal_type: string;
  metric: string;
  evidence: string[];
  integration: string | null;
  planning_strategy: string;
};

const GENERIC_SKILL_KEYWORDS = ['learn', 'learning', 'master', 'mastery', 'teach myself', 'teach myself how', 'get good at', 'become good at', 'practice', 'practise', 'improve my skills', 'develop a skill', 'learn how to'];

function extractTarget(text: string, goalType: string): string | null {
  const numeric = text.match(/(\d+(?:\.\d+)?)\s*(km|kilometres?|kilometers?|miles?|mi|pages?|books?|hours?|hrs?|minutes?|mins?|sessions?|repetitions?|reps?|days?|weeks?)/i);
  if (numeric) return numeric[0].trim();
  const money = text.match(/(?:save|saving|budget)\s+(?:of\s+)?([$£€]?\s*\d+(?:[,.]\d+)?)/i);
  if (money) return money[1].trim();
  const named = text.match(/\b(5k|10k|half marathon|marathon)\b/i);
  if (named) return named[0];
  if (goalType === 'Reading' && /daily|every day/i.test(text)) return 'daily reading target';
  return null;
}

function extractTimeTarget(text: string): string | null {
  const numeric = text.match(/\b(?:under|below|within)\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/i);
  if (numeric) return numeric[0].trim();
  if (/\b(?:under|below|within)\s+(?:an?|one)\s+hour\b/i.test(text)) return 'under 60 minutes';
  return null;
}

function directionFor(text: string): ArmadilloResult['direction'] {
  if (/\b(?:reduce|decrease|lower|cut|spend less)\b/i.test(text)) return 'decrease';
  if (/\b(?:maintain|keep|sustain)\b/i.test(text)) return 'maintain';
  if (/\b(?:finish|complete|ship|submit|deliver|make|create)\b/i.test(text)) return 'complete';
  if (/\b(?:improve|increase|grow|raise|more|faster|better)\b/i.test(text)) return 'increase';
  if (/\b(?:build|develop|establish|learn|practice|practise|master)\b/i.test(text)) return 'build';
  return 'progress';
}

function safetyFor(text: string, goalType: string): { flag: boolean; note: string | null } {
  const shortEndurance = ['Running', 'Cycling', 'Swimming'].includes(goalType) && /\b(?:marathon|half marathon|10k|10 km|5k|5 km|50 km|100 km)\b/i.test(text) && /\bin\s+(?:[1-3]\s+(?:days?|weeks?)|a\s+few\s+days)\b/i.test(text);
  return shortEndurance ? { flag: true, note: 'The timeframe is aggressive for an endurance target. VOW should keep the stated goal visible but prioritise a realistic workload and avoid sudden increases.' } : { flag: false, note: null };
}

function canonicalBase(text: string): { base: CanonicalBase | null; genericSkill: boolean } {
  const specialist = specialistFor({ title: text });
  if (specialist) {
    return {
      base: {
        category: specialist.domain,
        goal_type: specialist.goal_types[0] || 'Goal',
        metric: specialist.evidence.join(', '),
        evidence: specialist.evidence,
        integration: null,
        planning_strategy: specialist.planning_lens,
      },
      genericSkill: false,
    };
  }

  const genericSkill = GENERIC_SKILL_KEYWORDS.some(keyword => text.includes(keyword));
  if (genericSkill) {
    return {
      base: {
        category: 'Skill Development',
        goal_type: 'Skill Acquisition',
        metric: 'skills mastered, practice sessions, completed applications or projects',
        evidence: ['practice sessions', 'skills completed', 'real-world applications or finished projects'],
        integration: null,
        planning_strategy: 'identify the skill baseline, teach fundamentals, practise progressively, apply the skill and assess against the desired outcome',
      },
      genericSkill: true,
    };
  }

  return {
    base: {
      category: 'General',
      goal_type: 'Goal',
      metric: 'measurable progress toward the stated outcome',
      evidence: ['manual progress updates', 'goal milestones', 'completed sessions or actions'],
      integration: null,
      planning_strategy: 'define the clearest measurable outcome, establish a baseline, then break it into progressive repeatable actions',
    },
    genericSkill: false,
  };
}

export function analyseGoalForEvidence(input: { title?: string | null; outcome?: string | null; why_it_matters?: string | null }): ArmadilloResult {
  const text = [input.title, input.outcome, input.why_it_matters].filter(Boolean).join(' ').trim().toLowerCase();
  const { base, genericSkill } = canonicalBase(text);
  const target = extractTarget(text, base!.goal_type);
  const timeTarget = extractTimeTarget(text);
  const vague = /\b(?:get better|improve|do more|be better|get fit|work on|try to)\b/i.test(text);
  const safety = safetyFor(text, base!.goal_type);
  const needsClarification = true;
  const reasons = genericSkill || base!.category === 'General' || vague || !target
    ? ['Ask 2–3 goal-specific questions to establish starting level, desired outcome and practical constraints. Blank answers mean Level 1 beginner assumptions.']
    : ['Ask 2–3 goal-specific questions to personalise the progression, even when the goal is already measurable.'];

  return {
    category: base!.category,
    goal_type: base!.goal_type,
    metric: base!.metric,
    target,
    direction: directionFor(text),
    secondary_metric: timeTarget ? 'time' : null,
    time_target: timeTarget,
    evidence: base!.evidence,
    evidence_source: base!.integration ? [base!.integration, 'manual tracking'] : ['manual tracking'],
    integration: base!.integration,
    planning_strategy: base!.planning_strategy,
    needs_clarification: needsClarification,
    clarification_reasons: reasons,
    safety_flag: safety.flag,
    safety_note: safety.note,
    fallback: 'Manual tracking remains the source of truth if an integration is unavailable or not connected.',
    confidence: base!.category !== 'General' ? 0.94 : genericSkill ? 0.82 : 0.55,
  };
}
