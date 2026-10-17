export function hasMeasurableEvidence(task: string): boolean {
  return /\b\d+(?:[.,]\d+)?\s*%/i.test(task)
    || /\b\d+(?:[.,]\d+)?\s*(?:minutes?|mins?|hours?|km|miles?|reps?|sets?|pages?|words?|items?|sessions?|days?|seconds?|points?|kg|lb)\b/i.test(task)
    || /\b\d+\s*[x×]\s*\d+/i.test(task);
}

const CATEGORY_ALIASES: Record<string, string> = {
  learning: 'study',
  education: 'study',
  money: 'financial',
  finance: 'financial',
  career: 'business',
  projects: 'business',
  product: 'business',
  creative: 'skill',
  music: 'skill',
  cooking: 'skill',
  travel: 'personal',
  life_admin: 'personal',
  organisation: 'home',
  organization: 'home',
};

const CATEGORY_SIGNALS: Record<string, RegExp> = {
  fitness: /\b(run|walk|cycle|swim|lift|squat|push.?up|pull.?up|plank|exercise|workout|training|mobility|stretch|reps?|sets?|pace|distance|form|technique|rest|rounds?|warm.?up|cool.?down)\b/i,
  study: /\b(solve|problem|exercise|read|chapter|revise|revision|recall|flashcards?|quiz|test|essay|summari[sz]e|explain|derive|calculate|practice|practise|questions?|notes?|worked example|accuracy|mark scheme|vocabulary|grammar|concept|formula)\b/i,
  financial: /\b(budget|save|saving|expense|spend|income|cost|price|money|account|deposit|transfer|debt|payment|transaction|invest|financial|currency|track|contribution|balance|quote|purchase)\b/i,
  business: /\b(customer|client|market|competitor|offer|product|service|sales?|revenue|interview|validate|prototype|launch|distribution|audience|conversion|business|pitch|outreach|feature|acceptance criteria|deliverable|test case|deploy|ship)\b/i,
  skill: /\b(practice|practise|drill|rehearse|build|create|draw|write|code|debug|compose|perform|record|edit|design|test|feedback|technique|exercise|project|lesson|draft|revision|recipe|ingredient|chop|simmer|bake|chord|scale|tempo|sketch|prototype)\b/i,
  mindfulness: /\b(breathe|breathing|meditat|mindful|attention|focus|urge|trigger|reflection|reflect|journal|journalling|cue|routine|habit|track|check.?in|grounding|body scan|pause)\b/i,
  relationship: /\b(listen|conversation|communicat|ask|message|call|boundary|respect|empathy|feedback|conflict|family|friend|partner|relationship|reconnect|follow.?up|active listening|perspective)\b/i,
  health: /\b(health|wellbeing|wellness|sleep|symptom|appointment|clinician|doctor|professional|hydration|meal|nutrition|mobility|recovery|monitor|log|screening|routine|safe|guidance)\b/i,
  personal: /\b(habit|routine|cue|trigger|track|checklist|priority|schedule|plan|reflect|review|prepare|book|booking|document|application|route|itinerary|packing|deadline|reminder|organise|organize|declutter|admin|practice|practise)\b/i,
  home: /\b(clean|declutter|organise|organize|sort|repair|laundry|room|kitchen|storage|inventory|donate|recycle|maintenance|checklist|supplies|household|organis|label|dispose|put away)\b/i,
  general: /\b(define|identify|research|compare|choose|plan|schedule|create|complete|measure|track|test|review|deliverable|milestone|target|evidence|checkpoint|action|decision|next step)\b/i,
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


export function hasCompleteActionTree(actions: unknown): boolean {
  if (!Array.isArray(actions) || actions.length < 3 || actions.length > 6) return false;

  // The action shape is deliberately domain-neutral. Sets/reps and durations
  // are optional metadata, not universal requirements for every kind of goal.
  return actions.every((value) => {
    if (!value || typeof value !== "object") return false;
    const action = value as Record<string, unknown>;
    const title = typeof action.title === "string" && action.title.trim().length >= 2;
    const instructions = typeof action.instructions === "string" && action.instructions.trim().length >= 8;
    const substeps = Array.isArray(action.substeps)
      && action.substeps.length >= 2
      && action.substeps.length <= 5
      && action.substeps.every((step) => typeof step === "string" && step.trim().length >= 3);
    const sets = Number.isFinite(Number(action.sets)) && Number(action.sets) > 0;
    const reps = (typeof action.reps === "string" && action.reps.trim().length > 0)
      || (Number.isFinite(Number(action.reps)) && Number(action.reps) > 0);
    const duration = Number.isFinite(Number(action.duration_minutes)) && Number(action.duration_minutes) > 0;
    const rest = Number.isFinite(Number(action.rest_seconds)) && Number(action.rest_seconds) >= 0;
    // Require executable detail in the instructions/substeps. Domain-specific
    // measurement can be reps, duration, a count, a deliverable, or evidence.
    // Numeric exercise fields are accepted when relevant but never mandatory.
    return title && instructions && substeps && (
      (sets && reps) || duration || instructions
    ) && (!rest || sets || reps || duration || instructions);
  });
}
