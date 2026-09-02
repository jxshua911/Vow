import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } }); }

const clarificationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3 },
    recommended_duration_weeks: { type: "integer", minimum: 2, maximum: 52 },
    rationale: { type: "string" },
  },
  required: ["questions", "recommended_duration_weeks", "rationale"],
};

const planSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    outcome: { type: "string" },
    success_metric: { type: "string" },
    baseline: { type: "string" },
    assumptions: { type: "array", items: { type: "string" } },
    milestones: { type: "array", items: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, description: { type: "string" }, week: { type: "integer", minimum: 1, maximum: 52 } }, required: ["title", "description", "week"] }, minItems: 2, maxItems: 8 },
    weekly_schedule: { type: "array", items: { type: "object", additionalProperties: false, properties: { day: { type: "string" }, session: { type: "string" }, purpose: { type: "string" }, duration_minutes: { type: "integer", minimum: 10, maximum: 300 } }, required: ["day", "session", "purpose", "duration_minutes"] }, minItems: 1, maxItems: 14 },
    progression: { type: "string" },
    checkpoints: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
    risks: { type: "array", items: { type: "string" }, maxItems: 6 },
    fallback_rules: { type: "array", items: { type: "string" }, maxItems: 6 },
    summary: { type: "string" },
  },
  required: ["outcome", "success_metric", "baseline", "assumptions", "milestones", "weekly_schedule", "progression", "checkpoints", "risks", "fallback_rules", "summary"],
};

const baseInstructions = `You are VOW AI, a rigorous goal-planning and accountability assistant. Your job is to design a plan for the user's actual goal, not produce motivational filler.

NEVER use generic filler such as "generic plan", "Day 1", "Day 2", "Day 3", "stay consistent", "break it into smaller steps", "define what better looks like", or "set SMART goals" as the substance of a plan. Every action must be specific to the user's goal.

Use the user's actual baseline, constraints, available days, preferred schedule, deadline/horizon, resources and references. If important information is missing, ask only 2–3 high-value follow-up questions. Do not interrogate the user.

Choose a sensible time horizon based on the nature of the goal. Do not treat arbitrary 1-week/2-week/3-week choices as the plan itself. A time horizon is the container; the actual plan should have a logical progression inside it. If a longer horizon is appropriate, say so.

For recurring goals, build a real weekly rhythm. For example, a running goal might have an easy run, a quality/hard session and a recovery/longer session on days the user says are suitable. Do not copy the same session repeatedly. Vary purpose, load and progression appropriately.

Use the supplied calendar to avoid conflicts. Use references as evidence. Use web research only when current, specialised, empirical or time-sensitive information materially improves the plan. Do not invent sources or facts.

Be concise, practical, honest about uncertainty and age-appropriate.`;

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
    if (!goal || !message) return json({ error: "A question is required." }, 400);
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "VOW AI is temporarily unavailable. AI service configuration is incomplete." }, 503);

    let instructions = `${baseInstructions}\nScope: ${scope}`;
    const input = [`Goal/context: ${JSON.stringify(goal)}`, `Upcoming VOW calendar: ${JSON.stringify(calendar)}`, `Attached goal references: ${JSON.stringify(references)}`, `User request: ${message}`].join("\n\n");
    let textFormat: Record<string, unknown> | undefined;

    if (mode === "goal-clarify") {
      instructions += `\n\nYou are in the CLARIFICATION stage. Ask exactly 2 or 3 questions that materially change the plan. Prioritise: current baseline/experience, the user's desired measurable outcome, and which days/times they can realistically commit. If the user already supplied one of these, ask something else useful. Also recommend a sensible duration in weeks based on the goal. Do not create the full plan yet.`;
      textFormat = { type: "json_schema", name: "vow_goal_clarification", strict: true, schema: clarificationSchema };
    } else if (mode === "goal-plan") {
      instructions += `\n\nYou are in the PLAN stage. The user has answered the follow-up questions. Produce a fully custom plan. Use a concrete weekly schedule with real day names or the user's stated day labels. Each session must have a distinct purpose. Do not output numbered generic days. Include progression across the recommended horizon, milestones, checkpoints, risks and fallback rules. The weekly schedule should be directly usable by VOW to create calendar sessions.`;
      textFormat = { type: "json_schema", name: "vow_goal_plan", strict: true, schema: planSchema };
    } else {
      instructions += `\n\nFor normal questions, answer directly with useful goal-specific reasoning and concrete actions.`;
    }

    const requestBody: Record<string, unknown> = { model: "gpt-5.6-luna", instructions, input, tools: [{ type: "web_search" }] };
    if (textFormat) requestBody.text = { format: textFormat, verbosity: "medium" };

    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(requestBody) });
    const data = await response.json();
    if (!response.ok) { console.error("OpenAI request failed", response.status, data?.error?.code || "unknown"); return json({ error: "VOW AI could not complete that request right now. Please try again." }, 502); }
    const text = typeof data?.output_text === "string" ? data.output_text.trim() : Array.isArray(data?.output) ? data.output.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || []).map((part: { text?: string }) => part.text || "").join(" ").trim() : "";
    if (!text) return json({ error: "VOW AI did not return a usable response." }, 502);
    if (textFormat) {
      try { return json({ structured: JSON.parse(text), text }); } catch { return json({ error: "VOW AI returned an invalid structured plan. Please try again." }, 502); }
    }
    return json({ text });
  } catch (error) {
    console.error("VOW AI function error", error instanceof Error ? error.message : "unknown");
    return json({ error: "VOW AI is temporarily unavailable. Please try again." }, 500);
  }
});
