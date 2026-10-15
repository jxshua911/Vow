/* eslint-disable @typescript-eslint/no-explicit-any */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const MAX = { plan: 10000, clarify: 1200, chat: 700 };
const MAX_BODY_BYTES = 128 * 1024;
const json = (x: unknown, s = 200, e: Record<string, string> = {}) =>
  new Response(JSON.stringify(x), { status: s, headers: { ...CORS, ...e } });
function secret() {
  try {
    const x = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    if (x.default) return x.default;
  } catch {
    console.warn(
      "Invalid SUPABASE_SECRET_KEYS JSON; using service role fallback."
    );
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
function client(req: Request) {
  let k = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!k) {
    try {
      k =
        JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default ||
        "";
    } catch {
      console.warn(
        "Invalid SUPABASE_PUBLISHABLE_KEYS JSON; using empty publishable key."
      );
    }
  }
  return createClient(Deno.env.get("SUPABASE_URL")!, k, {
    global: {
      headers: { Authorization: req.headers.get("Authorization") || "" },
    },
  });
}
const db = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, secret(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const str = (x: unknown, n = 500) =>
  typeof x === "string" ? x.trim().slice(0, n) : "";
const arr = (x: unknown, n = 8) =>
  Array.isArray(x)
    ? x
        .slice(0, n)
        .map((v) => str(v, 500))
        .filter(Boolean)
    : [];
function parse(s: string) {
  const t = s
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(t);
  } catch {
    // Extract the first complete JSON value when the model adds prose/markdown.
    for (let start = 0; start < t.length; start += 1) {
      if (t[start] !== "{" && t[start] !== "[") continue;
      const stack: string[] = [];
      let inString = false;
      let escaped = false;
      for (let i = start; i < t.length; i += 1) {
        const ch = t[i];
        if (inString) {
          if (escaped) escaped = false;
          else if (ch === "\\") escaped = true;
          else if (ch === '"') inString = false;
          continue;
        }
        if (ch === '"') { inString = true; continue; }
        if (ch === "{" || ch === "[") stack.push(ch);
        else if (ch === "}" || ch === "]") {
          const expected = ch === "}" ? "{" : "[";
          if (stack[stack.length - 1] !== expected) break;
          stack.pop();
          if (stack.length === 0) {
            try { return JSON.parse(t.slice(start, i + 1)); } catch { break; }
          }
        }
      }
    }
    throw new Error("INVALID_AI_JSON");
  }
}
function weeks(g: any) {
  const n = Number(g?.duration_weeks ?? g?.durationWeeks ?? g?.weeks);
  if (Number.isFinite(n) && n >= 1) return Math.min(52, Math.round(n));
  return 8;
}
const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
function days(x: any, w: number) {
  const a = Array.isArray(x)
    ? (x
        .map((v) =>
          DAYS.find((d) => d.toLowerCase() === String(v).toLowerCase())
        )
        .filter(Boolean) as string[])
    : [];
  return a.length ? a.slice(0, 7) : DAYS.slice(0, Math.max(1, Math.min(4, w)));
}
// Models often abbreviate weekday names ("Mon", "tues", "Friday "). Map any
// recognisable form to the canonical DAY value so explicit per-day sessions
// are never silently dropped from the user's selected days.
function canonDayName(x: any): string | null {
  const s = String(x ?? "").trim().toLowerCase();
  if (!s) return null;
  const exact = DAYS.find((d) => d.toLowerCase() === s);
  if (exact) return exact;
  const prefix = s.slice(0, 3);
  return DAYS.find((d) => d.toLowerCase().startsWith(prefix)) || null;
}
function clarificationFallback(goal: string, category: string, selectedDays: string[], hasDeadline: boolean) {
  const normalizedCategory = category.toLowerCase();
  const lowerGoal = goal.toLowerCase();

  if (lowerGoal.includes("psychology") || lowerGoal.includes("psychological")) {
    return {
      questions: [
        "What is your current Psychology grade or most recent assessment mark?",
        "Which Psychology course or exam board are you studying, and what topics are in your next assessment?",
        "When is your next Psychology assessment, and do you have any teacher feedback on where you are losing marks?",
      ],
    };
  }

  if (
    lowerGoal.includes("sailing") ||
    lowerGoal.includes("regatta") ||
    lowerGoal.includes("tanzacat") ||
    lowerGoal.includes("catamaran") ||
    lowerGoal.includes("dinghy")
  ) {
    return {
      questions: [
        "What boat or sailing class are you competing in, and what is the event format?",
        "What is your current sailing level and recent race performance?",
        "What result are you targeting, and when is the competition?",
      ],
    };
  }

  const startingPointQuestion = normalizedCategory.includes("sport")
    ? "What is your current fitness or skill level for this activity?"
    : normalizedCategory.includes("language")
    ? "What can you currently understand or say in this language?"
    : normalizedCategory.includes("education") || normalizedCategory.includes("learning")
    ? "What have you already studied or practised in this subject?"
    : normalizedCategory.includes("career")
    ? "What experience or qualifications do you already have for this next step?"
    : normalizedCategory.includes("creative") || normalizedCategory.includes("craft")
    ? "What have you already made or practised in this area?"
    : normalizedCategory.includes("finance")
    ? "What is your current starting point or monthly amount you can set aside?"
    : "What have you already tried, and what is your current starting point?";
  const timingQuestion = hasDeadline
    ? "What makes your target date important, and is it flexible?"
    : "Do you have a target date or event you want to work toward?";
  return {
    questions: [
      `What measurable result would show you have achieved "${goal}"?`,
      startingPointQuestion,
      `${timingQuestion} You selected ${selectedDays.join(", ")} for sessions.`,
    ],
  };
}
async function cooldown(uid: string, k: CooldownKind) {
  try {
    const { data, error } = await db().rpc("vow_claim_ai_cooldown", {
      p_user_id: uid,
      p_kind: k,
    });

    if (error) {
      console.error("[VOW AI] Cooldown RPC error:", error);
      throw new Error("AI_USAGE_CHECK_FAILED");
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      console.error("[VOW AI] Cooldown RPC invalid response:", data);
      throw new Error("AI_USAGE_CHECK_FAILED");
    }

    const wait = Number(data.cooldown_seconds);
    if (
      !Number.isInteger(wait) ||
      wait < 0 ||
      typeof data.is_active !== "boolean"
    ) {
      console.error("[VOW AI] Cooldown RPC invalid response fields:", data);
      throw new Error("AI_USAGE_CHECK_FAILED");
    }

    console.log(`[VOW AI] Cooldown check for ${k}: wait ${wait}s`);
    return wait;
  } catch (error) {
    console.error("[VOW AI] Cooldown failed:", error);
    throw new Error("AI_USAGE_CHECK_FAILED");
  }
}
async function reservePlanningEntitlement(
  req: Request,
  feature: "planning_action" | "adaptive_replan",
  metadata: Record<string, unknown>
) {
  const { data, error } = await client(req).rpc("vow_reserve_entitlement", {
    p_feature: feature,
    p_metadata: metadata,
  });
  if (error) {
    console.error("[VOW AI] Entitlement reservation RPC error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error("ENTITLEMENT_RESERVATION_FAILED");
  }
  if (!data || typeof data !== "object") {
    console.error("[VOW AI] Entitlement reservation returned invalid data:", data);
    throw new Error("ENTITLEMENT_RESERVATION_FAILED");
  }
  return data as Record<string, unknown>;
}

async function finalizePlanningEntitlement(req: Request, reservationId: string | null) {
  if (!reservationId) return;
  const { data, error } = await client(req).rpc("vow_finalize_entitlement_reservation", {
    p_reservation_id: reservationId,
  });
  if (error || !data || (data as Record<string, unknown>).finalized !== true)
    throw new Error("ENTITLEMENT_FINALIZE_FAILED");
}

async function releasePlanningEntitlement(req: Request, reservationId: string | null) {
  if (!reservationId) return;
  const { error } = await client(req).rpc("vow_release_entitlement_reservation", {
    p_reservation_id: reservationId,
  });
  if (error) console.warn("entitlement reservation release failed", error.message);
}
async function record(
  req: Request,
  mode: "goal-clarify" | "goal-plan" | "chat",
  outcome: "success" | "error" | "blocked",
  latencyMs: number,
  errorCode?: string
) {
  const { error } = await client(req).rpc("vow_record_ai_usage", {
    p_mode: mode,
    p_outcome: outcome,
    p_latency_ms: latencyMs,
    p_error_code: errorCode || null,
  });
  if (error) console.warn("AI usage telemetry failed", error.message);
}
async function recordQualityAlert(req: Request, uid: string, goalId: string | null, mode: string, alertType: string, validationCode: string, goalTitle: string, details: Record<string, unknown>) {
  const { error } = await client(req).rpc("vow_record_ai_quality_alert", {
    p_user_id: uid,
    p_goal_id: goalId,
    p_mode: mode,
    p_alert_type: alertType,
    p_validation_code: validationCode,
    p_goal_title: goalTitle,
    p_details: details,
  });
  if (error) console.warn("AI quality alert recording failed", error.message);
}

async function searchKnowledge(query: string) {
  if (!query.trim()) return [];
  const q = query.trim().slice(0, 1000);
  try {
    const clientDb = db();
    const [knowledgeResult, conceptResult] = await Promise.all([
      clientDb.rpc("match_vow_knowledge_keyword", {
        query_text: q,
        domain_filter: null,
        match_count: 12,
      }),
      clientDb.rpc("match_vow_goal_concepts", {
        query_text: q,
        domain_filter: null,
        match_count: 12,
      }),
    ]);

    if (knowledgeResult.error) {
      console.warn("knowledge search", knowledgeResult.error.message);
    }
    if (conceptResult.error) {
      console.warn("goal concept search", conceptResult.error.message);
    }

    const original = (knowledgeResult.data || []).slice(0, 12).map((x: any) => ({
      domain: str(x.domain, 80),
      topic: str(x.topic, 120),
      title: str(x.title, 180),
      content: str(x.content, 700),
      principles: Array.isArray(x.principles) ? x.principles.slice(0, 6) : [],
      recommended_actions: Array.isArray(x.recommended_actions)
        ? x.recommended_actions.slice(0, 6)
        : [],
      metrics: Array.isArray(x.metrics) ? x.metrics.slice(0, 6) : [],
      cautions: Array.isArray(x.cautions) ? x.cautions.slice(0, 6) : [],
      source_url: str(x.source_url, 500),
    }));
    const concepts = (conceptResult.data || []).slice(0, 12).map((x: any) => ({
      domain: str(x.domain, 80),
      topic: str(x.topic, 120),
      title: str(x.concept_name, 180),
      content: str(x.description, 700),
      principles: [],
      recommended_actions: [],
      metrics: [],
      cautions: [],
      source_url: "",
      aliases: Array.isArray(x.aliases) ? x.aliases.slice(0, 8) : [],
      concept_type: str(x.concept_type, 80),
    }));

    const seen = new Set<string>();
    return [...original, ...concepts]
      .filter((x: any) => {
        const key = (x.domain + "|" + x.topic + "|" + x.title).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 18);
  } catch (e) {
    console.warn("knowledge search failed", e);
    return [];
  }
}
async function claimGuardrail(req: Request) {
  const requestId = crypto.randomUUID();
  const reservation = Number(Deno.env.get("VOW_AI_RESERVATION_USD") || "0.01");
  const { data, error } = await client(req).rpc("vow_claim_ai_guardrail", {
    p_request_id: requestId,
    p_reservation_usd: Number.isFinite(reservation) && reservation > 0 ? reservation : 0.01,
  });
  if (error) throw new Error("AI_GUARDRAIL_CHECK_FAILED");
  if (!data || typeof data !== "object" || (data as Record<string, unknown>).allowed !== true) {
    const code = typeof (data as Record<string, unknown> | null)?.code === "string"
      ? String((data as Record<string, unknown>).code)
      : "AI_GUARDRAIL_BLOCKED";
    throw new Error(code);
  }
  return requestId;
}

async function releaseGuardrail(req: Request, requestId: string) {
  const { error } = await client(req).rpc("vow_release_ai_guardrail", {
    p_request_id: requestId,
  });
  if (error) console.warn("AI guardrail release failed", error.message);
}

function detectAmbiguousTerms(text: string): boolean {
  if (!text) return false;

  // 1. Uppercase acronyms (3+ letters). Keep a small allowlist of common terms.
  const acronymPattern = /\b[A-Z]{3,}\b/g;
  const acronyms = text.match(acronymPattern) || [];
  const commonAcronyms = [
    "USA", "FBI", "CIA", "NYC", "DNA", "API", "HTTP", "JSON",
    "HTML", "CSS", "URL", "SQL", "CPU", "GPU", "RAM", "PDF",
  ];
  if (acronyms.some((acronym) => !commonAcronyms.includes(acronym))) return true;

  const lowerText = text.toLowerCase();

  // 2. Competition and event language often needs domain-specific context.
  const competitionKeywords = [
    "championship", "champion", "tournament", "tourney", "competition",
    "compete", "league", "cup", "series", "playoff", "playoffs", "event",
    "finals", "qualifier", "qualifiers", "grand slam", "major",
    "world championship", "world cup", "world record",
  ];
  if (competitionKeywords.some((keyword) => lowerText.includes(keyword))) return true;

  // 3. Current/time-sensitive language benefits from live research.
  const timeKeywords = [
    "latest", "current", "upcoming", "this year", "this season",
    "deadline", "season", "trending", "viral", "2026", "2027", "2028",
  ];
  if (timeKeywords.some((keyword) => lowerText.includes(keyword))) return true;

  // 4. Goal phrasing that commonly introduces a niche/specialist domain.
  const technicalPatterns = [
    /\b(professional|competitive|amateur|beginner)\s+\w+/i,
    /\b(learn|master|become|win|champion)\s+\w+\s+(at|in)\s+\w+/i,
    /\b(improve|get\s+better)\s+at\s+\w+/i,
  ];
  if (technicalPatterns.some((pattern) => pattern.test(text))) return true;

  return false;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response: Response, attempt: number) {
  const raw = response.headers.get("retry-after");
  const seconds = raw ? Number(raw) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.min(10000, Math.max(500, Math.round(seconds * 1000)));
  return Math.min(8000, 1000 * 2 ** attempt);
}

async function callGroq(req: Request, messages: any[], kind: keyof typeof MAX, _researchRequired: boolean) {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) throw new Error("GROQ_API_KEY_MISSING");

  // Bounded recovery: at most one rate-limit retry, one JSON-mode downgrade and
  // one targeted repair for unparseable/truncated output. Each attempt gets its
  // own timeout so a retry never inherits an exhausted deadline.
  const conversation = [...messages];
  let rateRetries = 0;
  let repairRetries = 0;
  let jsonMode = true;

  for (;;) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    let response: Response;
    let raw: string;
    try {
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "Groq-Model-Version": "latest",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages: conversation,
          max_completion_tokens: MAX[kind],
          temperature: 0.2,
          reasoning_effort: "low",
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
          // Keep the primary Groq request on the documented JSON mode for GPT-OSS.
          // VOW knowledge is already supplied in the prompt; no provider-side browser tool is required here.
        }),
      });
      raw = await response.text();
    } finally {
      clearTimeout(timer);
    }

    if (response.ok) {
      const payload = JSON.parse(raw);
      const message = payload?.choices?.[0]?.message;
      const content = message?.content;
      if (typeof content !== "string" || !content.trim()) throw new Error("GROQ_EMPTY_RESPONSE");
      try {
        return parse(content);
      } catch (parseError) {
        if (repairRetries === 0) {
          repairRetries = 1;
          console.warn("Groq returned unparseable or truncated JSON; requesting a complete compact resend once", {
            error: parseError instanceof Error ? parseError.message : String(parseError),
          });
          conversation.push(
            { role: "assistant", content },
            {
              role: "user",
              content:
                "Your previous reply was not a complete, valid JSON object. Resend the COMPLETE JSON object only: compact, no markdown fences, no truncation, all required fields present.",
            }
          );
          continue;
        }
        throw parseError instanceof Error ? parseError : new Error("INVALID_AI_JSON");
      }
    }

    if (response.status === 429 && rateRetries === 0) {
      rateRetries = 1;
      const delay = retryDelayMs(response, 0);
      console.warn("Groq rate limited; retrying once", { delay_ms: delay });
      await sleep(delay);
      continue;
    }

    if (response.status === 400 && jsonMode) {
      jsonMode = false;
      console.warn("Groq JSON-mode request rejected; retrying without response_format", {
        body: raw.slice(0, 1200),
      });
      continue;
    }

    console.error("Groq provider error", { status: response.status, body: raw.slice(0, 1200) });
    if (response.status === 429) throw new Error("GROQ_429");
    throw new Error(`GROQ_PROVIDER_ERROR_${response.status}`);
  }
}

