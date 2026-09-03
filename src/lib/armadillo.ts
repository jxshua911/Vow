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
  fallback: string;
  confidence: number;
};

type Rule = { category: string; goal_type: string; metric: string; evidence: string[]; integration: string | null; planning_strategy: string; keywords: string[] };
const rules: Rule[] = [
  { category: 'Sports', goal_type: 'Running', metric: 'distance', evidence: ['activity distance', 'activity duration', 'activity pace'], integration: 'Strava', planning_strategy: 'progressive running sessions with gradual workload changes', keywords: ['run', 'running', '5k', '10k', 'marathon', 'half marathon', 'mile', 'km'] },
  { category: 'Sports', goal_type: 'Cycling', metric: 'distance', evidence: ['ride distance', 'ride duration', 'ride speed'], integration: 'Strava', planning_strategy: 'progressive rides with endurance and recovery', keywords: ['cycle', 'cycling', 'bike', 'biking', 'ride', 'kilometre', 'kilometer'] },
  { category: 'Sports', goal_type: 'Swimming', metric: 'distance, duration', evidence: ['swim distance', 'swim duration', 'completed sessions'], integration: 'Strava', planning_strategy: 'progressive swim sessions with technique and recovery', keywords: ['swim', 'swimming', 'pool', 'freestyle', 'laps'] },
  { category: 'Sports', goal_type: 'Football', metric: 'sessions, minutes, performance', evidence: ['training sessions', 'match activity', 'manual performance notes'], integration: 'Strava', planning_strategy: 'structured practice, match work and recovery', keywords: ['football', 'soccer', 'match', 'football training'] },
  { category: 'Education', goal_type: 'Study', metric: 'study time, task completion, accuracy', evidence: ['study sessions', 'completed tasks', 'practice results'], integration: 'Google Calendar', planning_strategy: 'scheduled focused study with spaced practice and checkpoints', keywords: ['study', 'revise', 'revision', 'exam', 'homework', 'learn', 'learning', 'physics', 'chemistry', 'biology', 'maths', 'mathematics'] },
  { category: 'Reading', goal_type: 'Reading', metric: 'pages, books, reading time', evidence: ['pages read', 'books completed', 'reading sessions'], integration: null, planning_strategy: 'consistent reading sessions measured by the clearest available reading metric', keywords: ['read', 'reading', 'book', 'books', 'pages'] },
  { category: 'Mindfulness', goal_type: 'Meditation', metric: 'sessions, duration', evidence: ['meditation sessions', 'meditation duration'], integration: 'Medito', planning_strategy: 'short, repeatable sessions with gradual consistency building', keywords: ['meditate', 'meditation', 'mindfulness'] },
  { category: 'Technology/Projects', goal_type: 'GitHub Contributions', metric: 'contributions, pull requests, commits', evidence: ['GitHub activity', 'pull requests', 'commits'], integration: 'GitHub', planning_strategy: 'break the project into concrete deliverables and ship incrementally', keywords: ['github', 'commit', 'commits', 'pull request', 'contribution', 'coding project'] },
  { category: 'Career/Projects', goal_type: 'Project', metric: 'deliverables, milestones, completion', evidence: ['project milestones', 'completed deliverables', 'project review'], integration: 'Google Calendar', planning_strategy: 'sequence concrete deliverables into weekly execution blocks', keywords: ['portfolio', 'project', 'career', 'cv', 'resume', 'job', 'application', 'internship'] },
  { category: 'Finance', goal_type: 'Saving', metric: 'money saved', evidence: ['manual savings updates', 'transaction records when available', 'milestones'], integration: null, planning_strategy: 'set measurable savings checkpoints and review progress regularly', keywords: ['save', 'saving', 'savings', 'money', 'budget', 'financial', 'finance'] },
  { category: 'Creative', goal_type: 'Creative Practice', metric: 'sessions, completed pieces', evidence: ['practice sessions', 'completed pieces', 'project milestones'], integration: null, planning_strategy: 'turn the creative outcome into repeatable practice and deliverables', keywords: ['music', 'song', 'guitar', 'piano', 'draw', 'drawing', 'paint', 'painting', 'write', 'writing', 'novel', 'creative'] },
];

function extractTarget(text: string, goalType: string): string | null {
  const numeric = text.match(/(\d+(?:\.\d+)?)\s*(km|kilometres?|kilometers?|miles?|mi|pages?|books?|hours?|hrs?|minutes?|mins?|sessions?)/i);
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
  if (/\b(?:finish|complete|ship|submit|deliver)\b/i.test(text)) return 'complete';
  if (/\b(?:improve|increase|grow|raise|more|faster|better)\b/i.test(text)) return 'increase';
  if (/\b(?:build|develop|establish|learn|practice)\b/i.test(text)) return 'build';
  return 'progress';
}

export function analyseGoalForEvidence(input: { title?: string | null; outcome?: string | null; why_it_matters?: string | null }): ArmadilloResult {
  const text = [input.title, input.outcome, input.why_it_matters].filter(Boolean).join(' ').trim().toLowerCase();
  const match = rules.find(rule => rule.keywords.some(keyword => text.includes(keyword)));
  const base = match || { category: 'General', goal_type: 'Goal', metric: 'measurable progress toward the stated outcome', evidence: ['manual progress updates', 'goal milestones', 'completed sessions or actions'], integration: null, planning_strategy: 'define the clearest measurable outcome, then break it into small repeatable actions', keywords: [] };
  const target = extractTarget(text, base.goal_type);
  const timeTarget = extractTimeTarget(text);
  const vague = /\b(?:get better|improve|do more|be better|get fit|work on|try to)\b/i.test(text);
  const needsClarification = !match || (vague && !target);
  return {
    category: base.category, goal_type: base.goal_type, metric: base.metric, target,
    direction: directionFor(text), secondary_metric: base.goal_type === 'Running' && timeTarget ? 'time' : null,
    time_target: timeTarget, evidence: base.evidence,
    evidence_source: base.integration ? [base.integration, 'manual tracking'] : ['manual tracking'],
    integration: base.integration, planning_strategy: base.planning_strategy,
    needs_clarification: needsClarification,
    clarification_reasons: needsClarification ? ['The goal needs a clearer measurable outcome before a personalised plan can be precise.'] : [],
    fallback: 'Manual tracking remains the source of truth if an integration is unavailable or not connected.',
    confidence: match ? (needsClarification ? 0.78 : 0.94) : 0.55,
  };
}
