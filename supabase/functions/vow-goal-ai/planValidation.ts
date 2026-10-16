export function hasMeasurableEvidence(task: string): boolean {
  return /\b\d+(?:[.,]\d+)?\s*%/i.test(task)
    || /\b\d+(?:[.,]\d+)?\s*(?:minutes?|mins?|hours?|km|miles?|reps?|sets?|pages?|words?|items?|sessions?|days?|seconds?|points?|kg|lb)\b/i.test(task)
    || /\b\d+\s*[x×]\s*\d+/i.test(task);
}

const CATEGORY_ALIASES: Record<string, string> = {
  learning: 'study',
  money: 'financial',
  career: 'business',
  creative: 'skill',
  health: 'fitness',
  personal: 'skill',
};

const CATEGORY_SIGNALS: Record<string, RegExp> = {
  fitness: /\b(run|walk|cycle|swim|lift|squat|push.?up|pull.?up|plank|exercise|workout|training|mobility|stretch|reps?|sets?|pace|distance|form|technique|rest|rounds?)\b/i,
  study: /\b(solve|problem|exercise|read|chapter|revise|revision|recall|flashcards?|quiz|test|essay|summari[sz]e|explain|derive|calculate|practice|practise|questions?|notes?)\b/i,
  financial: /\b(budget|save|saving|expense|spend|income|cost|price|money|account|deposit|transfer|debt|payment|transaction|invest|financial|currency|track)\b/i,
  business: /\b(customer|client|market|competitor|offer|product|service|sales?|revenue|pricing|interview|validate|prototype|launch|distribution|audience|conversion|business|pitch|outreach)\b/i,
  skill: /\b(practice|practise|drill|rehearse|build|create|draw|write|code|debug|compose|perform|record|edit|design|test|feedback|technique|exercise|project|lesson)\b/i,
};

export function validateCategorySpecificDetail(
  category: string,
  detailText: string,
  plannedSessionCount: number,
): string | null {
  const normalized = String(category || '').trim().toLowerCase();
  const signalCategory = CATEGORY_ALIASES[normalized] || normalized;
  const signal = CATEGORY_SIGNALS[signalCategory];
  if (!signal || plannedSessionCount < 3 || signal.test(detailText)) return null;
  return 'CATEGORY_DETAIL_' + normalized.toUpperCase();
}