async function callOpenAI(req: Request, messages: any[], kind: keyof typeof MAX) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY_MISSING");

  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), 35000);
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      signal: c.signal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_completion_tokens: MAX[kind],
        temperature: 0.15,
        response_format: { type: "json_object" },
      }),
    });

    const raw = await r.text();
    if (r.ok) {
      const payload = JSON.parse(raw);
      const message = payload?.choices?.[0]?.message;
      const content = message?.content;
      if (typeof content !== "string" || !content.trim()) throw new Error("OPENAI_EMPTY_RESPONSE");
      return parse(content);
    }

    console.error("OpenAI provider error", { status: r.status });
    throw new Error(`OPENAI_PROVIDER_ERROR_${r.status}`);
  } finally {
    clearTimeout(timer);
  }
}


type AiProvider = "groq" | "mistral";

function providerWeights(): Record<AiProvider, number> {
  // Launch defaults favour providers with genuine free/developer access.
  // Qwen is included only when its free quota is available for the account/region.
  const defaults: Record<AiProvider, number> = { groq: 0.5, mistral: 0.35 };
  try {
    const raw = JSON.parse(Deno.env.get("VOW_AI_PROVIDER_WEIGHTS") || "{}");
    for (const provider of ["groq", "mistral"] as AiProvider[]) {
      const value = Number(raw?.[provider]);
      if (Number.isFinite(value) && value >= 0) defaults[provider] = value;
    }
  } catch {
    console.warn("[VOW AI] Invalid VOW_AI_PROVIDER_WEIGHTS; using defaults.");
  }
  return defaults;
}

