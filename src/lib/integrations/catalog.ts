export type IntegrationCategory = 'fitness' | 'health' | 'education' | 'productivity' | 'reading' | 'mindfulness' | 'faith';
export type IntegrationStatus = 'available' | 'setup-required';

export interface IntegrationDefinition {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  evidence: string[];
  status: IntegrationStatus;
  connectionType: 'oauth' | 'native' | 'health-platform' | 'manual';
  recommendedGoalKeywords: string[];
  iconUrl: string;
  websiteUrl?: string;
}

export const INTEGRATIONS: IntegrationDefinition[] = [
  { id: 'google-calendar', name: 'Google Calendar', category: 'productivity', description: 'Use scheduled events as supporting evidence and create planned sessions.', evidence: ['scheduled sessions', 'event timing'], status: 'available', connectionType: 'oauth', recommendedGoalKeywords: ['study', 'meeting', 'class', 'practice', 'appointment'], iconUrl: 'https://cdn.simpleicons.org/googlecalendar', websiteUrl: 'https://calendar.google.com/' },
  { id: 'strava', name: 'Strava', category: 'fitness', description: 'Verify eligible running, cycling and other recorded activities.', evidence: ['distance', 'duration', 'activity type', 'activity date'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['run', 'running', 'cycle', 'cycling', 'bike', 'ride', 'swim', 'workout', 'fitness', 'gym', 'strength training'], iconUrl: 'https://cdn.simpleicons.org/strava', websiteUrl: 'https://www.strava.com/' },
  { id: 'health-connect', name: 'Health Connect', category: 'health', description: 'Connect compatible Android health and fitness apps through one health-data layer.', evidence: ['steps', 'distance', 'exercise', 'sleep', 'heart rate'], status: 'setup-required', connectionType: 'health-platform', recommendedGoalKeywords: ['steps', 'sleep', 'walk', 'run', 'exercise', 'workout', 'health', 'fitness'], iconUrl: 'https://cdn.simpleicons.org/android', websiteUrl: 'https://health.google/health-connect/' },
  { id: 'samsung-health', name: 'Samsung Health', category: 'health', description: 'Use supported Samsung health data through the appropriate Android health-data path.', evidence: ['exercise', 'sleep', 'steps', 'activity'], status: 'setup-required', connectionType: 'health-platform', recommendedGoalKeywords: ['sleep', 'steps', 'exercise', 'workout', 'run'], iconUrl: 'https://cdn.simpleicons.org/samsung', websiteUrl: 'https://www.samsung.com/us/apps/samsung-health/' },
  { id: 'apple-health', name: 'Apple Health', category: 'health', description: 'Use permitted HealthKit data for measurable health and fitness goals.', evidence: ['workouts', 'distance', 'steps', 'sleep'], status: 'setup-required', connectionType: 'health-platform', recommendedGoalKeywords: ['sleep', 'steps', 'exercise', 'workout', 'run', 'walk'], iconUrl: 'https://cdn.simpleicons.org/apple', websiteUrl: 'https://www.apple.com/ios/health/' },
  { id: 'google-classroom', name: 'Google Classroom', category: 'education', description: 'Use coursework and assignment data as educational goal evidence where permitted.', evidence: ['coursework', 'assignment status', 'due dates'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['school', 'study', 'assignment', 'homework', 'class', 'course'], iconUrl: 'https://cdn.simpleicons.org/googleclassroom', websiteUrl: 'https://classroom.google.com/' },
  { id: 'google-tasks', name: 'Google Tasks', category: 'productivity', description: 'Bring task completion into VOW as supporting evidence.', evidence: ['task completion', 'task dates'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['task', 'complete', 'assignment', 'work'], iconUrl: 'https://cdn.simpleicons.org/googletasks', websiteUrl: 'https://tasks.google.com/' },
  { id: 'kahoot', name: 'Kahoot!', category: 'education', description: 'Support learning goals through permitted learning activity data.', evidence: ['quiz participation', 'learning activity'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['quiz', 'revision', 'study', 'learning', 'school'], iconUrl: 'https://cdn.simpleicons.org/kahoot', websiteUrl: 'https://kahoot.com/' },
  { id: 'focus-sessions', name: 'Focus sessions', category: 'productivity', description: 'VOW focus sessions provide first-party evidence for study and work goals.', evidence: ['focus duration', 'session date'], status: 'available', connectionType: 'native', recommendedGoalKeywords: ['study', 'focus', 'read', 'work', 'revision'], iconUrl: 'https://cdn.simpleicons.org/focusmate' },
  { id: 'medito', name: 'Medito', category: 'mindfulness', description: 'Use supported meditation activity as evidence for mindfulness goals.', evidence: ['session duration', 'session date'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['meditate', 'meditation', 'mindfulness', 'breathing'], iconUrl: 'https://cdn.simpleicons.org/medito', websiteUrl: 'https://meditofoundation.org/' },
  { id: 'headspace', name: 'Headspace', category: 'mindfulness', description: 'Use supported meditation activity as evidence for mindfulness goals.', evidence: ['session duration', 'session date'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['meditate', 'meditation', 'mindfulness', 'breathing', 'focus'], iconUrl: 'https://cdn.simpleicons.org/headspace', websiteUrl: 'https://www.headspace.com/' },
  { id: 'kindle', name: 'Kindle', category: 'reading', description: 'Use supported reading activity where the provider permits access.', evidence: ['reading activity', 'reading date'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['read', 'reading', 'book', 'pages', 'chapter'], iconUrl: 'https://cdn.simpleicons.org/amazonkindle', websiteUrl: 'https://www.amazon.com/kindle-dbs/fd/kcp' },
  { id: 'google-books', name: 'Google Books', category: 'reading', description: 'Use supported reading and library activity where available.', evidence: ['book activity', 'reading date'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['read', 'reading', 'book', 'pages', 'chapter'], iconUrl: 'https://cdn.simpleicons.org/googleplaybooks', websiteUrl: 'https://books.google.com/' },
  { id: 'youversion', name: 'YouVersion Bible', category: 'faith', description: 'Use supported Bible reading-plan activity where provider access permits.', evidence: ['reading session', 'plan progress'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['bible', 'scripture', 'devotion', 'prayer', 'read'], iconUrl: 'https://cdn.simpleicons.org/bible', websiteUrl: 'https://www.youversion.com/' },
  { id: 'google-drive', name: 'Google Drive', category: 'education', description: 'Use files and document activity as supporting evidence where explicitly permitted.', evidence: ['file activity', 'document dates'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['study', 'assignment', 'school', 'project', 'document'], iconUrl: 'https://cdn.simpleicons.org/googledrive', websiteUrl: 'https://drive.google.com/' },
  { id: 'github', name: 'GitHub', category: 'productivity', description: 'Track project work through public contribution activity and completed deliverables.', evidence: ['commits', 'pull requests', 'repository activity'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['github', 'code', 'coding', 'commit', 'pull request', 'repository', 'programming'], iconUrl: 'https://cdn.simpleicons.org/github', websiteUrl: 'https://github.com/' },
];

function containsKeyword(text: string, keyword: string): boolean {
  const words = text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const phrase = keyword.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  return phrase.length > 0 && words.some((_, index) =>
    phrase.every((word, offset) => words[index + offset] === word)
  );
}

export function recommendIntegrations(goals: string[]): IntegrationDefinition[] {
  const text = goals.filter(Boolean).join(' ');
  return INTEGRATIONS.map((integration) => ({
    integration,
    score: integration.recommendedGoalKeywords.reduce(
      (score, keyword) => score + Number(containsKeyword(text, keyword)),
      0
    ),
  }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || Number(b.integration.status === 'available') - Number(a.integration.status === 'available'))
    .map(({ integration }) => integration);
}
