import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type BenchmarkPlan = {
  milestones?: unknown[];
  sessions?: unknown[];
  schedule?: unknown[];
  [key: string]: unknown;
};

type Body = {
  run_id?: string;
  seq?: number;
  goal_category?: string;
  goal_text?: string;
};

const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") return response({ error: "POST required" }, 405);

  const started = Date.now();
  const body = (await req.json().catch(() => ({}))) as Body;
  const runId = body.run_id ?? crypto.randomUUID();
  const seq = body.seq ?? 1;
  const goalCategory = body.goal_category ?? "general";
  const goalText = body.goal_text ?? "Build a consistent daily reading habit over the next two weeks";

  const groqKey = Deno.env.get("GROQ_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!groqKey || !supabaseUrl || !serviceKey) {
    return response({ error: "benchmark configuration missing" }, 500);
  }

  let status = "failed";
  let qualityCode = "MODEL_ERROR";
  let output: unknown = null;
  let errorCode: string | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);

    const groq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${groqKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        reasoning_effort: "low",
        temperature: 0.4,
        max_tokens: 2500,
        messages: [
          {
            role: "system",
            content:
              "Create a practical two-week VOW goal plan. Return JSON with goal, summary, milestones, focus_areas, sessions, and schedule. Use concrete measurable actions. Avoid generic filler and repetitive daily tasks.",
          },
          {
            role: "user",
            content: `Goal category: ${goalCategory}\nGoal: ${goalText}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    ]);

    clearTimeout(timer);

    if (!groq.ok) {
      errorCode = `GROQ_HTTP_${groq.status}`;
      throw new Error(errorCode);
    }

    const raw = await groq.json();
    const content = raw?.choices?.[0]?.message?.content;
    if (!content) throw new Error("EMPTY_MODEL_OUTPUT");

    let plan: BenchmarkPlan;
    try {
      const parsed: unknown = JSON.parse(content);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("INVALID_JSON");
      plan = parsed as BenchmarkPlan;
    } catch {
      throw new Error("INVALID_JSON");
    }

    const hasMilestones = Array.isArray(plan.milestones) && plan.milestones.length >= 2;
    const hasSessions = Array.isArray(plan.sessions) && plan.sessions.length >= 3;
    const hasSchedule = Array.isArray(plan.schedule) && plan.schedule.length >= 7;

    const text = JSON.stringify(plan).toLowerCase();
    const genericPhrases = ["work on it", "keep going", "stay consistent", "make progress"];
    const genericCount = genericPhrases.filter((phrase) => text.includes(phrase)).length;

    output = plan;

    if (!hasMilestones || !hasSessions || !hasSchedule) {
      qualityCode = "QUALITY_INSUFFICIENT_STRUCTURE";
    } else if (genericCount >= 2) {
      qualityCode = "QUALITY_GENERIC";
    } else {
      status = "success";
      qualityCode = "PASS";
    }
  } catch (error) {
    if (!errorCode) {
      errorCode =
        error instanceof Error && error.name === "AbortError"
          ? "MODEL_TIMEOUT"
          : error instanceof Error
            ? error.message
            : "UNKNOWN_ERROR";
    }
  }

  const latencyMs = Date.now() - started;

  const saved = await fetch(`${supabaseUrl}/rest/v1/vow_live_benchmark_results`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify({
      run_id: runId,
      seq,
      goal_category: goalCategory,
      goal_text: goalText,
      status,
      latency_ms: latencyMs,
      quality_code: qualityCode,
      research_used: false,
      error_code: errorCode,
      output,
    }),
  });

  if (!saved.ok) {
    return response(
      {
        error: "result persistence failed",
        detail: await saved.text(),
        status,
        quality_code: qualityCode,
        latency_ms: latencyMs,
      },
      500,
    );
  }

  return response({
    run_id: runId,
    seq,
    status,
    quality_code: qualityCode,
    latency_ms: latencyMs,
  });
});