function providerOrder(): AiProvider[] {
  const weights = providerWeights();
  const enabled = (["groq", "mistral"] as AiProvider[]).filter((p) => {
    if (p === "groq") return Boolean(Deno.env.get("GROQ_API_KEY"));
    return Boolean(Deno.env.get("MISTRAL_API_KEY"));
  });
  if (!enabled.length) return [];
  const total = enabled.reduce((sum, p) => sum + weights[p], 0);
  if (total <= 0) return enabled;
  let pick = Math.random() * total;
  let selected: AiProvider = enabled[0];
  for (const provider of enabled) {
    pick -= weights[provider];
    if (pick <= 0) {
      selected = provider;
      break;
    }
  }
  return [selected, ...enabled.filter((p) => p !== selected)];
}

async function callMistral(req: Request, messages: any[], kind: keyof typeof MAX) {
  const key = Deno.env.get("MISTRAL_API_KEY");
  if (!key) throw new Error("MISTRAL_API_KEY_MISSING");
  const model = Deno.env.get("MISTRAL_MODEL") || "mistral-small-latest";

  // Bounded recovery mirroring the Groq path: one rate-limit retry and one
  // targeted repair for unparseable/truncated output, each attempt with its
  // own timeout.
  const conversation = [...messages];
  let rateRetries = 0;
  let repairRetries = 0;

  for (;;) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    let response: Response;
    let raw: string;
    try {
      response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: conversation,
          max_tokens: MAX[kind],
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      });
      raw = await response.text();
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      if (response.status === 429 && rateRetries === 0) {
        rateRetries = 1;
        const delay = retryDelayMs(response, 0);
        console.warn("[VOW AI] Mistral rate limited; retrying once", { delay_ms: delay });
        await sleep(delay);
        continue;
      }
      console.error("[VOW AI] Mistral provider error", { status: response.status, body: raw.slice(0, 1200) });
      throw new Error(response.status === 429 ? "MISTRAL_429" : `MISTRAL_PROVIDER_ERROR_${response.status}`);
    }

    const payload = JSON.parse(raw);
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("MISTRAL_EMPTY_RESPONSE");
    try {
      return parse(content);
    } catch (parseError) {
      if (repairRetries === 0) {
        repairRetries = 1;
        console.warn("[VOW AI] Mistral returned unparseable or truncated JSON; requesting a complete compact resend once", {
          error: parseError instanceof Error ? parseError.message : String(parseError),
        });
        conversation.push(
          { role: "assistant", content },
          {
            role: "user",
            content:
              "Your previous reply was not a complete, valid JSON object. Resend the COMPLETE JSON object only: compact, no markdown fences, no truncation, all required fields present.",
          }
        );
        continue;
      }
      throw parseError instanceof Error ? parseError : new Error("INVALID_AI_JSON");
    }
  }
}

async function callQwen(req: Request, messages: any[], kind: keyof typeof MAX) {
  const key = Deno.env.get("DASHSCOPE_API_KEY");
  if (!key) throw new Error("QWEN_API_KEY_MISSING");
  const baseUrl = (Deno.env.get("DASHSCOPE_BASE_URL") || "https://dashscope-us.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "");
  const model = Deno.env.get("QWEN_MODEL") || "qwen3.7-flash";
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), 35000);
  try {
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      signal: c.signal,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: MAX[kind],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
    const raw = await r.text();
    if (!r.ok) {
      console.error("[VOW AI] Qwen provider error", { status: r.status, body: raw.slice(0, 1200) });
      throw new Error(r.status === 429 ? "QWEN_429" : `QWEN_PROVIDER_ERROR_${r.status}`);
    }
    const payload = JSON.parse(raw);
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("QWEN_EMPTY_RESPONSE");
    return parse(content);
  } finally {
    clearTimeout(timer);
  }
}

