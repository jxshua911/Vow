const MAX_ACTIONS = 12;
const MAX_ACTION_DEPTH = 4;
const MAX_ACTION_NODES = 100;
const MAX_CHILDREN = 8;
const MAX_SUBSTEPS = 6;
const MAX_TITLE_LENGTH = 120;
const MAX_INSTRUCTION_LENGTH = 1500;
const MIN_INSTRUCTION_LENGTH = 20;

export function hasMeasurableEvidence(task: string): boolean {
  if (typeof task !== "string" || !task.trim()) return false;
  const value = task.normalize("NFKC").replace(/,/g, "");
  return /(?:^|\s)\d+(?:\.\d+)?\s*%(?=\s|$)/i.test(value)
    || /(?:^|\s)\d+(?:\.\d+)?\s*(?:minutes?|mins?|hours?|hrs?|seconds?|secs?|km|kilomet(?:er|re)s?|miles?|reps?|sets?|pages?|words?|items?|sessions?|days?|weeks?|points?|kg|lb|grams?|g|ml|lit(?:er|re)s?|chapters?|questions?|problems?|customers?|calls?|orders?|questions?|problems?)(?=\s|$)/i.test(value)
    || /\\b(?:RM|USD|EUR|GBP)\\s*\\d+(?:\\.\\d{1,2})?\\b/i.test(value)
    || /\b(?:twice|thrice|once|daily|weekly|monthly|every\s+day|every\s+week)\b/i.test(value)
    || /\b\d+\s*[x×]\s*\d+(?!\s*\d)/i.test(value)
    || /\b(?:complete|finish|submit|attend|pass|achieve|publish|deliver|earn|save|score)\s+(?:the\s+)?(?:[a-z][\w-]*\s+){0,4}(?:chapter|module|course|assignment|exam|milestone|project|application|report|certificate|assessment|draft|prototype)\b/i.test(value);
}

const CATEGORY_ALIASES: Record<string, string> = {
  learning: "study", education: "study", academic: "study",
  money: "financial", finance: "financial", budgeting: "financial",
  career: "business", projects: "business", project: "business", product: "business",
  creative: "skill", music: "skill", cooking: "skill", language: "skill",
  travel: "personal", life_admin: "personal", lifeadmin: "personal",
  organisation: "home", organization: "home", household: "home",
  sport: "fitness", sports: "fitness", exercise: "fitness",
  wellbeing: "health", wellness: "health",
  relationships: "relationship", social: "relationship",
  habits: "mindfulness", mental_wellbeing: "mindfulness",
};

const CATEGORY_SIGNALS: Record<string, RegExp> = {
  fitness: /\b(?:run|walk|cycle|swim|lift|squat|push.?up|pull.?up|plank|workout|training|mobility|stretch|strength|cardio|technique|warm.?up|cool.?down|interval|drill|pace|distance)\b/i,
  study: /\b(?:solve|problem|read|chapter|revise|revision|recall|flashcards?|quiz|test|essay|summari[sz]e|explain|derive|calculate|practice|practise|questions?|notes?|worked example|mark scheme|vocabulary|grammar|concept|formula|lecture|lesson|topic)\b/i,
  financial: /\b(?:budget|save|saving|expense|spend|income|cost|price|money|deposit|transfer|debt|payment|transaction|invest|currency|contribution|balance|quote|purchase|cash.?flow|statement|allocation)\b/i,
  business: /\b(?:customer|client|market|competitor|offer|product|service|sales?|revenue|interview|validate|prototype|launch|distribution|audience|conversion|pitch|outreach|feature|acceptance criteria|deliverable|test case|deploy|ship|pricing|retention)\b/i,
  skill: /\b(?:practice|practise|drill|rehearse|build|create|draw|write|code|debug|compose|perform|record|edit|design|feedback|technique|lesson|draft|recipe|ingredient|chop|simmer|bake|chord|scale|tempo|sketch|prototype|translate|pronounce)\b/i,
  mindfulness: /\b(?:breathe|breathing|meditat\w*|mindful\w*|attention|focus|urge|trigger|reflection|reflect|journal\w*|cue|routine|habit|grounding|body scan|pause|check.?in)\b/i,
  relationship: /\b(?:listen|conversation|communicat\w*|message|call|boundary|respect|empathy|conflict|family|friend|partner|relationship|reconnect|follow.?up|active listening|perspective|discuss)\b/i,
  health: /\b(?:health|wellbeing|wellness|sleep|symptom|appointment|clinician|doctor|professional|hydration|meal|nutrition|recovery|monitor|screening|medical guidance|care plan)\b/i,
  personal: /\b(?:habit|routine|checklist|priority|schedule|plan|reflect|review|prepare|book|booking|document|application|route|itinerary|packing|deadline|reminder|declutter|admin|organise|organize|complete|submit)\b/i,
  home: /\b(?:clean|declutter|organise|organize|sort|repair|laundry|room|kitchen|storage|inventory|donate|recycle|maintenance|supplies|household|label|dispose|put away|vacuum|dust|wash)\b/i,
};

