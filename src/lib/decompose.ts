export interface DecomposedGoal {
  outcome: string;
  deadline: string;
  milestones: { title: string; description: string; weeksOut: number }[];
  weeklyCommitment: number;
  suggestedSessionDuration: number;
}

/**
 * Goal decomposition — MVP version uses heuristic decomposition.
 * In production this would call an LLM with a structured prompt (see docs/ai-prompts.md).
 * The heuristic captures the same structured output shape the AI prompt would return.
 */
export function decomposeGoal(rawInput: string): DecomposedGoal {
  const input = rawInput.trim().toLowerCase();

  // Detect domain and produce concrete outcome + sequenced milestones
  let outcome = rawInput.trim();
  let milestones: { title: string; description: string; weeksOut: number }[] = [];
  let weeklyCommitment = 3;
  let suggestedSessionDuration = 45;

  if (/half marathon|21\\s*km|13\\.?1\\s*miles?/.test(input)) {
    outcome = 'Complete a half marathon';
    milestones = [
      { title: 'Establish a running baseline', description: 'Build a consistent aerobic base and establish a comfortable training rhythm.', weeksOut: 2 },
      { title: 'Build long-run endurance', description: 'Progress weekly distance gradually while keeping recovery sustainable.', weeksOut: 8 },
      { title: 'Complete the half marathon', description: 'Taper appropriately and complete the target 21.1 km distance.', weeksOut: 16 },
    ];
    weeklyCommitment = 4;
    suggestedSessionDuration = 60;
  } else if (/run|running|5k|10k|marathon|couch/.test(input)) {
    outcome = /10k/.test(input) ? 'Complete a 10K run' : /marathon/.test(input) ? 'Complete a marathon' : 'Run a 5K without stopping';
    milestones = [
      { title: 'Run 1 mile without stopping', description: 'Build baseline aerobic capacity with walk-run intervals.', weeksOut: 2 },
      { title: 'Run 2 miles continuously', description: 'Extend endurance to 2 miles at conversational pace.', weeksOut: 4 },
      { title: 'Complete a 5K', description: 'Run the full 5K distance without walk breaks.', weeksOut: 8 },
    ];
    weeklyCommitment = 3;
    suggestedSessionDuration = 40;
  } else if (/write|book|novel|blog|writing/.test(input)) {
    outcome = 'Complete a first draft of your book';
    milestones = [
      { title: 'Outline the full structure', description: 'Write a chapter-by-chapter outline.', weeksOut: 2 },
      { title: 'Draft first 10,000 words', description: 'Write the opening chapters without editing.', weeksOut: 5 },
      { title: 'Complete first draft', description: 'Finish the full manuscript, rough is fine.', weeksOut: 12 },
    ];
    weeklyCommitment = 4;
    suggestedSessionDuration = 60;
  } else if (/code|program|learn.*javascript|learn.*python|developer|coding/.test(input)) {
    outcome = 'Build and ship a working project in your chosen language';
    milestones = [
      { title: 'Complete a fundamentals tutorial', description: 'Work through core syntax and concepts.', weeksOut: 2 },
      { title: 'Build a small practice project', description: 'Apply fundamentals to a tiny real project.', weeksOut: 4 },
      { title: 'Ship a portfolio project', description: 'Complete and deploy a project you can share.', weeksOut: 8 },
    ];
    weeklyCommitment = 4;
    suggestedSessionDuration = 60;
  } else if (/read|reading|books/.test(input)) {
    outcome = 'Read 6 books in the next 3 months';
    milestones = [
      { title: 'Finish book 1', description: 'Complete your first book.', weeksOut: 2 },
      { title: 'Finish book 3', description: 'Build a steady reading habit.', weeksOut: 6 },
      { title: 'Finish book 6', description: 'Reach your reading goal.', weeksOut: 12 },
    ];
    weeklyCommitment = 5;
    suggestedSessionDuration = 30;
  } else if (/meditat|mindful|stress|anxiety|calm/.test(input)) {
    outcome = 'Build a consistent daily meditation practice';
    milestones = [
      { title: 'Meditate 5 minutes daily for 2 weeks', description: 'Establish the habit with short sessions.', weeksOut: 2 },
      { title: 'Meditate 10 minutes daily', description: 'Extend duration once the habit sticks.', weeksOut: 4 },
      { title: '30-day unbroken streak', description: 'Sustain the practice for a full month.', weeksOut: 8 },
    ];
    weeklyCommitment = 7;
    suggestedSessionDuration = 15;
  } else if (/gym|fitness|workout|strength|muscle|lift/.test(input)) {
    outcome = 'Build a consistent 3x/week strength training routine';
    milestones = [
      { title: 'Complete 2 weeks of consistent workouts', description: 'Learn basic movement patterns.', weeksOut: 2 },
      { title: 'Increase weights for 4 weeks', description: 'Progressive overload with tracked lifts.', weeksOut: 6 },
      { title: 'Hit 12 weeks consistent', description: 'Sustained routine with visible progress.', weeksOut: 12 },
    ];
    weeklyCommitment = 3;
    suggestedSessionDuration = 60;
  } else if (/guitar|music|piano|instrument|practice/.test(input)) {
    outcome = 'Play 10 songs confidently on your instrument';
    milestones = [
      { title: 'Learn basic chords/scales', description: 'Master fundamentals.', weeksOut: 2 },
      { title: 'Play 3 simple songs', description: 'Apply fundamentals to real music.', weeksOut: 5 },
      { title: 'Play 10 songs', description: 'Build a comfortable repertoire.', weeksOut: 12 },
    ];
    weeklyCommitment = 4;
    suggestedSessionDuration = 30;
  } else if (/language|spanish|french|japanese|german|learn.*language/.test(input)) {
    outcome = 'Reach conversational ability in your target language';
    milestones = [
      { title: 'Complete beginner course (A1)', description: 'Build basic vocabulary and grammar.', weeksOut: 4 },
      { title: 'Have a 5-minute conversation', description: 'Practice speaking with a tutor or partner.', weeksOut: 8 },
      { title: 'Reach A2 level', description: 'Sustained conversational ability.', weeksOut: 16 },
    ];
    weeklyCommitment = 5;
    suggestedSessionDuration = 30;
  } else {
    // Generic decomposition
    const title = rawInput.trim();
    outcome = title.charAt(0).toUpperCase() + title.slice(1);
    milestones = [
      { title: 'Define what "better" looks like', description: 'Write a specific, measurable outcome for this goal.', weeksOut: 1 },
      { title: 'Take first concrete action', description: 'Complete your first real step toward the outcome.', weeksOut: 3 },
      { title: 'Reach your outcome', description: 'Achieve the specific result you defined.', weeksOut: 8 },
    ];
    weeklyCommitment = 3;
    suggestedSessionDuration = 45;
  }

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + milestones[milestones.length - 1].weeksOut * 7);
  const deadlineStr = deadline.toISOString().split('T')[0];

  return {
    outcome,
    deadline: deadlineStr,
    milestones,
    weeklyCommitment,
    suggestedSessionDuration,
  };
}
