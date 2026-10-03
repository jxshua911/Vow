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
  health: 'health',
  wellness: 'health',
  learning: 'learning',
  study: 'learning',
  school: 'learning',
  work: 'career',
  career: 'career',
  professional: 'career',
  creative: 'creative',
  art: 'creative',
  writing: 'creative',
  mindfulness: 'mindfulness',
  meditation: 'mindfulness',
  focus: 'mindfulness',
  relationship: 'relationship',
  family: 'relationship',
  social: 'relationship',
  personal: 'personal',
  habit: 'personal',
  money: 'money',
  finance: 'money',
  home: 'home',
  organization: 'home',
  household: 'home',
  general: 'general',
};

export function normalizeGoalCategory(value: unknown): GoalCategory | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  return CATEGORY_ALIASES[raw] ?? 'general';
}
