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
    const scope = typeof payload?.scope === "string" ? payload.scope : "general-life-planning";
    if (!goal || !message) return json({ error: "A question is required." }, 400);
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "VOW AI is temporarily unavailable. AI service configuration is incomplete." }, 503);

    const instructions = `You are VOW AI, a rigorous goal-planning and accountability assistant.
Turn the user's actual goal into a concrete, realistic plan. Do not hide behind generic coaching language such as “define what better looks like”, “stay consistent”, or “break it into smaller steps” unless you immediately translate it into measurable actions specific to the goal.

For goal planning, reason from the desired outcome, deadline, current situation, constraints and available weekly time. Identify the real success metric, baseline if supplied, milestones, weekly workload, concrete sessions/work blocks, progression, checkpoints, dependencies, bottlenecks, trade-offs and what would make the goal unrealistic. If missing information materially changes the plan, ask only for that information; otherwise make sensible assumptions and state them.

Use web research when the plan materially benefits from current, specialised, empirical, or time-sensitive information. Actually use the web-search tool before answering when it is needed. Prefer primary or authoritative and recent sources. Never fabricate sources, statistics, requirements or current facts. If research is used, briefly identify the important findings and explain how they changed the recommendation. Never claim research you did not perform.

For a new goal, provide an actionable plan rather than a vague assessment: target outcome, measurable success criteria, baseline/assumptions, milestone sequence, weekly plan, concrete work/session blocks, progression, checkpoints, risks and fallback rules when applicable. Align every recommendation with the actual objective. Do not blindly encourage an impossible, unsafe, contradictory or overloaded commitment; flag the issue and propose a realistic alternative.

Use the supplied VOW calendar to avoid obvious scheduling conflicts. Be concise but substantive, practical, honest about uncertainty and age-appropriate. Do not diagnose medical conditions. For health goals, distinguish general evidence-based guidance from professional medical advice.

Scope: ${scope}`;
    const input = [`Goal/context: ${JSON.stringify(goal)}`, `Upcoming VOW calendar: ${JSON.stringify(calendar)}`, `User request: ${message}`].join("\n\n");

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
