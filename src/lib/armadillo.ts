export type ArmadilloResult = {
  category: string;
  goal_type: string;
  metric: string;
  evidence: string[];
  integration: string | null;
  fallback: string;
  confidence: number;
  methodology: string;
  required_inputs: string[];
};

const rules = [
  {
    category: 'Sports',
    goal_type: 'Running',
    metric: 'distance, pace, time',
    evidence: ['activity distance', 'activity pace', 'activity time'],
    integration: 'Strava',
    methodology: 'Build running volume gradually, establish a measurable baseline, then progress pace or distance through structured sessions and recovery.',
    required_inputs: ['current running baseline', 'target distance or time', 'available training days'],
    keywords: ['run', 'running', '5k', '10k', 'marathon', 'half marathon', 'mile', 'km', 'xc', 'cross country'],
  },
  {
    category: 'Sports',
    goal_type: 'Cycling',
    metric: 'distance, duration',
    evidence: ['ride distance', 'ride duration'],
    integration: 'Strava',
    methodology: 'Establish current riding volume and pace, then progress duration or distance with purposeful sessions and recovery.',
    required_inputs: ['current cycling baseline', 'target distance or time', 'available training days'],
    keywords: ['cycle', 'cycling', 'bike', 'biking', 'ride', 'kilometre'],
  },
  {
    category: 'Sports',
    goal_type: 'Football',
    metric: 'sessions, minutes, performance',
    evidence: ['training sessions', 'match activity', 'manual performance notes'],
    integration: 'Strava',
    methodology: 'Combine technical practice, position-specific work, conditioning, and match exposure while tracking consistent performance indicators.',
    required_inputs: ['position or role', 'current performance level', 'available training days'],
    keywords: ['football', 'soccer', 'match', 'football training'],
  },
  {
    category: 'Languages',
    goal_type: 'Language Learning',
    metric: 'vocabulary, comprehension, speaking, practice time',
    evidence: ['language practice sessions', 'vocabulary progress', 'speaking practice'],
    integration: 'Google Calendar',
    methodology: 'Establish a baseline, build useful vocabulary and grammar, practise comprehension and speaking, then increase real-world exposure.',
    required_inputs: ['target language', 'current level', 'target outcome or deadline'],
    keywords: ['spanish', 'french', 'japanese', 'german', 'swahili', 'italian', 'portuguese', 'mandarin', 'language'],
  },
  {
    category: 'Crafts/Hobbies',
    goal_type: 'Craft or Hobby',
    metric: 'practice sessions, completed projects, demonstrated skill',
    evidence: ['practice sessions', 'completed projects', 'manual progress updates'],
    integration: null,
    methodology: 'Identify the skill level and desired finished outcome, learn the core techniques, practise deliberately, and build progressively harder projects.',
    required_inputs: ['specific skill or craft', 'current level', 'target project or outcome'],
    keywords: ['knit', 'knitting', 'crochet', 'sew', 'sewing', 'embroidery', 'woodwork', 'woodworking', 'pottery', 'draw', 'drawing', 'paint', 'painting', 'craft'],
  },
  {
    category: 'Education',
    goal_type: 'Study',
    metric: 'study time, task completion, accuracy',
    evidence: ['study sessions', 'completed tasks', 'practice results'],
    integration: 'Google Calendar',
    methodology: 'Turn the outcome into specific study tasks, schedule focused sessions, use retrieval or practice, and review measurable progress.',
    required_inputs: ['subject or skill', 'current level', 'target outcome or deadline'],
    keywords: ['study', 'revise', 'revision', 'exam', 'homework', 'physics', 'chemistry', 'biology', 'maths', 'mathematics', 'school', 'coursework', 'assignment'],
  },
  {
    category: 'Reading',
    goal_type: 'Reading',
    metric: 'pages, books, reading time',
    evidence: ['pages read', 'books completed', 'reading sessions'],
    integration: null,
    methodology: 'Define the reading outcome, set a sustainable cadence, and track pages, sessions, or completed books against the commitment.',
    required_inputs: ['book or reading topic', 'target amount', 'available reading time'],
    keywords: ['read', 'reading', 'book', 'books', 'pages'],
  },
  {
    category: 'Mindfulness',
    goal_type: 'Meditation',
    metric: 'sessions, duration',
    evidence: ['meditation sessions', 'meditation duration'],
    integration: 'Medito',
    methodology: 'Build a consistent mindfulness habit with a realistic session length, frequency, and gradual progression.',
    required_inputs: ['preferred practice type', 'current consistency', 'target frequency'],
    keywords: ['meditate', 'meditation', 'mindfulness'],
  },
  {
    category: 'Technology/Projects',
    goal_type: 'GitHub Contributions',
    metric: 'contributions, pull requests, commits',
    evidence: ['GitHub activity'],
    integration: 'GitHub',
    methodology: 'Translate the project outcome into concrete deliverables, milestones, and reviewable implementation work, then track shipped progress.',
    required_inputs: ['project outcome', 'current project state', 'target deliverables'],
    keywords: ['github', 'commit', 'commits', 'pull request', 'contribution', 'coding project'],
  },
  {
    category: 'Career/Projects',
    goal_type: 'Project',
    metric: 'deliverables, milestones, completion',
    evidence: ['project milestones', 'completed deliverables', 'project review'],
    integration: 'Google Calendar',
    methodology: 'Define the finished outcome, break it into deliverables and milestones, schedule focused work, and review progress against the intended result.',
    required_inputs: ['project outcome', 'current project state', 'target deliverables or deadline'],
    keywords: ['portfolio', 'project', 'career', 'cv', 'resume', 'job', 'application', 'internship'],
  },
];

export function analyseGoalForEvidence(input: {
  title?: string | null;
  outcome?: string | null;
  why_it_matters?: string | null;
}): ArmadilloResult {
  const text = [input.title, input.outcome, input.why_it_matters].filter(Boolean).join(' ').toLowerCase();
  const ambiguousAbbreviation = /\bim\b/.test(text) && !/ironman|iron man/.test(text);
  if (ambiguousAbbreviation)
    return {
      category: 'General',
      goal_type: 'Needs clarification',
      metric: 'goal-specific progress',
      evidence: ['user clarification', 'manual progress updates', 'goal milestones'],
      integration: null,
      fallback: 'The abbreviation “IM” is ambiguous. VOW should ask what the user means before selecting a specialist methodology.',
      confidence: 0.2,
      methodology: 'Clarify the intended goal meaning before choosing a domain-specific methodology.',
      required_inputs: ['what “IM” means in this goal'],
    };

  const match = rules.find(rule => rule.keywords.some(keyword => text.includes(keyword)));


  if (!match)
    return {
      category: 'General',
      goal_type: 'Goal',
      metric: 'measurable progress toward the stated outcome',
      evidence: ['manual progress updates', 'goal milestones', 'completed sessions or actions'],
      integration: null,
      fallback: 'Manual tracking remains the source of truth until a relevant evidence source is connected.',
      confidence: 0.55,
      methodology: 'Define the desired outcome, establish a measurable baseline, break the work into milestones, schedule realistic actions, and review progress regularly.',
      required_inputs: ['specific desired outcome', 'current baseline', 'deadline or target timeframe'],
    };

  return {
    category: match.category,
    goal_type: match.goal_type,
    metric: match.metric,
    evidence: match.evidence,
    integration: match.integration,
    fallback: 'Manual tracking remains fully usable if the suggested integration is not connected.',
    confidence: 0.9,
    methodology: match.methodology,
    required_inputs: match.required_inputs,
  };
}
