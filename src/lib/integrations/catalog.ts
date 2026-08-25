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
  domain?: string;
}

export const INTEGRATIONS: IntegrationDefinition[] = [
  { id: 'google-calendar', name: 'Google Calendar', category: 'productivity', description: 'Use scheduled events as supporting evidence and create planned sessions.', evidence: ['scheduled sessions', 'event timing'], status: 'available', connectionType: 'oauth', recommendedGoalKeywords: ['study','meeting','class','practice','appointment'], iconUrl: 'https://cdn.simpleicons.org/googlecalendar' },
  { id: 'strava', name: 'Strava', category: 'fitness', description: 'Verify eligible running, cycling and other recorded activities.', evidence: ['distance','duration','activity type','activity date'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['run','running','cycle','cycling','bike','ride','swim','workout'], iconUrl: 'https://cdn.simpleicons.org/strava' },
  { id: 'health-connect', name: 'Health Connect', category: 'health', description: 'Connect compatible Android health and fitness apps through one health-data layer.', evidence: ['steps','distance','exercise','sleep','heart rate'], status: 'setup-required', connectionType: 'health-platform', recommendedGoalKeywords: ['steps','sleep','walk','run','exercise','workout','health'], iconUrl: 'https://cdn.simpleicons.org/android' },
  { id: 'samsung-health', name: 'Samsung Health', category: 'health', description: 'Use supported Samsung health data through the appropriate Android health-data path.', evidence: ['exercise','sleep','steps','activity'], status: 'setup-required', connectionType: 'health-platform', recommendedGoalKeywords: ['sleep','steps','exercise','workout','run'], iconUrl: 'https://cdn.simpleicons.org/samsung' },
  { id: 'apple-health', name: 'Apple Health', category: 'health', description: 'Use permitted HealthKit data for measurable health and fitness goals.', evidence: ['workouts','distance','steps','sleep'], status: 'setup-required', connectionType: 'health-platform', recommendedGoalKeywords: ['sleep','steps','exercise','workout','run','walk'], iconUrl: 'https://cdn.simpleicons.org/apple' },
  { id: 'google-classroom', name: 'Google Classroom', category: 'education', description: 'Use coursework and assignment data as educational goal evidence where permitted.', evidence: ['coursework','assignment status','due dates'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['school','study','assignment','homework','class','course'], iconUrl: 'https://cdn.simpleicons.org/googleclassroom' },
  { id: 'google-tasks', name: 'Google Tasks', category: 'productivity', description: 'Bring task completion into VOW as supporting evidence.', evidence: ['task completion','task dates'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['task','complete','assignment','work'], iconUrl: 'https://cdn.simpleicons.org/googletasks' },
  { id: 'kahoot', name: 'Kahoot!', category: 'education', description: 'Support learning goals through permitted learning activity data.', evidence: ['quiz participation','learning activity'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['quiz','revision','study','learning','school'], iconUrl: 'https://cdn.simpleicons.org/kahoot' },
  { id: 'focus-sessions', name: 'Focus sessions', category: 'productivity', description: 'VOW focus sessions provide first-party evidence for study and work goals.', evidence: ['focus duration','session date'], status: 'available', connectionType: 'native', recommendedGoalKeywords: ['study','focus','read','work','revision'], iconUrl: 'https://cdn.simpleicons.org/focusmate' },
  { id: 'medito', name: 'Medito', category: 'mindfulness', description: 'Use supported meditation activity as evidence for mindfulness goals.', evidence: ['session duration','session date'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['meditate','meditation','mindfulness','breathing'], iconUrl: 'https://cdn.simpleicons.org/medito' },
  { id: 'headspace', name: 'Headspace', category: 'mindfulness', description: 'Use supported meditation activity as evidence for mindfulness goals.', evidence: ['session duration','session date'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['meditate','meditation','mindfulness','breathing','focus'], iconUrl: 'https://cdn.simpleicons.org/headspace' },
  { id: 'kindle', name: 'Kindle', category: 'reading', description: 'Use supported reading activity where the provider permits access.', evidence: ['reading activity','reading date'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['read','reading','book','pages','chapter'], iconUrl: 'https://cdn.simpleicons.org/amazonkindle' },
  { id: 'google-books', name: 'Google Books', category: 'reading', description: 'Use supported reading and library activity where available.', evidence: ['book activity','reading date'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['read','reading','book','pages','chapter'], iconUrl: 'https://cdn.simpleicons.org/googleplaybooks' },
  { id: 'youversion', name: 'YouVersion Bible', category: 'faith', description: 'Use supported Bible reading-plan activity where provider access permits.', evidence: ['reading session','plan progress'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['bible','scripture','devotion','prayer','read'], iconUrl: 'https://cdn.simpleicons.org/bible' },
  { id: 'google-drive', name: 'Google Drive', category: 'education', description: 'Use files and document activity as supporting evidence where explicitly permitted.', evidence: ['file activity','document dates'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['study','assignment','school','project','document'], iconUrl: 'https://cdn.simpleicons.org/googledrive' },
  { id: 'google-tasks', name: 'Google Tasks', category: 'productivity', description: 'Bring task completion into VOW as supporting evidence.', evidence: ['task completion','task dates'], status: 'setup-required', connectionType: 'oauth', recommendedGoalKeywords: ['task','complete','assignment','work'], iconUrl: 'https://cdn.simpleicons.org/googletasks' },
];

export function recommendIntegrations(goals: string[]): IntegrationDefinition[] {
  const text = goals.join(' ').toLowerCase();
  return INTEGRATIONS
    .map((integration) => ({ integration, score: integration.recommendedGoalKeywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ integration }) => integration);
}
