export type IntegrationCategory =
  | 'fitness'
  | 'health'
  | 'education'
  | 'productivity'
  | 'reading'
  | 'mindfulness'
  | 'faith';

export type IntegrationStatus = 'available' | 'planned';

export interface IntegrationDefinition {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  evidence: string[];
  status: IntegrationStatus;
  connectionType: 'oauth' | 'native' | 'health-platform' | 'manual';
  recommendedGoalKeywords: string[];
}

/**
 * Central integration catalogue. Providers are deliberately modelled separately
 * from the UI so Connect can recommend integrations from a user's goals without
 * coupling the goal system to individual APIs.
 */
export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    id: 'google-calendar', name: 'Google Calendar', category: 'productivity',
    description: 'Use scheduled events as supporting evidence and create planned sessions.',
    evidence: ['scheduled sessions', 'event timing'], status: 'available', connectionType: 'oauth',
    recommendedGoalKeywords: ['study', 'meeting', 'class', 'practice', 'appointment'],
  },
  {
    id: 'strava', name: 'Strava', category: 'fitness',
    description: 'Verify eligible running, cycling and other recorded activities.',
    evidence: ['distance', 'duration', 'activity type', 'activity date'], status: 'available', connectionType: 'oauth',
    recommendedGoalKeywords: ['run', 'running', 'cycle', 'cycling', 'bike', 'ride', 'swim', 'workout'],
  },
  {
    id: 'health-connect', name: 'Health Connect', category: 'health',
    description: 'Connect compatible Android health and fitness apps through one health-data layer.',
    evidence: ['steps', 'distance', 'exercise', 'sleep', 'heart rate'], status: 'planned', connectionType: 'health-platform',
    recommendedGoalKeywords: ['steps', 'sleep', 'walk', 'run', 'exercise', 'workout', 'health'],
  },
  {
    id: 'samsung-health', name: 'Samsung Health', category: 'health',
    description: 'Use supported Samsung health data through the appropriate Android health-data path.',
    evidence: ['exercise', 'sleep', 'steps', 'activity'], status: 'planned', connectionType: 'health-platform',
    recommendedGoalKeywords: ['sleep', 'steps', 'exercise', 'workout', 'run'],
  },
  {
    id: 'apple-health', name: 'Apple Health', category: 'health',
    description: 'Use permitted HealthKit data for measurable health and fitness goals.',
    evidence: ['workouts', 'distance', 'steps', 'sleep'], status: 'planned', connectionType: 'health-platform',
    recommendedGoalKeywords: ['sleep', 'steps', 'exercise', 'workout', 'run', 'walk'],
  },
  {
    id: 'google-classroom', name: 'Google Classroom', category: 'education',
    description: 'Use coursework and assignment data as educational goal evidence where permitted.',
    evidence: ['coursework', 'assignment status', 'due dates'], status: 'planned', connectionType: 'oauth',
    recommendedGoalKeywords: ['school', 'study', 'assignment', 'homework', 'class', 'course'],
  },
  {
    id: 'google-tasks', name: 'Google Tasks', category: 'productivity',
    description: 'Bring task completion into VOW as supporting evidence.',
    evidence: ['task completion', 'task dates'], status: 'planned', connectionType: 'oauth',
    recommendedGoalKeywords: ['task', 'complete', 'assignment', 'work'],
  },
  {
    id: 'kahoot', name: 'Kahoot!', category: 'education',
    description: 'Support learning goals where an official, permitted integration is available.',
    evidence: ['quiz participation', 'learning activity'], status: 'planned', connectionType: 'oauth',
    recommendedGoalKeywords: ['quiz', 'revision', 'study', 'learning', 'school'],
  },
  {
    id: 'focus-sessions', name: 'VOW Focus Sessions', category: 'productivity',
    description: 'Native VOW focus sessions provide first-party evidence for study and work goals.',
    evidence: ['focus duration', 'session date'], status: 'available', connectionType: 'native',
    recommendedGoalKeywords: ['study', 'focus', 'read', 'work', 'revision'],
  },
  {
    id: 'vow-journal', name: 'VOW Journal', category: 'mindfulness',
    description: 'Reflection can support completion without pretending it is external proof.',
    evidence: ['reflection submitted', 'reflection date'], status: 'available', connectionType: 'native',
    recommendedGoalKeywords: ['journal', 'reflect', 'reflection', 'mindfulness', 'gratitude'],
  },
  {
    id: 'bible-reading', name: 'Bible Reading', category: 'faith',
    description: 'Track Bible reading through VOW and add supported external providers when APIs permit.',
    evidence: ['reading session', 'reading plan progress'], status: 'available', connectionType: 'native',
    recommendedGoalKeywords: ['bible', 'scripture', 'devotion', 'prayer', 'read'],
  },
  {
    id: 'meditation', name: 'VOW Meditation', category: 'mindfulness',
    description: 'Native meditation sessions give VOW reliable first-party evidence.',
    evidence: ['session duration', 'session date'], status: 'available', connectionType: 'native',
    recommendedGoalKeywords: ['meditate', 'meditation', 'mindfulness', 'breathing'],
  },
  {
    id: 'reading', name: 'VOW Reading', category: 'reading',
    description: 'Track reading sessions and progress without requiring a third-party service.',
    evidence: ['session duration', 'pages recorded', 'reading date'], status: 'available', connectionType: 'native',
    recommendedGoalKeywords: ['read', 'reading', 'book', 'pages', 'chapter'],
  },
];

export function recommendIntegrations(goals: string[]): IntegrationDefinition[] {
  const text = goals.join(' ').toLowerCase();
  return INTEGRATIONS
    .map((integration) => ({
      integration,
      score: integration.recommendedGoalKeywords.reduce(
        (score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0,
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ integration }) => integration);
}
