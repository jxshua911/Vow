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
  if (!Array.isArray(actions) || actions.length < 3 || actions.length > 12) return false;

  // Validate a domain-neutral, recursive tree. Group headings may contain
  // children; executable leaves need actionable instructions and a concrete
  // ordered breakdown, without forcing fitness-only fields onto other goals.
  const visit = (value: unknown, depth = 0): boolean => {
    if (!value || typeof value !== "object" || depth > 5) return false;
    const action = value as Record<string, unknown>;
    if (typeof action.title !== "string" || action.title.trim().length < 2) return false;
    if (action.instructions != null && (typeof action.instructions !== "string" || action.instructions.trim().length < 8)) return false;

    const children = Array.isArray(action.children) ? action.children : [];
    const substeps = Array.isArray(action.substeps) ? action.substeps : [];
    if (children.length > 12 || substeps.length > 8) return false;
    if (substeps.some((step) => typeof step !== "string" || step.trim().length < 3)) return false;
    const actionType = String(action.type ?? action.action_type ?? "").trim().toLowerCase();
    const isRest = actionType === "rest" || actionType === "break" || /^(rest|break)\b/i.test(action.title);
    if (isRest) {
      const rawDuration = action.rest_seconds ?? action.duration_seconds ??
        (action.duration_minutes == null ? null : Number(action.duration_minutes) * 60);
      const seconds = Number(rawDuration);
      return rawDuration != null && Number.isFinite(seconds) && seconds > 0;
    }
    if (children.length > 0) {
      return children.every((child) => visit(child, depth + 1));
    }
    return typeof action.instructions === "string"
      && action.instructions.trim().length >= 8
      && (substeps.length >= 2 || depth > 0);
  };

  return actions.every((action) => visit(action));
}


/**
 * Preserve model-provided action trees when they pass validation. If a provider
 * omits or truncates the tree, derive a small, domain-neutral execution outline
 * from the session's own task, purpose, target metric and supplied substeps.
 * This is a formatting fallback, not a substitute for plan-level quality checks.
 */
export function ensureCompleteActionTree(
  actions: unknown,
  context: { task: string; purpose?: string; targetMetric?: string; substeps?: string[] },
): Array<Record<string, unknown>> {
  if (hasCompleteActionTree(actions)) return actions as Array<Record<string, unknown>>;

  const task = String(context.task || "the planned task").trim().slice(0, 140) || "the planned task";
  const purpose = String(context.purpose || "make measurable progress toward the goal").trim().slice(0, 220);
  const metric = String(context.targetMetric || "the session's stated target").trim().slice(0, 160);
  const suppliedSteps = Array.isArray(context.substeps)
    ? context.substeps.map((step) => String(step || "").trim()).filter((step) => step.length >= 3).slice(0, 8)
    : [];
  const workSteps = suppliedSteps.length >= 2
    ? suppliedSteps.slice(0, 2)
    : ["Complete the main part of the task in a focused block.", `Check the result against: ${metric}`];

  return [
    {
      type: "task",
      title: `Prepare: ${task}`.slice(0, 160),
      instructions: `Prepare to work on ${task}. Keep the purpose in view: ${purpose}`.slice(0, 500),
      substeps: [`Review the session target: ${metric}`, "Gather the materials or references needed for this task."],
    },
    {
      type: "task",
      title: `Do: ${task}`.slice(0, 160),
      instructions: `Work through ${task} in a manageable block, aiming toward: ${metric}`.slice(0, 500),
      substeps: workSteps,
    },
    {
      type: "task",
      title: `Review: ${task}`.slice(0, 160),
      instructions: `Record what you completed for ${task} and compare it with: ${metric}`.slice(0, 500),
      substeps: ["Record the result or evidence of completion.", "Choose one adjustment for the next session."],
    },
  ];
}
