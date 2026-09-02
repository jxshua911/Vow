import { analyseGoalForEvidence } from '@/lib/armadillo';
import type { ArmadilloResult } from '@/lib/armadillo';

export interface DecomposedGoal {
  outcome: string;
  deadline: string;
  milestones: { title: string; description: string; weeksOut: number }[];
  weeklyCommitment: number;
  suggestedSessionDuration: number;
  armadillo: ArmadilloResult;
}

function numericTarget(input: string, unit: string): number | null {
  const match = input.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}`, 'i'));
  return match ? Number(match[1]) : null;
}

export function decomposeGoal(rawInput: string): DecomposedGoal {
  const input = rawInput.trim().toLowerCase();
  let outcome = rawInput.trim();
  let milestones: { title: string; description: string; weeksOut: number }[] = [];
  let weeklyCommitment = 3;
  let suggestedSessionDuration = 45;

  if (/run|running|5k|10k|marathon|jog|walk|walking/.test(input)) {
    const distance = numericTarget(input, '(?:km|k)');
    const monthly = /this month|monthly|per month/.test(input);
    const target = distance ?? (input.includes('marathon') ? 42.2 : 5);
    const label = target === 42.2 ? 'marathon' : `${target}K`;
    outcome = monthly && distance ? `Run ${target} km this month` : `Run a ${label} without stopping`;
    if (monthly && distance) {
      milestones = [
        { title: `Build toward ${Math.round(target * 0.25)} km`, description: 'Establish a sustainable running rhythm and accumulate consistent distance.', weeksOut: 1 },
        { title: `Reach ${Math.round(target * 0.6)} km total`, description: 'Build weekly volume gradually while reviewing how the body and schedule respond.', weeksOut: 3 },
        { title: `Reach ${target} km total`, description: 'Complete the target monthly distance without needing to cram missed volume into a single session.', weeksOut: 4 },
      ];
      weeklyCommitment = 3;
      suggestedSessionDuration = 45;
    } else {
      milestones = [
        { title: 'Establish a comfortable baseline', description: 'Use easy walk-run or continuous running based on your current ability.', weeksOut: 2 },
        { title: `Build toward ${Math.max(1, Math.round(target * 0.6))} km`, description: 'Extend distance gradually while keeping the workload manageable.', weeksOut: 4 },
        { title: `Complete ${label}`, description: `Complete the ${label} target without forcing the pace.`, weeksOut: 8 },
      ];
      weeklyCommitment = 3;
      suggestedSessionDuration = 40;
    }
  } else if (/read|reading|book|books|pages/.test(input)) {
    const pages = numericTarget(input, 'pages?');
    const daily = /every day|daily|a day|per day/.test(input);
    if (pages && daily) {
      outcome = `Read ${pages} pages every day`;
      milestones = [
        { title: `Build a ${Math.max(1, Math.round(pages * 0.5))}-page daily baseline`, description: 'Make the reading block easy enough to establish consistently.', weeksOut: 1 },
        { title: `Reach ${Math.max(1, Math.round(pages * 0.75))} pages per day`, description: 'Increase volume while protecting consistency.', weeksOut: 3 },
        { title: `Sustain ${pages} pages per day`, description: 'Maintain the target and review the habit weekly.', weeksOut: 6 },
      ];
      weeklyCommitment = 7;
      suggestedSessionDuration = 30;
    } else {
      outcome = 'Read 6 books in the next 3 months';
      milestones = [
        { title: 'Finish book 1', description: 'Complete your first book.', weeksOut: 2 },
        { title: 'Finish book 3', description: 'Build a steady reading habit.', weeksOut: 6 },
        { title: 'Finish book 6', description: 'Reach your reading goal.', weeksOut: 12 },
      ];
      weeklyCommitment = 5;
      suggestedSessionDuration = 30;
    }
  } else if (/study|school|exam|physics|chemistry|math|mathematics|revision|homework/.test(input)) {
    const hours = numericTarget(input, 'hours?');
    const daily = /every weekday|every day|daily|a day|per day/.test(input);
    outcome = hours && daily ? `Study for ${hours} hours ${/weekday/.test(input) ? 'every weekday' : 'every day'}` : rawInput.trim();
    milestones = [
      { title: 'Establish the study routine', description: 'Complete consistent focused sessions and identify the highest-value work.', weeksOut: 1 },
      { title: 'Build consistency', description: 'Increase the proportion of planned study sessions completed.', weeksOut: 3 },
      { title: 'Review progress', description: 'Use completed work and results to adjust the next study block.', weeksOut: 6 },
    ];
    weeklyCommitment = daily && /weekday/.test(input) ? 5 : 4;
    suggestedSessionDuration = hours ? Math.max(30, Math.min(120, Math.round(hours * 60))) : 60;
  } else if (/code|program|learn.*javascript|learn.*python|developer|coding/.test(input)) {
    outcome = rawInput.trim();
    milestones = [
      { title: 'Complete the fundamentals', description: 'Work through the core concepts required for the stated project or skill.', weeksOut: 2 },
      { title: 'Build a small practice project', description: 'Apply the fundamentals to a real, small piece of work.', weeksOut: 4 },
      { title: 'Ship a working project', description: 'Complete and share a usable result.', weeksOut: 8 },
    ];
    weeklyCommitment = 4;
    suggestedSessionDuration = 60;
  } else if (/meditat|mindful|stress|anxiety|calm/.test(input)) {
    outcome = rawInput.trim();
    milestones = [
      { title: 'Establish the practice', description: 'Start with short sessions that are easy to repeat.', weeksOut: 2 },
      { title: 'Build consistency', description: 'Increase consistency before increasing duration.', weeksOut: 4 },
      { title: 'Sustain the routine', description: 'Review what makes the practice fit naturally into your day.', weeksOut: 8 },
    ];
    weeklyCommitment = 7;
    suggestedSessionDuration = 15;
  } else if (/gym|fitness|workout|strength|muscle|lift/.test(input)) {
    outcome = rawInput.trim();
    milestones = [
      { title: 'Establish a consistent routine', description: 'Learn and repeat the core movements or sessions required by the goal.', weeksOut: 2 },
      { title: 'Progress the workload', description: 'Increase training demand only when the current workload is handled consistently.', weeksOut: 6 },
      { title: 'Sustain the routine', description: 'Maintain the plan and review progress against the original outcome.', weeksOut: 12 },
    ];
    weeklyCommitment = 3;
    suggestedSessionDuration = 60;
  } else if (/guitar|music|piano|instrument|practice/.test(input)) {
    outcome = rawInput.trim();
    milestones = [
      { title: 'Learn the fundamentals', description: 'Master the basic skills needed for the stated goal.', weeksOut: 2 },
      { title: 'Apply the skills', description: 'Practise through real pieces or exercises.', weeksOut: 5 },
      { title: 'Demonstrate the outcome', description: 'Use a concrete performance or completed piece as the checkpoint.', weeksOut: 12 },
    ];
    weeklyCommitment = 4;
    suggestedSessionDuration = 30;
  } else if (/language|spanish|french|japanese|german|learn.*language/.test(input)) {
    outcome = rawInput.trim();
    milestones = [
      { title: 'Build the foundation', description: 'Develop core vocabulary and grammar for the target language.', weeksOut: 4 },
      { title: 'Use the language actively', description: 'Practise understanding and producing the language in real contexts.', weeksOut: 8 },
      { title: 'Demonstrate progress', description: 'Test the target skill through a conversation, task, or other concrete outcome.', weeksOut: 16 },
    ];
    weeklyCommitment = 5;
    suggestedSessionDuration = 30;
  } else {
    const title = rawInput.trim();
    outcome = title.charAt(0).toUpperCase() + title.slice(1);
    milestones = [
      { title: 'Define the first checkpoint', description: 'Turn the commitment into a specific, measurable first result.', weeksOut: 1 },
      { title: 'Take the first concrete action', description: 'Complete the first real step toward the outcome.', weeksOut: 3 },
      { title: 'Reach the outcome', description: 'Achieve or evaluate the specific result you defined.', weeksOut: 8 },
    ];
    weeklyCommitment = 3;
    suggestedSessionDuration = 45;
  }

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + milestones[milestones.length - 1].weeksOut * 7);

  return {
    outcome,
    deadline: deadline.toISOString().split('T')[0],
    milestones,
    weeklyCommitment,
    suggestedSessionDuration,
    armadillo: analyseGoalForEvidence(rawInput),
  };
}
