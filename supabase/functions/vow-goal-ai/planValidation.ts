const MAX_ACTIONS = 12;
const MAX_ACTION_DEPTH = 4;
const MAX_ACTION_NODES = 100;
const MAX_CHILDREN = 8;
const MAX_SUBSTEPS = 6;
const MAX_TITLE_LENGTH = 120;
const MAX_INSTRUCTION_LENGTH = 1500;
const MIN_INSTRUCTION_LENGTH = 20;
const MIN_EXECUTABLE_ACTIONS = 3;

const MEASURE_UNITS =
  "(?:minutes?|mins?|hours?|hrs?|seconds?|secs?|km|kilomet(?:er|re)s?|miles?|reps?|sets?|pages?|words?|items?|sessions?|days?|weeks?|months?|points?|kg|lbs?|grams?|g|ml|millilit(?:er|re)s?|lit(?:er|re)s?|chapters?|questions?|problems?|customers?|calls?|orders?|lessons?|visits?|kilograms?)";

export function hasMeasurableEvidence(task: string): boolean {
  if (typeof task !== "string" || !task.trim()) return false;
  const value = task.normalize("NFKC").replace(/,/g, "");
  const hasSetsAndReps = [...value.matchAll(/\b\d{1,2}\s*[x×]\s*\d{1,3}(?!\d)/gi)].length > 0;
  const hasUnit = new RegExp(
    "(?:^|\\s)\\d+(?:\\.\\d+)?\\s*" + MEASURE_UNITS + "(?=\\s|$)",
    "i",
  ).test(value);
  const hasCurrency = /(?:\b(?:RM|MYR|USD|EUR|GBP|SGD|TZS|KES)\s*\d+(?:\.\d{1,2})?\b|[$€£]\s*\d+(?:\.\d{1,2})?)/i.test(value);
  const hasFrequency = /\b(?:once|twice|thrice|daily|weekly|monthly|every\s+(?:day|week|month)|\d+\s+times?\s+(?:a|per)\s+(?:day|week|month))\b/i.test(value);
  const hasCountedWork = /\b(?:complete|finish|submit|attend|pass|achieve|publish|deliver|earn|save|score|answer|solve|read|write|call|contact|interview)\s+(?:the\s+)?\d+\b/i.test(value);

  const hasNamedDeliverable = /\b(?:complete|finish|submit|attend|pass|achieve|publish|deliver|earn|save|score)\s+(?:the\s+)?(?:[a-z][\w-]*\s+){0,4}(?:chapter|module|course|assignment|exam|milestone|project|application|report|certificate|assessment|draft|prototype|portfolio|presentation|lesson)\b/i.test(value);
  return /(?:^|\s)\d+(?:\.\d+)?\s*%(?=\s|$)/i.test(value)
    || hasUnit
    || hasCurrency
    || hasFrequency
    || hasCountedWork
    || hasSetsAndReps
    || hasNamedDeliverable;
}

const CATEGORY_ALIASES: Record<string, string> = {
  learning: "study", education: "study", academic: "study", reading: "study",
  money: "financial", finance: "financial", budgeting: "financial",
  career: "business", career_projects: "business", technology_projects: "business", projects: "business", project: "business", product: "business",
  creative: "skill", music: "skill", cooking: "skill", language: "skill", languages: "skill", crafts: "skill", crafts_hobbies: "skill", creative_skills: "skill", practical_skills: "skill",
  travel: "personal", personal_development: "personal", productivity: "personal", life_admin: "personal", lifeadmin: "personal",
  organisation: "home", organization: "home", household: "home",
  sport: "fitness", sports: "fitness", exercise: "fitness",
  wellbeing: "health", wellness: "health",
  relationships: "relationship", social: "relationship", communication: "relationship",
  habits: "mindfulness", mental_wellbeing: "mindfulness",
  technology: "business", productivity: "personal",
};

const CATEGORY_SIGNALS: Record<string, RegExp> = {
  fitness: /\b(?:run|walk|cycle|swim|lift|squat|push.?up|pull.?up|plank|workout|training|mobility|stretch|strength|cardio|technique|warm.?up|cool.?down|interval|drill|pace|distance|exercise|recovery|rowing|rowing machine|sport|football|sailing|tennis|basketball)\b/i,
  study: /\b(?:solve|problem|read|chapter|revise|revision|recall|flashcards?|quiz|test|essay|summari[sz]e|explain|derive|calculate|practice|practise|questions?|notes?|worked example|mark scheme|vocabulary|grammar|concept|formula|lecture|lesson|topic|exam|course|textbook|comprehension)\b/i,
  financial: /\b(?:budget|save|saving|expense|spend|income|cost|price|money|deposit|transfer|debt|payment|transaction|invest|currency|contribution|balance|quote|purchase|cash.?flow|statement|allocation|bank|interest|repayment|subscription|savings)\b/i,
  business: /\b(?:customer|client|market|competitor|offer|product|service|sales?|revenue|interview|validate|prototype|launch|distribution|audience|conversion|pitch|outreach|feature|acceptance criteria|deliverable|test case|deploy|ship|pricing|retention|user research|roadmap|release|business model|customer support)\b/i,
  skill: /\b(?:practice|practise|drill|rehearse|build|create|draw|write|code|debug|compose|perform|record|edit|design|feedback|technique|lesson|draft|recipe|ingredient|chop|simmer|bake|chord|scale|tempo|sketch|prototype|translate|pronounce|instrument|painting|illustration|sew|craft|photograph|camera|edit|mix|arrange)\b/i,
  mindfulness: /\b(?:breathe|breathing|meditat\w*|mindful\w*|attention|focus|urge|trigger|reflection|reflect|journal\w*|cue|routine|habit|grounding|body scan|pause|check.?in|gratitude|thought record|relaxation)\b/i,
  relationship: /\b(?:listen|conversation|communicat\w*|message|call|boundary|respect|empathy|conflict|family|friend|partner|relationship|reconnect|follow.?up|active listening|perspective|discuss|ask|respond|apolog|collaborat)\b/i,
  health: /\b(?:health|wellbeing|wellness|sleep|symptom|appointment|clinician|doctor|professional|hydration|meal|nutrition|recovery|monitor|screening|medical guidance|care plan|medication|physio|therapy|checkup)\b/i,
  personal: /\b(?:habit|routine|checklist|priority|schedule|plan|reflect|review|prepare|book|booking|document|application|route|itinerary|packing|deadline|reminder|declutter|admin|organise|organize|complete|submit|calendar|appointment|travel|passport|visa|reservation)\b/i,
  home: /\b(?:clean|declutter|organise|organize|sort|repair|laundry|room|kitchen|storage|inventory|donate|recycle|maintenance|supplies|household|label|dispose|put away|vacuum|dust|wash|shelf|wardrobe|cabinet|appliance)\b/i,
};