async function callNova(req: Request, messages: any[], kind: keyof typeof MAX) {
  const key = Deno.env.get("AWS_BEARER_TOKEN_BEDROCK");
  if (!key) throw new Error("NOVA_API_KEY_MISSING");
  const region = Deno.env.get("AWS_BEDROCK_REGION") || "us-east-1";
  const model = Deno.env.get("AWS_NOVA_MODEL") || "amazon.nova-micro-v1:0";
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), 35000);
  try {
    const system = messages
      .filter((m: any) => m?.role === "system")
      .map((m: any) => ({ text: String(m.content || "") }))
      .filter((m: any) => m.text);
    const userMessages = messages
      .filter((m: any) => m?.role !== "system")
      .map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: [{ text: String(m.content || "") }],
      }));
    const r = await fetch(
      `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(model)}/converse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        signal: c.signal,
        body: JSON.stringify({
          system,
          messages: userMessages,
          inferenceConfig: { maxTokens: MAX[kind], temperature: 0.2 },
        }),
      }
    );
    const raw = await r.text();
    if (!r.ok) {
      console.error("[VOW AI] Nova provider error", { status: r.status, body: raw.slice(0, 1200) });
      throw new Error(r.status === 429 ? "NOVA_429" : `NOVA_PROVIDER_ERROR_${r.status}`);
    }
    const payload = JSON.parse(raw);
    const content = payload?.output?.message?.content
      ?.filter((x: any) => typeof x?.text === "string")
      ?.map((x: any) => x.text)
      ?.join("");
    if (!content?.trim()) throw new Error("NOVA_EMPTY_RESPONSE");
    return parse(content);
  } finally {
    clearTimeout(timer);
  }
}

async function ai(req: Request, messages: any[], kind: keyof typeof MAX, researchRequired = false) {
  const requestId = await claimGuardrail(req);
  try {
    const providers = providerOrder();
    console.log("[VOW AI] Provider routing", {
      selected: providers[0] || "none",
      fallback_order: providers.slice(1),
      weights: providerWeights(),
    });

    let lastError: unknown = null;
    for (const provider of providers) {
      try {
        const providerMessages =
          researchRequired && provider !== "groq"
            ? [
                ...messages,
                {
                  role: "system",
                  content:
                    "Fallback provider mode: provider-side web research is unavailable on this path. Do not claim that web research was performed. Use the supplied research results, VOW knowledge, and user context; no additional provider-side browser search is available on this path. Do not claim extra research, and return the same valid JSON structure requested by the original prompt.",
                },
              ]
            : messages;

        const result =
          provider === "groq"
            ? await callGroq(req, providerMessages, kind, researchRequired)
            : await callMistral(req, providerMessages, kind);
        console.log("[VOW AI] Provider succeeded", { provider });
        return result;
      } catch (providerError) {
        lastError = providerError;
        console.warn("[VOW AI] Provider failed; trying next provider", {
          provider,
          error: providerError instanceof Error ? providerError.message : String(providerError),
        });
      }
    }

    // Paid fallback is deliberately opt-in during VOW launch.
    // Keep this disabled while we are relying on free provider capacity.
    if (Deno.env.get("VOW_AI_ENABLE_PAID_FALLBACK") === "true" && Deno.env.get("OPENAI_API_KEY")) {
      const fallbackMessages = researchRequired
        ? [
            ...messages,
            {
              role: "system",
              content:
                "Emergency fallback mode: live web research is unavailable on this provider path. Do not claim that web research was performed. Use the supplied research results, VOW knowledge, and user context; no additional provider-side browser search is available on this path. Do not claim extra research, and return the same valid JSON structure requested by the original prompt.",
            },
          ]
        : messages;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await callOpenAI(req, fallbackMessages, kind);
          console.log("[VOW AI] OpenAI emergency fallback succeeded", { attempt: attempt + 1 });
          return result;
        } catch (openaiError) {
          lastError = openaiError;
          console.error("[VOW AI] OpenAI emergency fallback failed", {
            attempt: attempt + 1,
            error: openaiError instanceof Error ? openaiError.message : String(openaiError),
          });
          if (attempt === 0) await sleep(500);
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("AI_PROVIDER_UNAVAILABLE");
  } finally {
    await releaseGuardrail(req, requestId);
  }
}
async function researchGoalFacts(goalTitle: string, why: string) {
  const title = str(goalTitle, 300);
  if (!title) return [];
  const sources: Array<{ source: string; title: string; summary: string; url: string }> = [];
  const fetchText = async (url: string, timeoutMs = 2500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { Accept: "text/html", "User-Agent": "VOW-AI/1.0 (goal planning research)" },
        signal: controller.signal,
      });
      return response.ok ? await response.text() : "";
    } catch {
      return "";
    } finally {
      clearTimeout(timer);
    }
  };
  const cleanHtml = (value: string) => value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  const fetchJson = async (url: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "VOW-AI/1.0 (goal planning research)" },
        signal: controller.signal,
      });
      if (!response.ok) return null;
      return await response.json().catch(() => null);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
  const bookQuery = title.replace(/^.*?\b(?:read|finish|study|summarize|summarise)\s+(?:the\s+)?/i, "").trim();
  const isBookGoal = /\b(read|book|novel|chapter|pages|atomic habits|monk who sold|monk with a ferrari)\b/i.test(title + " " + why);
  const isNutritionGoal = /\b(nutrition|nutrients?|macros?|carbs?|carbohydrates?|protein|calories|calorie|food label|per 100g)\b/i.test(title + " " + why);
  const jobs: Promise<unknown>[] = [];
  if (isBookGoal && bookQuery) {
    jobs.push(fetchJson("https://openlibrary.org/search.json?title=" + encodeURIComponent(bookQuery) + "&limit=3&fields=title,author_name,first_publish_year,number_of_pages_median,key"));
  } else jobs.push(Promise.resolve(null));
  const query = title.replace(/^\s*(?:i want to|i want|want to|save up to buy|save up for|save up to|buy|purchase|learn about|learn|read|study|train for|prepare for)\s+/i, "").replace(/^(?:a|an|the)\s+/i, "").trim();
  jobs.push(query
    ? fetchJson("https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + encodeURIComponent(query) + "&format=json&utf8=1&srlimit=2")
    : Promise.resolve(null));
  const foodQuery = title.replace(/^.*?\b(?:nutrition(?:al)? facts? for|carbs? in|carbohydrates? in|protein in|calories in|macros? for|track|calculate|count|eat)\s+/i, "").trim();
  jobs.push(isNutritionGoal && foodQuery
    ? fetchJson("https://world.openfoodfacts.org/cgi/search.pl?search_terms=" + encodeURIComponent(foodQuery) + "&search_simple=1&action=process&json=1&page_size=3&fields=product_name,brands,nutriments,code")
    : Promise.resolve(null));
  const searchTerms = title.replace(/^\\s*(?:i want to|i want|want to|save up to|save for|buy|purchase|learn about|learn|train for|prepare for)\\s+/i, "").trim();
  const webSearchPromise = searchTerms
    ? fetchText("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(searchTerms + " price specifications guide"))
    : Promise.resolve("");
  const [bookData, wikiData, foodData, webSearchHtml] = await Promise.all([...jobs, webSearchPromise]);
  const docs = Array.isArray((bookData as any)?.docs) ? (bookData as any).docs.slice(0, 3) : [];
  for (const doc of docs) {
    const bookTitle = str(doc?.title, 180);
    if (!bookTitle) continue;
    const authors = Array.isArray(doc?.author_name) ? doc.author_name.slice(0, 3).map((x: unknown) => str(x, 80)).filter(Boolean) : [];
    const facts = [
      authors.length ? "Author(s): " + authors.join(", ") : "",
      doc?.first_publish_year ? "First publication year: " + String(doc.first_publish_year) : "",
      doc?.number_of_pages_median ? "Catalogue median page count: " + String(doc.number_of_pages_median) + " pages (edition-dependent estimate)" : "",
    ].filter(Boolean);
    const key = str(doc?.key, 160);
    sources.push({ source: "Open Library", title: bookTitle, summary: facts.join("; ") || "Catalogue record found; page count may vary by edition.", url: key.startsWith("/") ? "https://openlibrary.org" + key : "https://openlibrary.org" });
  }
  const hits = Array.isArray((wikiData as any)?.query?.search) ? (wikiData as any).query.search.slice(0, 2) : [];
  const summaries = await Promise.all(hits.map(async (hit: any) => {
    const pageTitle = str(hit?.title, 180);
    if (!pageTitle) return null;
    const summary = await fetchJson("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(pageTitle.replace(/ /g, "_")));
    const extract = str((summary as any)?.extract, 900);
    if (!extract) return null;
    const pageUrl = typeof (summary as any)?.content_urls?.desktop?.page === "string"
      ? (summary as any).content_urls.desktop.page
      : "https://en.wikipedia.org/wiki/" + encodeURIComponent(pageTitle.replace(/ /g, "_"));
    return { source: "Wikipedia", title: pageTitle, summary: extract, url: pageUrl };
  }));
  sources.push(...summaries.filter((item): item is { source: string; title: string; summary: string; url: string } => Boolean(item)));
  const webResults: Array<{ source: string; title: string; summary: string; url: string }> = [];
  const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = resultPattern.exec(webSearchHtml)) && webResults.length < 4) {
    let url = match[1].replace(/&amp;/g, "&");
    const redirected = /[?&]uddg=([^&]+)/.exec(url);
    if (redirected) {
      try { url = decodeURIComponent(redirected[1]); } catch { /* Keep original URL if decoding fails. */ }
    }
    const titleText = cleanHtml(match[2]).slice(0, 180);
    const tail = webSearchHtml.slice(match.index, match.index + 5000);
    const snippetMatch = /<(?:a|div)[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/i.exec(tail);
    const summary = snippetMatch ? cleanHtml(snippetMatch[1]).slice(0, 700) : "";
    if (/^https?:\/\//i.test(url) && titleText && summary) {
      webResults.push({ source: "Web search", title: titleText, summary, url });
    }
  }
  sources.push(...webResults);
  const products = Array.isArray((foodData as any)?.products) ? (foodData as any).products.slice(0, 3) : [];
  for (const product of products) {
    const productName = str(product?.product_name, 140);
    const nutrients = product?.nutriments || {};
    const facts = [
      Number.isFinite(Number(nutrients.carbohydrates_100g)) ? "carbohydrates " + nutrients.carbohydrates_100g + " g/100 g" : "",
      Number.isFinite(Number(nutrients.proteins_100g)) ? "protein " + nutrients.proteins_100g + " g/100 g" : "",
      Number.isFinite(Number(nutrients["energy-kcal_100g"])) ? "energy " + nutrients["energy-kcal_100g"] + " kcal/100 g" : "",
    ].filter(Boolean);
    if (!productName || !facts.length) continue;
    sources.push({ source: "Open Food Facts", title: productName, summary: "Label-reported values: " + facts.join("; ") + ". Values depend on the exact product and serving; verify the package label.", url: "https://world.openfoodfacts.org/product/" + str(product?.code, 40) });
  }
  const seen = new Set<string>();
  return sources.filter((item) => {
    const key = item.source + "|" + item.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

function meaningfulTokens(text: string) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((x) => x.trim())
      .filter((x) => x.length >= 4)
      .filter((x) => !["your", "with", "from", "that", "this", "week", "session", "practice", "practise", "learn", "work"].includes(x))
  );
}

function validatePlan(b: any, w: number, ds: string[], goalContext = "", scheduleTimesEnabled = true) {
  const milestones = Array.isArray(b?.milestones) ? b.milestones : [];
  const focus = Array.isArray(b?.weekly_focus) ? b.weekly_focus : [];
  const weekly = Array.isArray(b?.weekly_session_templates) ? b.weekly_session_templates : [];
  if (milestones.length < 2) return "INSUFFICIENT_MILESTONES";

  // Some provider responses omit one or more weekly_focus entries even when
  // they contain a complete, concrete week-by-week session plan. Derive the
  // missing focus from that week's actual sessions (or its nearest milestone)
  // instead of rejecting an otherwise usable plan.
  if (focus.length < w) {
    const sortedMilestones = [...milestones].sort(
      (a: any, b: any) => Number(a?.week || 1) - Number(b?.week || 1)
    );
    b.weekly_focus = Array.from({ length: w }, (_, index) => {
      const existing = str(focus[index], 350);
      if (existing) return existing;
      const weekNumber = index + 1;
      const weekPlan = weekly.find((item: any) => Number(item?.week) === weekNumber);
      const tasks = Array.isArray(weekPlan?.sessions)
        ? weekPlan.sessions.map((item: any) => str(item?.task, 160)).filter(Boolean)
        : [];
      if (tasks.length) return `Week ${weekNumber}: ${tasks.join("; ")}`.slice(0, 350);
      const milestone = sortedMilestones.reduce((closest: any, item: any) => {
        if (!closest) return item;
        return Math.abs(Number(item?.week || 1) - weekNumber) <
          Math.abs(Number(closest?.week || 1) - weekNumber) ? item : closest;
      }, null);
      if (milestone) {
        return `Week ${weekNumber}: ${str(milestone.title, 160)} — ${str(milestone.description, 180)}`.slice(0, 350);
      }
      return `Week ${weekNumber}: make measurable progress toward ${str(b?.outcome, 250) || str(goalContext, 250)}`.slice(0, 350);
    });
  }
  if (w <= 16 && weekly.length < w) return "INSUFFICIENT_WEEKLY_SESSIONS";

  const planned = schedule(b, w, ds, str(b?.start_date) || new Date().toISOString().slice(0, 10), scheduleTimesEnabled);
  if (planned.length !== w * ds.length) return "INCOMPLETE_SCHEDULE";

  const tasks = planned.map((x: any) => str(x.task, 350).toLowerCase()).filter(Boolean);
  const unique = new Set(tasks);
  if (tasks.length >= 8 && unique.size / tasks.length < 0.55) return "REPETITIVE_SCHEDULE";

  const generic = /^(work on|make progress on|continue working on|review your goal|do your task|practice more|practise more|keep practicing|keep practising|spend (some )?time|focus on improving|work through|learn more about|study the topic|practice the basics|practise the basics)\b/i;
  const vague = /^(do|work|practice|practise|study|learn|review|focus)\s+(this|that|it|more|better|the goal|your goal|the topic)\b/i;
  if (planned.some((x: any) => {
    const task = str(x.task, 350);
    return generic.test(task) || vague.test(task) || task.split(/\s+/).filter(Boolean).length < 4;
  })) return "GENERIC_SESSION_TASK";

  const contextTokens = meaningfulTokens([
    goalContext,
    ...focus.map((x: any) => str(x, 350)),
    str(b?.outcome, 500),
    str(b?.success_metric, 350),
  ].join(" "));
  let weakSpecificity = 0;
  for (const item of planned) {
    const task = str(item.task, 350);
    const taskTokens = meaningfulTokens(task);
    const overlapsContext = [...taskTokens].some((token) => contextTokens.has(token));
    // Sets x reps notation ("4x30s", "5x4", "6x2") is a genuine measure even
    // though no unit word follows the numbers.
    const hasMeasure = /\b\d+(?:[.,]\d+)?\s*(?:%|minutes?|mins?|hours?|km|miles?|reps?|sets?|pages?|words?|items?|sessions?|days?|seconds?|points?|kg|lb)\b/i.test(task) ||
      /\b\d+\s*[x×]\s*\d+/i.test(task);
    const hasConcreteVerb = /\b(analy[sz]e|build|calculate|complete|create|draft|edit|film|identify|measure|mix|outline|perform|record|solve|write|draw|bake|knead|shape|letter|paint|run|cycle|swim|lift|code|debug|test|revise|compare|read|summari[sz]e|translate|memorise|memorize|recite|drill|trace|copy|compose|schedule|plan|track|time|score|review|hold|holds|land|lands|landing|attempt|attempts|stretch|stretches|rehearse|spar|shadowbox|warm|cool|make|makes|making|cook|cooks|cooking|boil|boils|boiling|chop|chops|chopping|dice|dices|dicing|simmer|simmers|simmering|stir|stirs|stirring|season|seasons|seasoning|drain|drains|toss|tosses|taste|tastes|plate|plates|serve|serves|prepare|prepares|preparing|saute|sauté|roast|roasts|grill|grills|whisk|whisks|combine|combines|peel|peels|grate|grates|fold|folds|blend|blends|pour|pours|heat|heats|rinse|rinses|shred|shreds)\b/i.test(task);
    if (!overlapsContext && !hasMeasure) weakSpecificity++;
    else if (!hasConcreteVerb && !hasMeasure) weakSpecificity++;
  }
  if (planned.length && weakSpecificity / planned.length > 0.6) return "GENERIC_SESSION_TASK";
  return null;
}

function schedule(b: any, w: number, ds: string[], startDate: string, scheduleTimesEnabled = true) {
  const weekly = Array.isArray(b?.weekly_session_templates)
    ? b.weekly_session_templates
        .map((week: any) => ({
          week: Math.max(1, Math.min(w, Math.round(Number(week?.week) || 1))),
          sessions: Array.isArray(week?.sessions)
            ? week.sessions
                .map((x: any) => ({ ...x, day: canonDayName(x?.day) }))
                .filter((x: any) => x.day && ds.includes(x.day))
                .slice(0, ds.length)
            : [],
        }))
        .filter((week: any) => week.sessions.length)
    : [];

  const rawTemplates = Array.isArray(b?.session_templates)
    ? b.session_templates.map((t: any) => ({ ...t, day: canonDayName(t?.day) }))
    : [];
  const templates = rawTemplates.length ? rawTemplates : ds.map((day, idx) => ({
    day,
    task: str(b?.weekly_focus?.[0], 350) || `Core session ${idx + 1} for ${str(b?.outcome, 100) || "your goal"}`,
    purpose: str(b?.success_metric, 350) || "Make measurable progress toward the milestone target.",
    target_metric: str(b?.success_metric, 180) || "Complete planned execution block",
    duration_minutes: 30,
    preferred_time: null,
  }));

  const focus = Array.isArray(b?.weekly_focus) && b.weekly_focus.length
    ? b.weekly_focus
    : [str(b?.summary, 350) || `Focus on progressing ${str(b?.outcome, 100) || "your goal"}`];

  const out: any[] = [];
  const start = new Date(`${startDate || new Date().toISOString().slice(0, 10)}T09:00:00`);
  const monday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - monday);

  for (let week = 1; week <= w; week++) {
    const explicitWeek = weekly.find((x: any) => x.week === week);
    for (const day of ds) {
      const d = new Date(start);
      d.setDate(d.getDate() + (week - 1) * 7 + DAYS.indexOf(day));

      const explicit = explicitWeek?.sessions?.find((x: any) => x.day === day);
      const template =
        explicit ||
        templates.find((x: any) => x.day === day) ||
        templates[(week - 1) % templates.length];

      const f = str(focus[Math.min(week - 1, focus.length - 1)], 350);
      const baseTask = str(template?.task, 350) || f;
      const task = explicit
        ? baseTask
        : f && !baseTask.toLowerCase().includes(f.toLowerCase())
        ? `${f}: ${baseTask}`
        : baseTask;

      out.push({
        week,
        day,
        task,
        purpose: [str(template?.purpose, 350), f].filter(Boolean).join(" "),
        target_metric: str(template?.target_metric, 180) || str(b?.success_metric, 180) || "Complete the planned work",
        duration_minutes: Math.max(5, Math.min(240, Number(template?.duration_minutes) || 30)),
        preferred_time: scheduleTimesEnabled
          ? (/^\d{1,2}:\d{2}$/.test(str(template?.preferred_time, 10)) ? template.preferred_time : null)
          : null,
        scheduled_at: scheduleTimesEnabled ? d.toISOString() : null,
      });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  let mode = "chat";
  let uid = "";
  const startedAt = Date.now();
  let entitlementReservationId: string | null = null;
  let entitlementFinalized = false;
  try {
    if (!(req.headers.get("Authorization") || "").startsWith("Bearer "))
      return json({ error: "Authentication required." }, 401);
    const { data, error } = await client(req).auth.getUser();
    if (error || !data.user)
      return json({ error: "Authentication required." }, 401);
    uid = data.user.id;
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES)
      return json({ error: "Request body is too large." }, 413);
    let p: any = null;
    try {
      const raw = await req.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES)
        return json({ error: "Request body is too large." }, 413);
      p = JSON.parse(raw);
    } catch {
      p = null;
    }
    if (!p || typeof p !== "object")
      return json({ error: "Invalid request body." }, 400);
    const requestedMode = p?.mode;
    mode = ["goal-clarify", "goal-plan", "chat"].includes(requestedMode)
      ? requestedMode
      : "chat";
    const kind =
      mode === "goal-plan"
        ? "plan"
        : mode === "goal-clarify"
        ? "clarify"
        : "chat";
    const g = p?.goal || {};
    const domain = g?.domain && typeof g.domain === "object" ? g.domain : {};
    const { data: userSettings } = await client(req)
      .from("user_settings")
      .select("preferred_language")
      .eq("user_id", uid)
      .maybeSingle();
    const preferredLanguage =
      typeof userSettings?.preferred_language === "string" &&
      userSettings.preferred_language.trim()
        ? userSettings.preferred_language.trim().slice(0, 16)
        : "en";
    const rawTitle = typeof g?.title === "string" ? g.title.trim() : typeof g?.outcome === "string" ? g.outcome.trim() : "";
    const rawWhy = typeof g?.why_it_matters === "string" ? g.why_it_matters.trim() : "";
    const rawMessage = typeof p?.message === "string" ? p.message : "";
    if (rawTitle.length > 300 || rawWhy.length > 500 || rawMessage.length > 3000)
      return json({ error: "One or more planning inputs are too long." }, 413);
    const message0 = str(rawMessage, 3000);
    if (mode !== "chat" && !str(g?.title || g?.outcome, 300))
      return json(
        { error: "A goal description is required for planning." },
        400
      );
    if (!message0 && !str(g?.title || g?.outcome, 300))
      return json(
        { error: "Please include what you would like help with." },
        400
      );
    // A goal-plan response may itself request clarification. Let the user answer
    // that follow-up immediately instead of making the next legitimate planning
    // step fail the same 30-second cooldown. The initial request still uses the
    // normal cooldown; concurrency and entitlement guardrails remain in force.
    const wait = mode === "goal-plan" && p?.is_followup === true
      ? 0
      : await cooldown(uid, kind);
    if (wait)
      return json(
        {
          error: "VOW AI is on a short cooldown. Please try again shortly.",
          retry_after_seconds: wait,
        },
        429,
        { "Retry-After": String(wait) }
      );
    const adaptive = mode === "chat" && /missed|rebuild|changed|realistic|adapt|schedule/i.test(message0);
    const feature = mode === "goal-clarify"
      ? null
      : adaptive
      ? "adaptive_replan"
      : "planning_action";
    let entitlement: Record<string, unknown> = {
      allowed: true,
      reservation_id: null,
      feature,
    };
    if (feature) {
      try {
        entitlement = await reservePlanningEntitlement(req, feature, {
          goal_id: typeof p?.goal_id === "string" ? p.goal_id : null,
          prompt_type: feature,
          request_id: crypto.randomUUID(),
        });
      } catch (error) {
        console.error(
          "[VOW AI] Entitlement reservation unavailable; failing closed:",
          error instanceof Error ? error.message : String(error)
        );
        throw new Error("ENTITLEMENT_RESERVATION_FAILED");
      }
    }
    if (entitlement.allowed !== true)
      return json(
        {
          error: "This VOW AI feature is not available on your current plan.",
          entitlement,
        },
        403
      );
    entitlementReservationId =
      typeof entitlement.reservation_id === "string" ? entitlement.reservation_id : null;
    const w = weeks(g),
      ds = days(p?.available_days, g?.weekly_commitment_target || 3),
      answers = Array.isArray(p?.answers)
        ? p.answers
            .slice(0, 8)
            .map((a: any) => ({
              question: str(a?.question, 220),
              answer: str(a?.answer, 500),
            }))
        : [],
      refs = Array.isArray(p?.references)
        ? p.references
            .slice(0, 6)
            .map((r: any) => ({
              url: str(r?.url, 1000),
              title: str(r?.title, 200),
              resource_type: str(r?.resource_type, 80),
            }))
            .filter((r: any) => /^https?:\/\//i.test(r.url))
        : [],
      message = message0;
    const clean = answers.map((item: any) => String(item.answer ?? "").trim());
    const unknown = /^(i\s*(don['']?t|do not)\s*know|not sure|unsure|unknown|n\/a)$/i;
    const isUnanswered = (a: string) => !a || unknown.test(a);
    const unresolved = clean.filter(isUnanswered).length;
    console.log("[VOW] Clarification answers:", { answers, clean, unresolved });
    const knowledgeQuery = [
      str(g?.title || g?.outcome, 500),
      str(g?.why_it_matters, 300),
      ...answers.map((a: any) => str(a.answer, 350)),
      message.slice(0, 700),
    ]
      .filter(Boolean)
      .join(" ");
    const titleForResearch = str(g?.title || g?.outcome, 300);
    const hasNamedEntity = /(?:^|\s)[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*(?=$|\s)/.test(titleForResearch.split(/\s+/).slice(1).join(" "));
    const researchRequired =
      domain?.needs_ai_research === true ||
      detectAmbiguousTerms(message) ||
      detectAmbiguousTerms(g?.outcome || "") ||
      hasNamedEntity ||
      /\b(?:buy|purchase|save up|price|cost|budget|202[0-9])\b/i.test(titleForResearch);
    const [goalsResult, journalResult, knowledge, research] = await Promise.all([
      client(req).from("goals").select("title, outcome, why_it_matters, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(5),
      client(req).from("journal_entries").select("body, created_at, linked_goal_id").eq("user_id", uid).order("created_at", { ascending: false }).limit(10),
      searchKnowledge(knowledgeQuery),
      mode === "goal-plan" || researchRequired
        ? researchGoalFacts(str(g?.title || g?.outcome, 300), str(g?.why_it_matters, 500))
        : Promise.resolve([]),
    ]);
    const userGoals = goalsResult.data;
    const userJournal = journalResult.data;
    const context = {
      goal: {
        title: str(g?.title || g?.outcome, 300),
        outcome: str(g?.outcome, 500),
        why_it_matters: str(g?.why_it_matters, 500),
        duration_weeks: w,
        available_days: ds,
        schedule_times_enabled: g?.schedule_times_enabled === true,
        start_date: str(g?.start_date, 30),
        deadline: str(g?.deadline, 30),
      },
      answers,
      references: refs,
      preferred_language: preferredLanguage,
      previousGoals: userGoals || [],
      journalEntries: userJournal || [],
      knowledge,
      research,
    };
    console.log("[VOW AI] Initial domain.category:", domain?.category);
    let fallbackCategory = domain?.category;
    console.log("[VOW AI] Initial domain.category:", domain?.category);
    if (!fallbackCategory || fallbackCategory === "Unknown" || fallbackCategory === "General") {
      try {
        console.log("[VOW AI] Calling AI classification...");
        const classResult = await ai(req, [
          {
            role: "system",
            content: `Classify the user's goal into exactly one of these supported categories: Sports, Languages, Crafts/Hobbies, Education, Reading, Mindfulness, Technology/Projects, Career/Projects, Personal Development, Life Admin, Communication, Wellbeing, Creative Skills, Travel, Learning, Practical Skills, Finance, Productivity. If the goal involves a specific event, competition, or ambiguous term, use web search to understand it first. Return ONLY JSON: {"category": "string"}. Do not return 'General'.`
          },
          { role: "user", content: `Goal: ${str(g?.title || g?.outcome, 300)}. Context: ${str(g?.why_it_matters, 500)}` }
        ], "clarify", researchRequired);
        console.log("[VOW AI] Classification result:", classResult);
        
        const validCategories = ["Sports", "Languages", "Crafts/Hobbies", "Education", "Reading", "Mindfulness", "Technology/Projects", "Career/Projects", "Personal Development", "Life Admin", "Communication", "Wellbeing", "Creative Skills", "Travel", "Learning", "Practical Skills", "Finance", "Productivity"];
        
    console.log("[VOW AI] Classification result:", JSON.stringify(classResult));
        if (classResult && typeof classResult.category === "string" && validCategories.includes(classResult.category)) {
           fallbackCategory = classResult.category;
           domain.category = fallbackCategory;
    console.log("[VOW AI] Final category saved:", domain.category);
           domain.confidence = Math.max(Number(domain.confidence) || 0, 0.72);
        } else {
           fallbackCategory = "Personal Development";
           domain.category = fallbackCategory;
    console.log("[VOW AI] Final category saved:", domain.category);
           domain.confidence = Math.max(Number(domain.confidence) || 0, 0.7);
        }
      } catch (e) {
        console.warn("Groq fallback classification failed", e);
        fallbackCategory = "Personal Development";
        domain.category = fallbackCategory;
    console.log("[VOW AI] Final category saved:", domain.category);
        domain.confidence = Math.max(Number(domain.confidence) || 0, 0.7);
      }
    }
    console.log("[VOW AI] Final fallbackCategory:", fallbackCategory);

    if (mode === "goal-clarify") {
      let r: any;
      let usedFallback = false;
      try {
        r = await ai(req,
          [
            {
              role: "system",
              content: `You are VOW's specialist goal-discovery researcher. Respond in the user's selected language (language code: ${preferredLanguage}) unless the user explicitly asks for another language. Preserve structured JSON keys in English. Use the supplied VOW knowledge base, domain profile, previous goals, recent journal context, and research results as your first planning reference. Use previous goals and journal entries only to personalise the plan when they are relevant to the current goal. Return ONLY JSON: {questions:[string,string,string],recommended_duration_weeks:number,rationale:string,category:string,goal_type:string,classification_confidence:number}. Copy category and goal_type from the supplied domain profile when it is sufficiently specific; otherwise classify the goal accurately and use one supported category. Ask high-value questions that resolve the most important missing inputs for this exact domain. For savings or purchase goals involving a named product, vehicle, property, course, or other specific target, use supplied research to identify the item and public price evidence first; never ask the user to define a measurable success metric or supply facts available online. Ask only for personal variables that materially affect the plan, such as location/currency, current savings, and a realistic contribution amount. Use the supplied research results to resolve named entities and ambiguous terms before asking questions. If research does not resolve an ambiguity that materially changes the plan, ask one concise, specific clarification instead of generic questions. Never ask generic questions when domain-specific ones are possible. Do not ask for information already supplied. If the user says they do not know, ask a smaller decision question that helps them choose; do not proceed as if the missing information does not matter. Domain profile: ${JSON.stringify(domain)}`,
            },
            { role: "user", content: JSON.stringify({ message, ...context }) },
          ],
          "clarify",
          researchRequired
        );
      } catch (e) {
        console.warn("clarify AI error", e);
        const errorCode = e instanceof Error ? e.message : String(e);
        const providerFailure = /^(GROQ_API_KEY_MISSING|MISTRAL_API_KEY_MISSING|QWEN_API_KEY_MISSING|NOVA_API_KEY_MISSING|GROQ_429|MISTRAL_429|QWEN_429|NOVA_429|GROQ_PROVIDER_ERROR_\d+|MISTRAL_PROVIDER_ERROR_\d+|QWEN_PROVIDER_ERROR_\d+|NOVA_PROVIDER_ERROR_\d+|GROQ_EMPTY_RESPONSE|MISTRAL_EMPTY_RESPONSE|QWEN_EMPTY_RESPONSE|NOVA_EMPTY_RESPONSE|OPENAI_API_KEY_MISSING|OPENAI_PROVIDER_ERROR_\d+|OPENAI_EMPTY_RESPONSE|INVALID_AI_JSON|AI_RESEARCH_NOT_PERFORMED|AI_USAGE_CHECK_FAILED)$/.test(errorCode) ||
          /^(GROQ_API_KEY_MISSING|GROQ_429|GROQ_PROVIDER_ERROR_\d+|GROQ_EMPTY_RESPONSE|OPENAI_API_KEY_MISSING|OPENAI_PROVIDER_ERROR_\d+|OPENAI_EMPTY_RESPONSE|INVALID_AI_JSON|AI_RESEARCH_NOT_PERFORMED|AI_USAGE_CHECK_FAILED)$/.test(errorCode) ||
          (e instanceof TypeError && /fetch|network|timeout/i.test(errorCode)) ||
          (e instanceof Error && e.name === "AbortError");
        if (!providerFailure) throw e;
        const goalLabel = str(g?.outcome || g?.title, 180) || "this goal";
        r = {
          ...clarificationFallback(goalLabel, str(fallbackCategory, 80), ds, Boolean(str(g?.deadline, 30))),
          recommended_duration_weeks: w,
          rationale: "A few details will help VOW shape a practical plan around your goal and schedule.",
          category: fallbackCategory || "Personal Development",
          goal_type: str(domain?.goal_type, 80) || "Personal goal",
          classification_confidence: Number(domain?.confidence) || 0.6,
        };
        usedFallback = true;
      }
      let questions = arr(r?.questions, 3).slice(0, 3);
      if (questions.length < 2) {
        questions = clarificationFallback(
          str(g?.outcome || g?.title, 180) || "this goal",
          str(fallbackCategory, 80),
          ds,
          Boolean(str(g?.deadline, 30)),
        ).questions;
        r = {
          ...r,
          recommended_duration_weeks: w,
          rationale: "A few details will help VOW shape a practical plan around your goal and schedule.",
          category: fallbackCategory || "Personal Development",
          goal_type: str(domain?.goal_type, 80) || "Personal goal",
          classification_confidence: Number(domain?.confidence) || 0.6,
        };
        usedFallback = true;
      }
      r.questions = questions;
      r.category = str(r.category, 80) || str(fallbackCategory, 80) || "Personal Development";
      r.goal_type = str(r.goal_type, 80) || str(domain?.goal_type, 80) || "Personal goal";
      const classificationConfidence = Number(r.classification_confidence);
      const domainConfidence = Number(domain?.confidence);
      r.classification_confidence = Number.isFinite(classificationConfidence)
        ? Math.max(0, Math.min(1, classificationConfidence))
        : Number.isFinite(domainConfidence)
        ? Math.max(0, Math.min(1, domainConfidence))
        : 0.7;
      r.recommended_duration_weeks = Math.min(
        52,
        Math.max(1, Number(r.recommended_duration_weeks) || w)
      );
      r.rationale = str(r.rationale, 500);
      if (usedFallback && entitlementReservationId) {
        await releasePlanningEntitlement(req, entitlementReservationId);
        entitlementReservationId = null;
      }
      await record(req, "goal-clarify", "success", Date.now() - startedAt);
      if (entitlementReservationId) {
        await finalizePlanningEntitlement(req, entitlementReservationId);
        entitlementFinalized = true;
      }
      return json({ structured: r, text: JSON.stringify(r) });
    }
    if (mode === "goal-plan") {
      const planMessages = [
            {
              role: "system",
              content: `You are VOW's expert planning and research engine. Use the supplied research results and cite their URLs in references when relevant. Treat catalogue page counts as edition-dependent estimates. If a public lookup is unavailable, proceed with a transparent assumption rather than pretending research happened. Never make the user supply facts that can reasonably be looked up, and never block a plan because the user cannot know a precise measurement in advance. For unknown personal baselines, choose a safe, adjustable starting estimate or include a short baseline-measuring activity in the first session. Respond in the user's selected language (language code: ${preferredLanguage}) unless the user explicitly asks for another language. Preserve structured JSON keys in English. Build the best practical plan for the exact goal. The VOW knowledge base, domain profile, previous goals, and recent journal context are core references: use relevant entries to ground methodology, actions, metrics and cautions before using web research. Use real-time web search and visit authoritative sources when current or specialist information can improve the plan. Use the supplied research results when available. If a specialist term remains ambiguous after lookup, avoid unsupported claims and build a cautious plan around the user's stated meaning or ask one concise clarification only when the ambiguity materially changes the plan. Prefer primary sources, respected institutions and recognised expert frameworks; synthesise research rather than dumping links. Only return clarification_needed:true when a genuinely essential personal choice or safety constraint makes planning inappropriate without an answer. Do not ask for searchable public facts, product/book specifications, nutrition labels, exact future performance, or measurements the user cannot reasonably know. Use assumptions and mark them clearly in assumptions[]. Use previous goals and recent journal entries as personal context when relevant, but never expose unrelated private details or assume that past goals must continue. Never fill missing personal context with boilerplate. Verify resource URLs with web_search: when suitable, include one direct, genuinely relevant YouTube video and one authoritative website for this exact goal and level. Do not invent titles or URLs; omit an unavailable resource rather than fabricate it. The app may add clearly labelled YouTube searches and app suggestions separately. Clock times are optional: when goal.schedule_times_enabled is false, preferred_time must be null and no time of day may be invented. Research named products, vehicles, careers, qualifications, locations, events, and other specific entities instead of treating them as generic goals. For savings or purchase goals, identify the exact target item, research credible current price evidence where available, cite sources, calculate a transparent target and adjustable savings scenarios, and ask only about personal inputs such as currency, current savings, and feasible contribution. If prices vary or live evidence is unavailable, say so and show a labelled estimate rather than pretending to know an exact price. Duration (${w} weeks) and available days (${ds.join(
                ", "
              )}) are HARD constraints. Follow-up answers are HARD personal context. Domain profile: ${JSON.stringify(domain)}. Return ONLY JSON with outcome, success_metric, baseline, assumptions, milestones (2-8 objects with title,description,week), weekly_session_templates (one object per week, each containing week and sessions; sessions must contain one concrete, distinct session for each selected day with day,task,purpose,target_metric,duration_minutes,preferred_time), session_templates (fallback template per selected day with day,task,purpose,target_metric,duration_minutes,preferred_time), weekly_focus (exactly one string per week), progression, checkpoints (3-8), risks (3-8), fallback_rules (2-6), summary, references (0-4 objects with url,title,resource_type). Make the plan genuinely domain-specific. Do not invent specialist claims when the knowledge/research does not support them. Each week's sessions must advance that week's focus rather than repeating the same task. Sessions must be concrete enough that the user can execute them without guessing what "work on it" means. For skill-based physical activities, specify named drills and sub-steps, sets and repetitions or rounds, rest periods where appropriate, technique cues, and a clear finish condition. For beginner martial arts, progress from stance, balance, footwork and basic techniques to controlled combinations; prioritise qualified instructor feedback and supervised practice, never prescribe unsupervised sparring or guarantee formal belt readiness by a deadline. For cooking goals, specify actual recipe actions such as preparing ingredients, boiling and timing pasta, simmering sauce, tasting, or plating instead of vague cooking tasks. Every week must meaningfully progress toward the outcome.`,
            },
            { role: "user", content: JSON.stringify({ message, ...context }) },
          ];
      let b: any;
      try {
        b = await ai(req, planMessages, "plan", researchRequired);
      } catch (e) {
        console.warn("plan AI failed", e);
        throw e;
      }
      if (b?.clarification_needed === true) {
        const followupQuestions = arr(b.questions, 3).slice(0, 3);
        // A single targeted question is valid: requiring two questions here
        // turned useful model clarification into an HTTP 502 for the user.
        if (followupQuestions.length === 0) {
          const goalTitle = str(g?.title || g?.outcome, 160) || "this goal";
          followupQuestions.push(
            `What measurable result would show progress on "${goalTitle}" during the first week?`,
            "What current skill level, starting point, or constraint should VOW account for?"
          );
        }
        await releasePlanningEntitlement(req, entitlementReservationId);
        entitlementReservationId = null;
        return json({
          structured: {
            clarification_needed: true,
            questions: followupQuestions,
            recommended_duration_weeks: w,
            rationale: str(b.rationale, 500) || "VOW needs one more detail before it can build a reliable, personalised plan.",
          },
        });
      }
      const validationContext = [str(g?.title || g?.outcome, 500), str(g?.why_it_matters, 300), message]
        .filter(Boolean)
        .join(" ");
      let validationError = validatePlan(b, w, ds, validationContext, g?.schedule_times_enabled === true);
      if (validationError === "GENERIC_SESSION_TASK" || validationError === "REPETITIVE_SCHEDULE") {
        console.warn("[VOW AI] Plan failed quality validation; retrying once with corrective instructions", {
          validation_error: validationError,
        });
        try {
          const retry = await ai(req, [
            ...planMessages,
            { role: "assistant", content: JSON.stringify(b) },
            {
              role: "user",
              content: `Rewrite the complete plan JSON. The previous draft failed VOW's quality check: ${validationError}. Keep the same goal, duration, selected days, and user answers. Every scheduled session task must be concrete, distinct, domain-specific, and at least six words long. Never use generic tasks such as "work on your goal", "practise more", "make progress", or "review the topic". For cooking goals, name a real recipe action such as ingredient preparation, boiling and timing pasta, simmering sauce, tasting, or plating; do not just say “make dinner”. For kickboxing, name the specific drill, technique, round structure, safety focus, or measurable skill; adapt examples to the actual goal. Make each week progress from the previous week. Preserve every required JSON field and return JSON only.`,
            },
          ], "plan", researchRequired);
          if (retry?.clarification_needed !== true) {
            b = retry;
            validationError = validatePlan(b, w, ds, validationContext, g?.schedule_times_enabled === true);
            console.log("[VOW AI] Plan quality retry completed", {
              validation_error: validationError || "passed",
            });
          } else {
            console.warn("[VOW AI] Plan quality retry requested clarification; retaining the original validation failure.");
          }
        } catch (retryError) {
          console.warn("[VOW AI] Plan quality retry failed", {
            validation_error: validationError,
            error: retryError instanceof Error ? retryError.message : String(retryError),
          });
        }
      }
      if (validationError) {
        console.warn("plan validation failed", { validation_error: validationError });
        const qualityAlertType =
          validationError === "GENERIC_SESSION_TASK"
            ? "generic_plan_blocked"
            : validationError === "REPETITIVE_SCHEDULE"
            ? "repetitive_plan_blocked"
            : "plan_quality_blocked";
        await recordQualityAlert(
          req,
          uid,
          typeof p?.goal_id === "string" ? p.goal_id : null,
          "goal-plan",
          qualityAlertType,
          validationError,
          str(g?.title || g?.outcome, 300),
          {
            available_days: ds,
            duration_weeks: w,
            research_required: researchRequired,
            knowledge_entries: knowledge.length,
          }
        );
        await releasePlanningEntitlement(req, entitlementReservationId);
        entitlementReservationId = null;
        return json(
          {
            error: "VOW AI returned a plan that did not meet VOW's planning quality checks. Please try again.",
            code: validationError,
            quality_alert: qualityAlertType,
          },
          502
        );
      }

      const milestones = Array.isArray(b?.milestones)
        ? b.milestones
            .slice(0, 12)
            .map((m: any) => ({
              title: str(m?.title, 200),
              description: str(m?.description, 600),
              week: Math.max(1, Math.min(w, Math.round(Number(m?.week) || 1))),
            }))
            .filter((m: any) => m.title)
        : [];
      if (!milestones.length) {
        await releasePlanningEntitlement(req, entitlementReservationId);
        entitlementReservationId = null;
        return json(
          { error: "VOW AI returned a plan without valid milestones. Please try again." },
          502
        );
      }
      const result = {
        ...b,
        duration_weeks: w,
        weekly_commitment_target: ds.length,
        available_days: ds,
        milestones,
        schedule: schedule(
          b,
          w,
          ds,
          str(g?.start_date) || new Date().toISOString().slice(0, 10)
        ),
      };
      await record(req, "goal-plan", "success", Date.now() - startedAt);
      await finalizePlanningEntitlement(req, entitlementReservationId);
      entitlementFinalized = true;
      return json({ structured: result, text: JSON.stringify(result) });
    }
    let r: any;
    try {
      r = await ai(req,
        [
          {
            role: "system",
            content:
              "You are VOW AI, a multilingual coaching assistant. The user's selected language code is " + preferredLanguage + ". Understand the user's actual input language and respond naturally in that language unless the user explicitly asks for another. Do not fail because the user writes in French, Turkish, Greek, Swahili, Arabic, or another language. Use the supplied VOW knowledge base first, then web research when current or specialist information would improve the answer. Preserve user privacy and never reveal internal user data. Return a JSON object with a single string field named text containing the complete answer. Do not return the answer under response, answer, message, or any other key.",
          },
          { role: "user", content: JSON.stringify({ message, ...context }) },
        ],
        "chat",
        researchRequired
      );
    } catch (e) {
      console.warn("chat AI failed", e);
      throw e;
    }
    await record(req, "chat", "success", Date.now() - startedAt);
    await finalizePlanningEntitlement(req, entitlementReservationId);
    entitlementFinalized = true;
    const chatText = typeof r === "string"
      ? str(r, 1600)
      : str(r?.text ?? r?.output_text ?? r?.response ?? r?.answer, 1600);
    return json({
      text: chatText || "I couldn't generate a response right now.",
    });
  } catch (e) {
    if (entitlementReservationId && !entitlementFinalized) {
      await releasePlanningEntitlement(req, entitlementReservationId);
      entitlementReservationId = null;
    }
    const m = e instanceof Error ? e.message : String(e);
    const telemetryMode =
      mode === "goal-clarify" || mode === "goal-plan" || mode === "chat"
        ? mode
        : "chat";
    const blocked =
      m === "AI_CONCURRENCY_LIMIT" ||
      m === "AI_USER_DAILY_LIMIT" ||
      m === "AI_USER_MONTHLY_LIMIT" ||
      m === "AI_GLOBAL_DAILY_BUDGET" ||
      m === "AI_GLOBAL_MONTHLY_BUDGET";
    const telemetryCode =
      blocked
        ? m
        : [
            "GROQ_429",
            "AI_USAGE_CHECK_FAILED",
            "AI_GUARDRAIL_CHECK_FAILED",
            "AI_CONCURRENCY_LIMIT",
            "AI_USER_DAILY_LIMIT",
            "AI_USER_MONTHLY_LIMIT",
            "AI_GLOBAL_DAILY_BUDGET",
            "AI_GLOBAL_MONTHLY_BUDGET",
            "ENTITLEMENT_CHECK_FAILED",
            "ENTITLEMENT_RESERVATION_FAILED",
            "ENTITLEMENT_FINALIZE_FAILED",
            "GROQ_API_KEY_MISSING",
            "MISTRAL_API_KEY_MISSING",
            "QWEN_API_KEY_MISSING",
            "NOVA_API_KEY_MISSING",
            "MISTRAL_429",
            "QWEN_429",
            "NOVA_429",
            "OPENAI_API_KEY_MISSING",
            "AI_RESEARCH_NOT_PERFORMED",
            "GROQ_EMPTY_RESPONSE",
            "MISTRAL_EMPTY_RESPONSE",
            "INVALID_AI_JSON",
          ].includes(m)
          ? m
          : "AI_REQUEST_FAILED";
    if (uid) {
      await record(
        req,
        telemetryMode,
        blocked ? "blocked" : "error",
        Date.now() - startedAt,
        telemetryCode
      );
    }
    console.error("vow-goal-ai", { mode, error_code: telemetryCode });
    if (m === "GROQ_429" || m === "MISTRAL_429" || m === "QWEN_429" || m === "NOVA_429")
      return json(
        { error: "VOW AI is temporarily busy. Please try again shortly." },
        429,
        { "Retry-After": "30" }
      );
    if (m === "AI_USAGE_CHECK_FAILED")
      return json(
        { error: "VOW AI could not check availability. Please try again." },
        503
      );
    if (m === "AI_GUARDRAIL_CHECK_FAILED")
      return json({ error: "VOW AI safety controls could not be checked. Please try again." }, 503);
    if (m === "AI_RESEARCH_NOT_PERFORMED")
      return json({ error: "VOW AI could not verify an ambiguous goal term with live research. Please try again." }, 503);
    if (m === "AI_CONCURRENCY_LIMIT")
      return json({ error: "VOW AI is already processing another request for you. Please wait a moment." }, 429, { "Retry-After": "15" });
    if (m === "AI_USER_DAILY_LIMIT" || m === "AI_USER_MONTHLY_LIMIT")
      return json({ error: "You have reached your VOW AI usage limit for this period." }, 429);
    if (m === "AI_GLOBAL_DAILY_BUDGET" || m === "AI_GLOBAL_MONTHLY_BUDGET")
      return json({ error: "VOW AI is temporarily at its usage safety limit. Please try again later." }, 503);
    if (m === "ENTITLEMENT_CHECK_FAILED" || m === "ENTITLEMENT_RESERVATION_FAILED" || m === "ENTITLEMENT_FINALIZE_FAILED")
      return json(
        { error: "VOW AI could not verify your plan. Please try again." },
        503
      );
    if (mode === "goal-clarify") {
      return json(
        { error: "VOW AI could not generate clarification questions right now. Please try again." },
        503
      );
    }
    if (mode === "goal-plan") {
      return json(
        { error: "VOW AI could not build a plan right now. Please try again." },
        503
      );
    }
    if (
      m === "GROQ_API_KEY_MISSING" ||
      m === "MISTRAL_API_KEY_MISSING" ||
      m === "QWEN_API_KEY_MISSING" ||
      m === "NOVA_API_KEY_MISSING" ||
      m === "AI_PROVIDER_UNAVAILABLE"
    )
      return json({ error: "VOW AI is temporarily unavailable." }, 503);
    return json(
      {
        error:
          "VOW AI could not complete that request right now. Please try again.",
      },
      500
    );
  }
});
