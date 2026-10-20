export const CLARIFICATION_SKIP = '__VOW_SKIP_USE_ASSUMPTION__';

/** Remove follow-up questions whose answers are already explicit in the planner form. */
export function removeQuestionsAnsweredByPlanner(questions: string[]): string[] {
  const knownInForm = [
    /\b(?:what|which)\s+days\b/i,
    /\b(?:how many|number of)\s+(?:days|sessions)\b.{0,45}\b(?:week|weekly|available|commit|schedule|train|practice|study)\b/i,
    /\b(?:available|availability)\b.{0,35}\b(?:days|schedule|sessions per week)\b/i,
    /\b(?:how long|what duration|duration of|number of weeks|timeframe|time frame)\b.{0,45}\b(?:commit|plan|goal|week|long)\b/i,
    /\b(?:what|which)\s+time\b.{0,35}\b(?:session|train|practice|study|workout)\b/i,
    /\b(?:schedule|scheduling)\b.{0,35}\b(?:days|times|availability)\b/i,
  ];
  const seen = new Set<string>();
  return questions
    .filter((question) => typeof question === 'string' && question.trim())
    .map((question) => question.trim())
    .filter((question) => !knownInForm.some((pattern) => pattern.test(question)))
    .filter((question) => {
      const key = normalizeClarificationQuestion(question);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

export function normalizeClarificationQuestion(question: string): string {
  const synonyms: Record<string, string> = {
    currently: 'current',
    level: 'experience',
    ability: 'experience',
    background: 'experience',
    schedule: 'availability',
    available: 'availability',
    days: 'day',
    goals: 'goal',
  };
  return question.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !['what', 'which', 'would', 'could', 'your', 'you', 'the', 'for', 'with', 'about', 'does', 'have', 'are', 'can'].includes(word))
    .map((word) => synonyms[word] || word)
    .sort()
    .join(' ');
}

export function reuseClarificationAnswers(
  questions: string[],
  previous: Record<string, string>,
): string[] {
  const entries = Object.entries(previous)
    .map(([question, answer]) => ({ key: normalizeClarificationQuestion(question), answer }))
    .filter((entry) => entry.key && entry.answer.trim() && entry.answer !== CLARIFICATION_SKIP);

  return questions.map((question) => {
    const key = normalizeClarificationQuestion(question);
    const exact = entries.find((entry) => entry.key === key);
    if (exact) return exact.answer;
    const tokens = new Set(key.split(' '));
    const best = entries
      .map((entry) => {
        const other = entry.key.split(' ');
        const overlap = other.filter((word) => tokens.has(word)).length;
        return { ...entry, score: overlap / Math.max(1, new Set([...tokens, ...other]).size) };
      })
      .sort((a, b) => b.score - a.score)[0];
    return best && best.score >= 0.45 ? best.answer : '';
  });
}

export function answerForPlanning(value: string | null | undefined): string {
  const answer = String(value ?? '').trim();
  if (!answer || answer === CLARIFICATION_SKIP) {
    return 'USER_SKIPPED — make a reasonable, clearly labelled and adjustable assumption; do not ask this again unless the plan cannot be safely built without it.';
  }
  return answer;
}

export function rememberClarificationAnswers(
  previous: Record<string, string>,
  questions: string[],
  answers: string[],
): Record<string, string> {
  const next = { ...previous };
  questions.forEach((question, index) => {
    const answer = String(answers[index] ?? '').trim();
    if (answer && answer !== CLARIFICATION_SKIP) next[question] = answer;
  });
  return next;
}
