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

type Rule = { category: string; goal_type: string; metric: string; evidence: string[]; integration: string | null; planning_strategy: string; keywords: string[] };

// Armadillo is a routing layer, not a complete planner. These rules deliberately
// cover broad goal families so the AI planner can reason about unfamiliar goals
// instead of forcing every new hobby or skill into Education or General.
const rules: Rule[] = [
  { category: 'Sports', goal_type: 'Running', metric: 'distance, pace, time', evidence: ['activity distance', 'activity pace', 'activity time'], integration: 'Strava', planning_strategy: 'progressive running: establish baseline, build aerobic capacity, add goal-specific work, taper or assess', keywords: ['run', 'running', '5k', '5 km', '10k', '10 km', 'marathon', 'half marathon', 'mile', 'miles', 'jog'] },
  { category: 'Sports', goal_type: 'Cycling', metric: 'distance, duration, speed', evidence: ['ride distance', 'ride duration', 'ride speed'], integration: 'Strava', planning_strategy: 'progressive cycling: establish riding baseline, build endurance, add technique or intensity, recover and assess', keywords: ['cycle', 'cycling', 'bike', 'biking', 'ride', 'riding', 'kilometre', 'kilometer'] },
  { category: 'Sports', goal_type: 'Swimming', metric: 'distance, duration, technique', evidence: ['swim distance', 'swim duration', 'completed sessions'], integration: 'Strava', planning_strategy: 'progressive swimming: water confidence and technique first, then repeatable distance, efficiency and goal-specific practice', keywords: ['swim', 'swimming', 'pool', 'freestyle', 'backstroke', 'breaststroke', 'butterfly', 'laps'] },
  { category: 'Sports', goal_type: 'Football', metric: 'sessions, minutes, skill performance', evidence: ['training sessions', 'match activity', 'manual performance notes'], integration: 'Strava', planning_strategy: 'structured football practice: technical foundations, position-specific work, decision making, match application and review', keywords: ['football', 'soccer', 'match', 'dribbling', 'passing', 'shooting', 'defending', 'football training'] },
  { category: 'Sports', goal_type: 'Basketball', metric: 'sessions, repetitions, skill performance', evidence: ['practice sessions', 'made shots or repetitions', 'manual performance notes'], integration: 'Strava', planning_strategy: 'progressive basketball practice: fundamentals, controlled repetition, game-speed application and performance review', keywords: ['basketball', 'shooting hoops', 'layup', 'free throw', 'dribble'] },
  { category: 'Sports', goal_type: 'Tennis', metric: 'sessions, repetitions, skill performance', evidence: ['practice sessions', 'rally or serve practice', 'manual performance notes'], integration: 'Strava', planning_strategy: 'progressive tennis practice: technique, repeatable drills, movement, point play and review', keywords: ['tennis', 'serve', 'forehand', 'backhand', 'racket'] },
  { category: 'Sports', goal_type: 'Golf', metric: 'practice sessions, shots, scoring', evidence: ['practice sessions', 'shots or rounds', 'score records'], integration: 'Strava', planning_strategy: 'progressive golf practice: fundamentals, repeatable technique, short-game work, course application and scoring review', keywords: ['golf', 'putting', 'driving range', 'golf swing'] },
  { category: 'Sports', goal_type: 'Surfing', metric: 'sessions, time in water, skills completed', evidence: ['surf sessions', 'time in water', 'skills completed'], integration: 'Strava', planning_strategy: 'progressive surfing: water and board fundamentals, positioning, paddling, safe take-offs, wave selection and controlled riding', keywords: ['surf', 'surfing', 'surfboard', 'wave riding', 'waves'] },
  { category: 'Sports', goal_type: 'Dance', metric: 'practice sessions, routines completed, technique', evidence: ['dance sessions', 'routines completed', 'practice notes'], integration: null, planning_strategy: 'progressive dance: fundamentals, isolated movements, combinations, choreography and performance practice', keywords: ['dance', 'dancing', 'hip hop dance', 'ballet', 'salsa', 'contemporary dance'] },
  { category: 'Education', goal_type: 'Academic Study', metric: 'study time, task completion, accuracy', evidence: ['study sessions', 'completed tasks', 'practice results'], integration: 'Google Calendar', planning_strategy: 'structured study: diagnose baseline, learn concepts, retrieve from memory, practise, test and close gaps', keywords: ['study', 'studying', 'revise', 'revision', 'exam', 'homework', 'physics', 'chemistry', 'biology', 'maths', 'mathematics', 'geography', 'history', 'economics', 'computer science', 'schoolwork'] },
  { category: 'Languages', goal_type: 'Language Learning', metric: 'vocabulary, comprehension, speaking or writing ability', evidence: ['language practice sessions', 'vocabulary recall', 'speaking or writing samples'], integration: 'Google Calendar', planning_strategy: 'language progression: pronunciation and core vocabulary, sentence formation, comprehension, production and real-world use', keywords: ['french', 'spanish', 'german', 'italian', 'portuguese', 'arabic', 'swahili', 'japanese', 'korean', 'mandarin', 'chinese', 'language', 'speak fluent', 'learn a language', 'learn french', 'learn spanish'] },
  { category: 'Reading', goal_type: 'Reading', metric: 'pages, books, reading time, comprehension', evidence: ['pages read', 'books completed', 'reading sessions'], integration: null, planning_strategy: 'consistent reading with a suitable pace, comprehension checks and progressively longer or more demanding material', keywords: ['read', 'reading', 'book', 'books', 'pages', 'novel'] },
  { category: 'Creative Skills', goal_type: 'Crochet', metric: 'techniques mastered, practice sessions, finished projects', evidence: ['practice sessions', 'techniques completed', 'finished projects'], integration: null, planning_strategy: 'skill progression: tools and terminology, foundational stitches, tension and control, construction techniques, guided project and independent project', keywords: ['crochet', 'crocheting', 'crochet hook', 'amigurumi'] },
  { category: 'Creative Skills', goal_type: 'Knitting', metric: 'techniques mastered, practice sessions, finished projects', evidence: ['practice sessions', 'techniques completed', 'finished projects'], integration: null, planning_strategy: 'skill progression: tools and terminology, cast-on, core stitches, tension, shaping, guided project and independent project', keywords: ['knit', 'knitting', 'knitting needles', 'purl', 'cast on'] },
  { category: 'Creative Skills', goal_type: 'Drawing', metric: 'practice sessions, exercises completed, finished pieces', evidence: ['drawing sessions', 'completed exercises', 'finished pieces'], integration: null, planning_strategy: 'skill progression: observation and control, shapes and proportion, value, perspective, composition and finished studies', keywords: ['draw', 'drawing', 'sketch', 'sketching', 'illustration'] },
  { category: 'Creative Skills', goal_type: 'Painting', metric: 'practice sessions, techniques mastered, finished pieces', evidence: ['painting sessions', 'techniques completed', 'finished pieces'], integration: null, planning_strategy: 'skill progression: materials and colour basics, brush control, value and composition, studies, then complete works', keywords: ['paint', 'painting', 'watercolour', 'watercolor', 'acrylic painting', 'oil painting'] },
  { category: 'Creative Skills', goal_type: 'Music', metric: 'practice sessions, techniques mastered, pieces performed', evidence: ['practice sessions', 'technique exercises', 'pieces completed'], integration: null, planning_strategy: 'skill progression: setup and fundamentals, technique, rhythm or theory, controlled pieces, then independent performance', keywords: ['music', 'musical instrument', 'instrument', 'piano', 'guitar', 'keyboard', 'drums', 'violin', 'ukulele', 'singing', 'vocals'] },
  { category: 'Creative Skills', goal_type: 'Writing', metric: 'writing sessions, drafts, completed pieces', evidence: ['writing sessions', 'drafts', 'completed pieces'], integration: null, planning_strategy: 'progressive writing: define outcome, practise fundamentals, draft, revise, get feedback and finish a complete piece', keywords: ['write', 'writing', 'poetry', 'story', 'short story', 'novel', 'screenplay', 'lyrics'] },
  { category: 'Creative Skills', goal_type: 'Photography', metric: 'practice sessions, photographs, technique exercises', evidence: ['photo sessions', 'completed exercises', 'photo reviews'], integration: null, planning_strategy: 'progressive photography: camera or phone fundamentals, exposure and focus, composition, controlled shoots, editing and a finished set', keywords: ['photography', 'photograph', 'photos', 'camera', 'portrait photography', 'street photography'] },
  { category: 'Practical Skills', goal_type: 'Cooking', metric: 'techniques mastered, dishes completed, consistency', evidence: ['cooking sessions', 'dishes completed', 'recipe outcomes'], integration: null, planning_strategy: 'progressive cooking: kitchen fundamentals, core techniques, simple dishes, combining techniques and increasingly independent meals', keywords: ['cook', 'cooking', 'baking', 'bake', 'recipe', 'culinary', 'chef'] },
  { category: 'Practical Skills', goal_type: 'Woodworking', metric: 'techniques mastered, projects completed, measurements', evidence: ['work sessions', 'completed projects', 'project measurements'], integration: null, planning_strategy: 'progressive making: tool familiarity and safety, measurement and joining fundamentals, guided project, then independent build', keywords: ['woodworking', 'woodwork', 'carpentry', 'wood project', 'build furniture'] },
  { category: 'Technology/Projects', goal_type: 'Programming', metric: 'concepts mastered, features shipped, working projects', evidence: ['coding sessions', 'working features', 'project milestones'], integration: 'GitHub', planning_strategy: 'progressive programming: fundamentals, small exercises, focused project, debugging, testing and shipping', keywords: ['code', 'coding', 'programming', 'python', 'javascript', 'typescript', 'java', 'c++', 'html', 'css', 'software', 'app development'] },
  { category: 'Technology/Projects', goal_type: 'GitHub Contributions', metric: 'contributions, pull requests, commits', evidence: ['GitHub activity', 'pull requests', 'commits'], integration: 'GitHub', planning_strategy: 'break the project into concrete deliverables and ship incrementally', keywords: ['github', 'commit', 'commits', 'pull request', 'contribution'] },
  { category: 'Communication', goal_type: 'Public Speaking', metric: 'practice sessions, speaking duration, delivery quality', evidence: ['speaking practices', 'recorded rehearsals', 'feedback'], integration: null, planning_strategy: 'progressive speaking: message structure, delivery fundamentals, short rehearsals, audience practice and full presentation', keywords: ['public speaking', 'speaking', 'presentation', 'presenting', 'speech', 'debate'] },
  { category: 'Career/Projects', goal_type: 'Project', metric: 'deliverables, milestones, completion', evidence: ['project milestones', 'completed deliverables', 'project review'], integration: 'Google Calendar', planning_strategy: 'sequence concrete deliverables into weekly execution blocks, review dependencies and ship a complete outcome', keywords: ['portfolio', 'project', 'career', 'cv', 'resume', 'job', 'application', 'internship', 'business', 'startup'] },
  { category: 'Finance', goal_type: 'Saving', metric: 'money saved, savings rate, milestones', evidence: ['manual savings updates', 'transaction records when available', 'milestones'], integration: null, planning_strategy: 'define target and baseline, create realistic saving actions, review progress and adjust', keywords: ['save', 'saving', 'savings', 'money', 'budget', 'financial', 'finance'] },
  { category: 'Mindfulness', goal_type: 'Meditation', metric: 'sessions, duration, consistency', evidence: ['meditation sessions', 'meditation duration'], integration: 'Medito', planning_strategy: 'short repeatable sessions, attention practice, gradual consistency and reflection', keywords: ['meditate', 'meditation', 'mindfulness', 'breathing practice'] },
];

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

