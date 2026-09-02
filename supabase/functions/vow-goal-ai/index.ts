import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const clarificationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
    recommended_duration_weeks: { type: "integer", minimum: 2, maximum: 52 },
    rationale: { type: "string" },
  },
  required: ["questions", "recommended_duration_weeks", "rationale"],
};

const planItemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    week: { type: "integer", minimum: 1, maximum: 52 },
    day: { type: "string" },
    task: { type: "string" },
    purpose: { type: "string" },
    target_metric: { type: "string" },
    duration_minutes: { type: "integer", minimum: 5, maximum: 480 },
    preferred_time: { type: "string" },
  },
  required: ["week", "day", "task", "purpose", "target_metric", "duration_minutes", "preferred_time"],
};

const planSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    outcome: { type: "string" },
    success_metric: { type: "string" },
    baseline: { type: "string" },
    assumptions: { type: "array", items: { type: "string" }, maxItems: 12 },
    milestones: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { title: { type: "string" }, description: { type: "string" }, week: { type: "integer", minimum: 1, maximum: 52 } },
        required: ["title", "description", "week"],
      },
      minItems: 2,
      maxItems: 12,
    },
    schedule: { type: "array", items: planItemSchema, minItems: 1, maxItems: 364 },
    progression: { type: "string" },
    checkpoints: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 12 },
    risks: { type: "array", items: { type: "string" }, maxItems: 8 },
    fallback_rules: { type: "array", items: { type: "string" }, maxItems: 8 },
    summary: { type: "string" },
  },
  required: ["outcome", "success_metric", "baseline", "assumptions", "milestones", "schedule", "progression", "checkpoints", "risks", "fallback_rules", "summary"],
};

const baseInstructions = `You are VOW AI, a rigorous goal-planning and accountability assistant. Design an executable plan for the user's actual goal, not motivational filler.

The goal may be anything: fitness, learning, finance, study, career, creative work, habits, projects or another measurable commitment. Tailor the questions and plan to the goal domain.

Never use generic filler such as "Day 1", "Day 2", "stay consistent", "break it into smaller steps", "set SMART goals", or vague motivational advice as the substance of a plan. Every action must be specific and measurable where measurement makes sense.

Use the user's baseline, constraints, answers, available days, preferred times, horizon, calendar conflicts and references. If information is missing, make explicit assumptions instead of pretending to know. If the user has not supplied a day/time preference, choose sensible defaults that can be edited before confirmation.

Use web research when current, specialised, empirical or time-sensitive information materially improves the plan. Prefer authoritative or primary sources and use the returned research as evidence. Do not invent sources, benchmarks or claims. For health/fitness plans, be conservative and do not diagnose or prescribe treatment.

For the final plan, schedule EVERY actionable session/task across EVERY week of the selected horizon. Use real weekday names, never numbered generic days. Respect the user's available days. Vary tasks and progression according to the domain. Each schedule item must be independently usable as a calendar event and include a concrete target metric.

Progression must explain what changes week over week and why. Checkpoints must say what gets measured and when. Fallback rules must say what to do when a task is missed or progress is behind. Keep the plan practical rather than bloated.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const payload = await req.json();
    const goal = payload?.goal;
    const message = typeof payload?.message === "string" ? payload.message.trim() : "";
    const calendar = Array.isArray(payload?.calendar) ? payload.calendar : [];
    const references = Array.isArray(payload?.references) ? payload.references : [];
    const scope = typeof payload?.scope === "string" ? payload.scope : "goal-planning";
    const mode = payload?.mode === "goal-clarify" || payload?.mode === "goal-plan" ? payload.mode : "chat";
    if (!goal || !message) return json({ error: "A goal and request are required." }, 400);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "VOW AI is temporarily unavailable. AI service configuration is incomplete." }, 503);

    let instructions = `${baseInstructions}\nScope: ${scope}`;
    const input = [
      `Goal/context: ${JSON.stringify(goal)}`,
      `Upcoming calendar: ${JSON.stringify(calendar)}`,
      `Attached goal references: ${JSON.stringify(references)}`,
      `User request: ${message}`,
    ].join("\n\n");
    let textFormat: Record<string, unknown> | undefined;

    if (mode === "goal-clarify") {
      instructions += `\n\nCLARIFICATION STAGE: Ask 3–6 high-value questions tailored to this exact goal. Prioritise the variables that materially change the plan: baseline/current level, measurable target, deadline, constraints, resources, and days/times available. Do not ask for information already supplied. Questions must be easy to answer and safe to skip. Recommend a sensible duration in weeks and explain the reasoning briefly. Do not generate the final plan yet.`;
      textFormat = { type: "json_schema", name: "vow_goal_clarification", strict: true, schema: clarificationSchema };
    } else if (mode === "goal-plan") {
      instructions += `\n\nPLAN STAGE: The user has answered the tailored questions. Generate the complete executable plan now. The schedule MUST contain one item for every planned action/session on every applicable week, not merely a reusable weekly template. If the horizon is 12 weeks and the user has 3 available days, the schedule should normally contain roughly 36 concrete entries. Do not invent unavailable days. If a task is a non-recurring milestone/checkpoint, schedule it on an appropriate available day. Use preferred times when supplied; otherwise choose a sensible default and make that explicit in preferred_time. Include target_metric for every schedule item.`;
      textFormat = { type: "json_schema", name: "vow_goal_plan", strict: true, schema: planSchema };
    } else {
      instructions += `\n\nFor normal questions, answer directly with useful, goal-specific reasoning and concrete actions.`;
    }

    const requestBody: Record<string, unknown> = {
      model: "gpt-5.6-luna",
      instructions,
      input,
      tools: [{ type: "web_search" }],
    };
    if (textFormat) requestBody.text = { format: textFormat, verbosity: "medium" };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI request failed", response.status, data?.error?.code || "unknown");
      return json({ error: "VOW AI could not complete that request right now. Please try again." }, 502);
    }

    const text = typeof data?.output_text === "string"
      ? data.output_text.trim()
      : Array.isArray(data?.output)
        ? data.output.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || []).map((part: { text?: string }) => part.text || "").join(" ").trim()
        : "";
    if (!text) return json({ error: "VOW AI did not return a usable response." }, 502);
    if (textFormat) {
      try { return json({ structured: JSON.parse(text), text }); }
      catch { return json({ error: "VOW AI returned an invalid structured plan. Please try again." }, 502); }
    }
    return json({ text });
  } catch (error) {
    console.error("VOW AI function error", error instanceof Error ? error.message : "unknown");
    return json({ error: "VOW AI is temporarily unavailable. Please try again." }, 500);
  }
});
