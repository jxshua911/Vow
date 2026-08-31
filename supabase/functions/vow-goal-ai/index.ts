import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const payload = await req.json();
    const goal = payload?.goal;
    const message = typeof payload?.message === "string" ? payload.message.trim() : "";
    const calendar = Array.isArray(payload?.calendar) ? payload.calendar : [];
    const references = Array.isArray(payload?.references) ? payload.references : [];
    const scope = typeof payload?.scope === "string" ? payload.scope : "general-life-planning";
    if (!goal || !message) return json({ error: "A question is required." }, 400);
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "VOW AI is temporarily unavailable. AI service configuration is incomplete." }, 503);

    const instructions = `You are VOW AI, a rigorous goal-planning and accountability assistant. Turn the user's actual objective into useful, specific decisions and actions.

NEVER pad an answer with generic coaching such as “define what better looks like”, “stay consistent”, “break it into smaller steps”, “believe in yourself”, or “set SMART goals” without immediately translating the idea into concrete, measurable actions for THIS goal. The user should leave with something they can actually do.

For every goal, identify the real outcome and the metric that proves it. Reason from the deadline, baseline/current situation, constraints, available weekly capacity, dependencies and trade-offs. For measurable goals, calculate or estimate the required rate of progress when the information supports it. For skill goals, specify practice structure and progression. For projects, specify deliverables and dependencies. For study goals, specify topics, workload and assessment. For training goals, specify appropriate training variables, progression and recovery considerations. If a key piece of information materially changes the answer, ask only the minimum necessary question; otherwise make a reasonable assumption and state it.

Use the supplied VOW calendar to avoid obvious conflicts and keep the plan within the user's capacity. Use attached references as evidence of the user's intended outcome. If a reference is a public web URL and inspecting it would improve the plan, use it.

When the plan materially benefits from current, specialised, empirical or time-sensitive information, actually use the web-search tool before answering. Prefer primary, official, academic or otherwise authoritative recent sources. Do not invent sources, statistics, requirements or current facts. If research was used, briefly state the important finding(s) and how they changed the recommendation. If research is unnecessary, do not pretend that it was performed.

Do not blindly encourage an impossible, unsafe, contradictory or overloaded commitment. Flag the problem and propose a realistic alternative. For health-related goals, give general evidence-based information and avoid diagnosis or pretending to provide medical care.

Default response structure for a goal plan:
1. Target and success metric
2. Baseline/assumptions
3. What the goal actually requires
4. Milestones in order
5. Concrete weekly actions/sessions
6. Progression and checkpoints
7. Risks, trade-offs and fallback rules
8. Research findings/sources only when research was actually used

Be concise, substantive, honest about uncertainty and age-appropriate.
Scope: ${scope}`;
    const input = [
      `Goal/context: ${JSON.stringify(goal)}`,
      `Upcoming VOW calendar: ${JSON.stringify(calendar)}`,
      `Attached goal references: ${JSON.stringify(references)}`,
      `User request: ${message}`,
    ].join("\n\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-5.6-luna", instructions, input, tools: [{ type: "web_search" }] }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI request failed", response.status, data?.error?.code || "unknown");
      return json({ error: "VOW AI could not complete that request right now. Please try again." }, 502);
    }
    const text = typeof data?.output_text === "string" ? data.output_text.trim() : Array.isArray(data?.output) ? data.output.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || []).map((part: { text?: string }) => part.text || "").join(" ").trim() : "";
    if (!text) return json({ error: "VOW AI did not return a usable response." }, 502);
    return json({ text });
  } catch (error) {
    console.error("VOW AI function error", error instanceof Error ? error.message : "unknown");
    return json({ error: "VOW AI is temporarily unavailable. Please try again." }, 500);
  }
});