function normalizeCategory(category: string): string {
  const normalized = String(category || "").trim().toLowerCase().replace(/[\s/-]+/g, "_");
  return CATEGORY_ALIASES[normalized] || normalized;
}

export function validateCategorySpecificDetail(
  category: string,
  detailText: string,
  _plannedSessionCount: number,
): string | null {
  const normalized = normalizeCategory(category);
  const signal = CATEGORY_SIGNALS[normalized];
  if (!signal || typeof detailText !== "string" || !detailText.trim()) return null;
  return signal.test(detailText) ? null : "CATEGORY_DETAIL_" + normalized.toUpperCase();
}

function validText(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

export function hasCompleteActionTree(actions: unknown): boolean {
  if (!Array.isArray(actions) || actions.length < 3 || actions.length > MAX_ACTIONS) return false;
  let nodeCount = 0;
  let executableCount = 0;

  const visit = (value: unknown, depth = 0): boolean => {
    if (!value || typeof value !== "object" || Array.isArray(value) || depth > MAX_ACTION_DEPTH) return false;
    nodeCount += 1;
    if (nodeCount > MAX_ACTION_NODES) return false;

    const action = value as Record<string, unknown>;
    if (!validText(action.title, 3, MAX_TITLE_LENGTH)) return false;
    if (action.instructions != null && (typeof action.instructions !== "string" || action.instructions.length > MAX_INSTRUCTION_LENGTH)) return false;
    if (action.children != null && !Array.isArray(action.children)) return false;
    if (action.substeps != null && !Array.isArray(action.substeps)) return false;

    const children = (action.children ?? []) as unknown[];
    const substeps = (action.substeps ?? []) as unknown[];
    if (children.length > MAX_CHILDREN || substeps.length > MAX_SUBSTEPS) return false;
    if (substeps.some((step) => !validText(step, 5, 300))) return false;

    const rawType = String(action.type ?? action.action_type ?? "").trim().toLowerCase();
    const title = action.title.trim();
    const genericActionText = /^(?:do (?:this|the task)|work on (?:it|this|the goal)|make progress(?: on (?:it|the goal))?|continue(?: working)?|keep going|practice more|practise more|review your goal|study more|learn more)[.! ]*$/i;
    if (genericActionText.test(title)) return false;
    const isRest = rawType === "rest" || rawType === "break" || /^(rest|break)\b/i.test(title);
    if (isRest) {
      if (children.length || substeps.length) return false;
      if (action.instructions != null && action.instructions !== "" && !validText(action.instructions, 8, MAX_INSTRUCTION_LENGTH)) return false;
      const rawDuration = action.rest_seconds ?? action.duration_seconds ??
        (typeof action.duration_minutes === "number" ? action.duration_minutes * 60 : null);
      return typeof rawDuration === "number" && Number.isFinite(rawDuration) &&
        rawDuration > 0 && rawDuration <= 86400;
    }

    const isGroup = rawType === "group" || rawType === "category" ||
      (rawType === "" && children.length > 0);
    if (isGroup) {
      if (children.length < 1 || substeps.length > 0) return false;
      if (action.instructions != null && action.instructions !== "" && !validText(action.instructions, 12, MAX_INSTRUCTION_LENGTH)) return false;
      return children.every((child) => visit(child, depth + 1));
    }

    if (rawType && !["task", "exercise", "action"].includes(rawType)) return false;
    if (children.length > 0) return false;
    if (!validText(action.instructions, MIN_INSTRUCTION_LENGTH, MAX_INSTRUCTION_LENGTH)) return false;
    if (genericActionText.test(action.instructions.trim())) return false;
    if (substeps.length < 2) return false;

    executableCount += 1;
    return true;
  };

  const valid = actions.every((action) => visit(action));
  return valid && executableCount >= MIN_EXECUTABLE_ACTIONS;
}

/**
 * Compatibility helper retained for any existing imports. It deliberately
 * returns no placeholder actions for invalid model output.
 */
export function ensureCompleteActionTree(
  actions: unknown,
  _context: { task: string; purpose?: string; targetMetric?: string; substeps?: string[] },
): Array<Record<string, unknown>> {
  return hasCompleteActionTree(actions) ? actions as Array<Record<string, unknown>> : [];
}
