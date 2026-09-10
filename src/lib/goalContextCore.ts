export type GoalDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface GoalAnswerLike {
  answer?: string | null;
  question?: string;
  question_order?: number;
}

export function inferGoalDifficulty(answers: GoalAnswerLike[]): GoalDifficulty {
  const answered = answers.filter((answer) => Boolean(answer.answer?.trim()));
  const text = answered.map((answer) => answer.answer?.toLowerCase() ?? '').join(' ');
  if (/beginner|new to|never|starting|no experience|first time/.test(text)) return 'beginner';
  if (/advanced|expert|years of experience|experienced|competitive/.test(text)) return 'advanced';
  if (/intermediate|some experience|familiar|already/.test(text)) return 'intermediate';
  return answered.length >= 2 ? 'intermediate' : 'beginner';
}

export function unansweredQuestions(answers: GoalAnswerLike[]): string[] {
  return answers
    .filter((answer) => !answer.answer?.trim())
    .sort((a, b) => (a.question_order ?? 0) - (b.question_order ?? 0))
    .map((answer) => answer.question || '')
    .filter(Boolean);
}

export function normaliseAnswers(answers: GoalAnswerLike[]) {
  return answers
    .slice()
    .sort((a, b) => (a.question_order ?? 0) - (b.question_order ?? 0))
    .map((answer, index) => ({
      question: answer.question || '',
      answer: answer.answer ?? null,
      question_order: answer.question_order ?? index,
    }))
    .filter((answer) => answer.question);
}
