export type ArmadilloCategory =
  | 'sports_fitness'
  | 'reading'
  | 'education'
  | 'mindfulness'
  | 'technology_projects'
  | 'career'
  | 'health_wellbeing'
  | 'creative'
  | 'personal';

export type EvidenceSource =
  | 'strava'
  | 'google_calendar'
  | 'github'
  | 'medito'
  | 'manual';

export interface ArmadilloEvidenceRecommendation {
  source: EvidenceSource;
  label: string;
  description: string;
  evidenceType: string;
  metric: string;
  confidence: number;
}

export interface ArmadilloResult {
  category: ArmadilloCategory;
  categoryLabel: string;
  goalType: string;
  metric: string;
  evidence: ArmadilloEvidenceRecommendation[];
  primaryEvidence: EvidenceSource;
  reasoning: string;
}

const rules: Array<{
  pattern: RegExp;
  category: ArmadilloCategory;
  categoryLabel: string;
  goalType: string;
  metric: string;
  evidence: ArmadilloEvidenceRecommendation[];
}> = [
  {
    pattern: /run|running|5k|10k|marathon|jog|walk|walking|cycling|cycle|bike|ride|swim|swimming|football|gym|workout|fitness|strength/i,
    category: 'sports_fitness',
    categoryLabel: 'Sports & Fitness',
    goalType: 'Physical activity',
    metric: 'Distance, duration, or completed sessions',
    evidence: [
      { source: 'strava', label: 'Strava', description: 'Automatically record relevant runs, rides, walks and other activities.', evidenceType: 'activity', metric: 'Distance + duration', confidence: 0.96 },
      { source: 'manual', label: 'Manual tracking', description: 'Log activity yourself when no connected source is available.', evidenceType: 'manual', metric: 'User-entered progress', confidence: 0.7 },
    ],
  },
  {
    pattern: /read|reading|book|books|pages/i,
    category: 'reading',
    categoryLabel: 'Reading',
    goalType: 'Reading volume or consistency',
    metric: 'Pages, books, or reading sessions',
    evidence: [
      { source: 'manual', label: 'Manual tracking', description: 'Record pages or reading sessions directly in VOW.', evidenceType: 'manual', metric: 'Pages or sessions', confidence: 0.86 },
    ],
  },
  {
    pattern: /study|school|exam|physics|chemistry|math|mathematics|learn|course|revision|homework/i,
    category: 'education',
    categoryLabel: 'Education',
    goalType: 'Study or learning consistency',
    metric: 'Study time, sessions, or completed work',
    evidence: [
      { source: 'google_calendar', label: 'Google Calendar', description: 'Use scheduled study blocks as the planning and attendance signal.', evidenceType: 'calendar', metric: 'Completed study blocks', confidence: 0.82 },
      { source: 'manual', label: 'Manual tracking', description: 'Log study sessions and completed work directly in VOW.', evidenceType: 'manual', metric: 'Sessions or work completed', confidence: 0.76 },
    ],
  },
  {
    pattern: /meditat|mindful|mindfulness|breath|calm|stress/i,
    category: 'mindfulness',
    categoryLabel: 'Mindfulness',
    goalType: 'Mindfulness practice',
    metric: 'Completed sessions or minutes',
    evidence: [
      { source: 'medito', label: 'Medito', description: 'Use meditation-session activity when a supported connection is available.', evidenceType: 'meditation', metric: 'Sessions + minutes', confidence: 0.9 },
      { source: 'manual', label: 'Manual tracking', description: 'Log meditation sessions directly in VOW.', evidenceType: 'manual', metric: 'Sessions or minutes', confidence: 0.78 },
    ],
  },
  {
    pattern: /github|code|coding|program|programming|software|developer|repository|repo|commit/i,
    category: 'technology_projects',
    categoryLabel: 'Technology & Projects',
    goalType: 'Project or technical output',
    metric: 'Contributions, shipped work, or completed tasks',
    evidence: [
      { source: 'github', label: 'GitHub', description: 'Use repository activity and contributions as evidence when they match the commitment.', evidenceType: 'development_activity', metric: 'Contributions or shipped work', confidence: 0.95 },
      { source: 'manual', label: 'Manual tracking', description: 'Record project milestones that cannot be verified automatically.', evidenceType: 'manual', metric: 'Tasks or milestones', confidence: 0.78 },
    ],
  },
  {
    pattern: /career|portfolio|cv|resume|job|internship|network|application/i,
    category: 'career',
    categoryLabel: 'Career',
    goalType: 'Career development',
    metric: 'Completed applications, projects, or actions',
    evidence: [
      { source: 'google_calendar', label: 'Google Calendar', description: 'Track planned career blocks and completed actions through scheduled work.', evidenceType: 'calendar', metric: 'Completed work blocks', confidence: 0.78 },
      { source: 'github', label: 'GitHub', description: 'Use project activity when the career commitment involves software or public work.', evidenceType: 'development_activity', metric: 'Project activity', confidence: 0.72 },
      { source: 'manual', label: 'Manual tracking', description: 'Log applications, networking actions, and portfolio milestones directly.', evidenceType: 'manual', metric: 'Actions completed', confidence: 0.88 },
    ],
  },
];

export function analyseGoalForEvidence(rawInput: string): ArmadilloResult {
  const input = rawInput.trim();
  const matched = rules.find((rule) => rule.pattern.test(input));

  if (matched) {
    return {
      category: matched.category,
      categoryLabel: matched.categoryLabel,
      goalType: matched.goalType,
      metric: matched.metric,
      evidence: matched.evidence,
      primaryEvidence: matched.evidence[0]?.source || 'manual',
      reasoning: `This commitment looks like ${matched.goalType.toLowerCase()}. ${matched.evidence[0]?.label || 'Manual tracking'} is the most relevant evidence source available from VOW's current evidence catalogue.`,
    };
  }

  return {
    category: 'personal',
    categoryLabel: 'Personal',
    goalType: 'Personal commitment',
    metric: 'Completion of the defined outcome',
    evidence: [
      { source: 'manual', label: 'Manual tracking', description: 'Track the commitment directly in VOW until a more specific evidence source is available.', evidenceType: 'manual', metric: 'Outcome completion', confidence: 0.9 },
    ],
    primaryEvidence: 'manual',
    reasoning: 'No specialised evidence source is confidently applicable yet, so VOW keeps the commitment fully usable with manual tracking.',
  };
}