export function analyseGoalForEvidence(input: { title?: string | null; outcome?: string | null; why_it_matters?: string | null }): ArmadilloResult {
  const text = [input.title, input.outcome, input.why_it_matters].filter(Boolean).join(' ').trim().toLowerCase();
  const match = rules.find(rule => rule.keywords.some(keyword => text.includes(keyword)));
  const genericSkill = !match && GENERIC_SKILL_KEYWORDS.some(keyword => text.includes(keyword));
  const base = match || (genericSkill ? {
    category: 'Skill Development',
    goal_type: 'Skill Acquisition',
    metric: 'skills mastered, practice sessions, completed applications or projects',
    evidence: ['practice sessions', 'skills completed', 'real-world applications or finished projects'],
    integration: null,
    planning_strategy: 'identify the skill baseline, teach fundamentals, practise progressively, apply the skill and assess against the desired outcome',
    keywords: []
  } : {
    category: 'General',
    goal_type: 'Goal',
    metric: 'measurable progress toward the stated outcome',
    evidence: ['manual progress updates', 'goal milestones', 'completed sessions or actions'],
    integration: null,
    planning_strategy: 'define the clearest measurable outcome, establish a baseline, then break it into progressive repeatable actions',
    keywords: []
  });
  const target = extractTarget(text, base.goal_type);
  const timeTarget = extractTimeTarget(text);
  const vague = /\b(?:get better|improve|do more|be better|get fit|work on|try to)\b/i.test(text);
  const safety = safetyFor(text, base.goal_type);
  // Every goal gets the clarification stage. If the user leaves answers blank,
  // the planner explicitly treats them as a Level 1 beginner baseline.
  const needsClarification = true;
  const reasons = genericSkill || !match || vague || !target
    ? ['Ask 2–3 goal-specific questions to establish starting level, desired outcome and practical constraints. Blank answers mean Level 1 beginner assumptions.']
    : ['Ask 2–3 goal-specific questions to personalise the progression, even when the goal is already measurable.'];
  return {
    category: base.category,
    goal_type: base.goal_type,
    metric: base.metric,
    target,
    direction: directionFor(text),
    secondary_metric: timeTarget ? 'time' : null,
    time_target: timeTarget,
    evidence: base.evidence,
    evidence_source: base.integration ? [base.integration, 'manual tracking'] : ['manual tracking'],
    integration: base.integration,
    planning_strategy: base.planning_strategy,
    needs_clarification: needsClarification,
    clarification_reasons: reasons,
    safety_flag: safety.flag,
    safety_note: safety.note,
    fallback: 'Manual tracking remains the source of truth if an integration is unavailable or not connected.',
    confidence: match ? 0.94 : genericSkill ? 0.82 : 0.55
  };
}