function normalizeCategory(category: string): string {
  const normalized = String(category || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return CATEGORY_ALIASES[normalized] || normalized;
}

export function validateCategorySpecificDetail(
  category: string,
  detailText: string,
  _plannedSessionCount: number,
): string | null {
  const normalized = normalizeCategory(category);
  const signal = CATEGORY_SIGNALS[normalized];
  if (!signal || typeof detailText !== "string" || signal.test(detailText)) return null;
  return "CATEGORY_DETAIL_" + normalized.toUpperCase();
}

function validText(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

export function hasCompleteActionTree(actions: unknown): boolean {
  if (!Array.isArray(actions) || actions.length < 3 || actions.length > MAX_ACTIONS) return false;
  let nodeCount = 0;

  const visit = (value: unknown, depth = 0): boolean => {
    if (!value || typeof value !== "object" || Array.isArray(value) || depth > MAX_ACTION_DEPTH) return false;
    nodeCount += 1;
    if (nodeCount > MAX_ACTION_NODES) return false;

    const action = value as Record<string, unknown>;
    if (!validText(action.title, 3, MAX_TITLE_LENGTH)) return false;
    if (action.instructions != null && !validText(action.instructions, MIN_INSTRUCTION_LENGTH, MAX_INSTRUCTION_LENGTH)) return false;
    if (action.children != null && !Array.isArray(action.children)) return false;
    if (action.substeps != null && !Array.isArray(action.substeps)) return false;

    const children = (action.children ?? []) as unknown[];
    const substeps = (action.substeps ?? []) as unknown[];
    if (children.length > MAX_CHILDREN || substeps.length > MAX_SUBSTEPS) return false;
    if (substeps.some((step) => !validText(step, 5, 300))) return false;

    const rawType = String(action.type ?? action.action_type ?? "").trim().toLowerCase();
    const title = action.title.trim();
    const isRest = rawType === "rest" || rawType === "break" || /^(rest|break)\b/i.test(title);
    if (isRest) {
      if (children.length || substeps.length) return false;
      const rawDuration = action.rest_seconds ?? action.duration_seconds ??
        (typeof action.duration_minutes === "number" ? action.duration_minutes * 60 : null);
      return typeof rawDuration === "number" && Number.isFinite(rawDuration) &&
        rawDuration > 0 && rawDuration <= 86400;
    }

    const isGroup = rawType === "group" || rawType === "category" ||
      (rawType === "" && children.length > 0);
    if (isGroup) {
      if (children.length < 1 || (action.instructions != null && !validText(action.instructions, 12, MAX_INSTRUCTION_LENGTH))) return false;
      return children.every((child) => visit(child, depth + 1));
    }

    if (rawType && !["task", "exercise", "action"].includes(rawType)) return false;
    if (children.length > 0) return false;
    if (!validText(action.instructions, MIN_INSTRUCTION_LENGTH, MAX_INSTRUCTION_LENGTH)) return false;
    if (substeps.length < 2) return false;

    const combined = [title, action.instructions, ...substeps].join(" ").toLowerCase();
    if (/^(?:do this|work on it|make progress|continue|keep going|practice more|practise more)[.! ]*$/i.test(combined.trim())) return false;
    return true;
  };

  return actions.every((action) => visit(action));
}

/**
 * Compatibility helper: never fabricates a successful-looking action tree.
 * Callers receive the original validated tree or an empty array and must treat
 * the latter as a validation failure requiring repair.
 */
export function ensureCompleteActionTree(
  actions: unknown,
  _context: { task: string; purpose?: string; targetMetric?: string; substeps?: string[] },
): Array<Record<string, unknown>> {
  return hasCompleteActionTree(actions)
    ? actions as Array<Record<string, unknown>>
    : [];
}
