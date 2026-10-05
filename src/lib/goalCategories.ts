export type GoalCategory =
  | 'fitness'
  | 'learning'
  | 'career'
  | 'creative'
  | 'mindfulness'
  | 'relationship'
  | 'health'
  | 'personal'
  | 'money'
  | 'home'
  | 'general';

const CATEGORY_ALIASES: Record<string, GoalCategory> = {
  fitness: 'fitness',
  exercise: 'fitness',
  sports: 'fitness',
  health: 'health',
  wellness: 'health',
  wellbeing: 'health',
  learning: 'learning',
  study: 'learning',
  school: 'learning',
  education: 'learning',
  reading: 'learning',
  languages: 'learning',
  'practical skills': 'learning',
  work: 'career',
  career: 'career',
  professional: 'career',
  'career/projects': 'career',
  'technology/projects': 'career',
  creative: 'creative',
  art: 'creative',
  writing: 'creative',
  'crafts/hobbies': 'creative',
  'creative skills': 'creative',
  mindfulness: 'mindfulness',
  meditation: 'mindfulness',
  focus: 'mindfulness',
  relationship: 'relationship',
  family: 'relationship',
  social: 'relationship',
  communication: 'relationship',
  personal: 'personal',
  habit: 'personal',
  'personal development': 'personal',
  'life admin': 'personal',
  productivity: 'personal',
  travel: 'personal',
  money: 'money',
  finance: 'money',
  home: 'home',
  organization: 'home',
  household: 'home',
  general: 'general',
  'general goal': 'general',
};

export function normalizeGoalCategory(value: unknown): GoalCategory | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  return CATEGORY_ALIASES[raw] ?? 'general';
}
