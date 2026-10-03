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
const MAX = { plan: 4000, clarify: 1200, chat: 700 };
const COOLDOWN = { plan: 120000, clarify: 30000, chat: 10000 };
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
    const a = t.indexOf("{"),
      b = t.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
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
async function cooldown(uid: string, k: keyof typeof COOLDOWN) {
  const { data, error } = await db().rpc("vow_claim_ai_cooldown", {
    p_user_id: uid,
    p_kind: k,
    p_cooldown_seconds: COOLDOWN[k] / 1000,
  });
  if (error) throw new Error("AI_USAGE_CHECK_FAILED");
  const wait = Number(data);
  if (!Number.isInteger(wait) || wait < 0)
    throw new Error("AI_USAGE_CHECK_FAILED");
  return wait;
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
  if (error) throw new Error("ENTITLEMENT_RESERVATION_FAILED");
  if (!data || typeof data !== "object")
    throw new Error("ENTITLEMENT_RESERVATION_FAILED");
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
  try {
    const { data, error } = await db().rpc("match_vow_knowledge_keyword", {
      query_text: query.trim().slice(0, 1000),
      domain_filter: null,
      match_count: 12,
    });
    if (error) {
      console.warn("knowledge search", error.message);
      return [];
    }
    return (data || [])
      .slice(0, 12)
      .map((x: any) => ({
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

async function callGroq(req: Request, messages: any[], kind: keyof typeof MAX, researchRequired: boolean) {
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) throw new Error("GROQ_API_KEY_MISSING");

  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), 35000);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "Groq-Model-Version": "latest",
        },
        signal: c.signal,
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          messages,
          max_completion_tokens: MAX[kind],
          temperature: 0.15,
          reasoning_effort: "low",
          tools: [{ type: "browser_search" }],
          tool_choice: researchRequired ? "required" : "auto",
        }),
      });

      const raw = await r.text();
      if (r.ok) {
        const payload = JSON.parse(raw);
        const message = payload?.choices?.[0]?.message;
        const executedTools = Array.isArray(message?.executed_tools) ? message.executed_tools : [];
        const usedWebSearch = executedTools.some((tool: any) => {
          const serialized = JSON.stringify(tool).toLowerCase();
          return serialized.includes("web_search") || serialized.includes("browser_search");
        });
        if (researchRequired && !usedWebSearch) throw new Error("AI_RESEARCH_NOT_PERFORMED");

        const content = message?.content;
        if (typeof content !== "string" || !content.trim()) throw new Error("GROQ_EMPTY_RESPONSE");
        return parse(content);
      }

      if (r.status === 429 && attempt === 0) {
        const delay = retryDelayMs(r, attempt);
        console.warn("Groq rate limited; retrying once", { delay_ms: delay });
        await sleep(delay);
        continue;
      }

      console.error("Groq provider error", { status: r.status });
      if (r.status === 429) throw new Error("GROQ_429");
      throw new Error(`GROQ_PROVIDER_ERROR_${r.status}`);
    }

    throw new Error("GROQ_429");
  } finally {
    clearTimeout(timer);
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

async function ai(req: Request, messages: any[], kind: keyof typeof MAX, researchRequired = false) {
  const requestId = await claimGuardrail(req);
  try {
    try {
      return await callGroq(req, messages, kind, researchRequired);
    } catch (groqError) {
      console.warn(
        "Groq failed, attempting OpenAI fallback...",
        groqError instanceof Error ? groqError.message : String(groqError)
      );

      // OpenAI Chat Completions does not provide the browser-search tool used by
      // the Groq path, so never claim research was performed when it was required.
      if (researchRequired) throw groqError;

      if (Deno.env.get("OPENAI_API_KEY")) {
        try {
          const result = await callOpenAI(req, messages, kind);
          console.log("OpenAI fallback succeeded after Groq failure");
          return result;
        } catch (openaiError) {
          console.error(
            "OpenAI fallback also failed",
            openaiError instanceof Error ? openaiError.message : String(openaiError)
          );
          throw groqError;
        }
      }

      throw groqError;
    }
  } finally {
    await releaseGuardrail(req, requestId);
  }
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

function validatePlan(b: any, w: number, ds: string[], goalContext = "") {
  const milestones = Array.isArray(b?.milestones) ? b.milestones : [];
  const focus = Array.isArray(b?.weekly_focus) ? b.weekly_focus : [];
  const weekly = Array.isArray(b?.weekly_session_templates) ? b.weekly_session_templates : [];
  if (milestones.length < 2) return "INSUFFICIENT_MILESTONES";
  if (focus.length < w) return "INSUFFICIENT_WEEKLY_FOCUS";
  if (w <= 16 && weekly.length < w) return "INSUFFICIENT_WEEKLY_SESSIONS";

  const planned = schedule(b, w, ds, str(b?.start_date) || new Date().toISOString().slice(0, 10));
  if (planned.length !== w * ds.length) return "INCOMPLETE_SCHEDULE";

  const tasks = planned.map((x: any) => str(x.task, 350).toLowerCase()).filter(Boolean);
  const unique = new Set(tasks);
  if (tasks.length >= 8 && unique.size / tasks.length < 0.55) return "REPETITIVE_SCHEDULE";

  const generic = /^(work on|make progress on|continue working on|review your goal|do your task|practice more|practise more|keep practicing|keep practising|spend (some )?time|focus on improving|work through|learn more about|study the topic|practice the basics|practise the basics)\b/i;
  const vague = /^(do|work|practice|practise|study|learn|review|focus)\s+(this|that|it|more|better|the goal|your goal|the topic)\b/i;
  if (planned.some((x: any) => {
    const task = str(x.task, 350);
    return generic.test(task) || vague.test(task) || task.split(/\s+/).filter(Boolean).length < 6;
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
    const hasMeasure = /\b\d+(?:[.,]\d+)?\s*(?:%|minutes?|mins?|hours?|km|miles?|reps?|sets?|pages?|words?|items?|sessions?|days?|seconds?|points?|kg|lb)\b/i.test(task);
    const hasConcreteVerb = /\b(analy[sz]e|build|calculate|complete|create|draft|edit|film|identify|measure|mix|outline|perform|record|solve|write|draw|bake|knead|shape|letter|paint|run|cycle|swim|lift|code|debug|test|revise|compare|read|summari[sz]e|translate|memorise|memorize|recite|drill|trace|copy|compose|schedule|plan|track|time|score|review)\b/i.test(task);
    if (!overlapsContext && !hasMeasure) weakSpecificity++;
    else if (!hasConcreteVerb && !hasMeasure) weakSpecificity++;
  }
  if (planned.length && weakSpecificity / planned.length > 0.25) return "GENERIC_SESSION_TASK";
  return null;
}

function schedule(b: any, w: number, ds: string[], startDate: string) {
  const weekly = Array.isArray(b?.weekly_session_templates)
    ? b.weekly_session_templates
        .map((week: any) => ({
          week: Math.max(1, Math.min(w, Math.round(Number(week?.week) || 1))),
          sessions: Array.isArray(week?.sessions)
            ? week.sessions.filter((x: any) =>
                ds.some((d) => d.toLowerCase() === String(x?.day || "").toLowerCase())
              ).slice(0, ds.length)
            : [],
        }))
        .filter((week: any) => week.sessions.length)
    : [];

  const rawTemplates = Array.isArray(b?.session_templates) ? b.session_templates : [];
  const templates = rawTemplates.length ? rawTemplates : ds.map((day, idx) => ({
    day,
    task: str(b?.weekly_focus?.[0], 350) || `Core session ${idx + 1} for ${str(b?.outcome, 100) || "your goal"}`,
    purpose: str(b?.success_metric, 350) || "Make measurable progress toward the milestone target.",
    target_metric: str(b?.success_metric, 180) || "Complete planned execution block",
    duration_minutes: 30,
    preferred_time: "09:00",
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

      const explicit = explicitWeek?.sessions?.find(
        (x: any) => String(x?.day || "").toLowerCase() === day.toLowerCase()
      );
      const template =
        explicit ||
        templates.find((x: any) => DAYS.includes(x?.day) && x.day.toLowerCase() === day.toLowerCase()) ||
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
        preferred_time: /^\d{1,2}:\d{2}$/.test(str(template?.preferred_time, 10))
          ? template.preferred_time
          : "09:00",
        scheduled_at: d.toISOString(),
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
    const wait = await cooldown(uid, kind);
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
    const feature = adaptive ? "adaptive_replan" : "planning_action";
    const entitlement = await reservePlanningEntitlement(req, feature, {
      goal_id: typeof p?.goal_id === "string" ? p.goal_id : null,
      prompt_type: feature,
      request_id: crypto.randomUUID(),
    });
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
    const knowledgeQuery = [
      str(g?.title || g?.outcome, 500),
      str(g?.why_it_matters, 300),
      ...answers.map((a: any) => str(a.answer, 350)),
      message.slice(0, 700),
    ]
      .filter(Boolean)
      .join(" ");
    const { data: userGoals } = await client(req)
      .from("goals")
      .select("title, outcome, why_it_matters, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: userJournal } = await client(req)
      .from("journal_entries")
      .select("body, created_at, linked_goal_id")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(10);

    const knowledge = await searchKnowledge(knowledgeQuery);
    const researchRequired =
      domain?.needs_ai_research === true ||
      detectAmbiguousTerms(message) ||
      detectAmbiguousTerms(g?.outcome || "");
    const context = {
      goal: {
        title: str(g?.title || g?.outcome, 300),
        outcome: str(g?.outcome, 500),
        why_it_matters: str(g?.why_it_matters, 500),
        duration_weeks: w,
        available_days: ds,
        start_date: str(g?.start_date, 30),
        deadline: str(g?.deadline, 30),
      },
      answers,
      references: refs,
      preferred_language: preferredLanguage,
      previousGoals: userGoals || [],
      journalEntries: userJournal || [],
      knowledge,
    };
    let fallbackCategory = domain?.category;
    if (fallbackCategory === "Unknown" || fallbackCategory === "General") {
      try {
        const classResult = await ai(req, [
          {
            role: "system",
            content: `Classify the user's goal into exactly one of these supported categories: Sports, Languages, Crafts/Hobbies, Education, Reading, Mindfulness, Technology/Projects, Career/Projects, Personal Development, Life Admin, Communication, Wellbeing, Creative Skills, Travel, Learning, Practical Skills, Finance, Productivity. If the goal involves a specific event, competition, or ambiguous term, use web search to understand it first. Return ONLY JSON: {"category": "string"}. Do not return 'General'.`
          },
          { role: "user", content: `Goal: ${str(g?.title || g?.outcome, 300)}. Context: ${str(g?.why_it_matters, 500)}` }
        ], "clarify", researchRequired);
        
        const validCategories = ["Sports", "Languages", "Crafts/Hobbies", "Education", "Reading", "Mindfulness", "Technology/Projects", "Career/Projects", "Personal Development", "Life Admin", "Communication", "Wellbeing", "Creative Skills", "Travel", "Learning", "Practical Skills", "Finance", "Productivity"];
        
        if (classResult && typeof classResult.category === "string" && validCategories.includes(classResult.category)) {
           fallbackCategory = classResult.category;
           domain.category = fallbackCategory;
        } else {
           fallbackCategory = "Personal Development";
           domain.category = fallbackCategory;
        }
      } catch (e) {
        console.warn("Groq fallback classification failed", e);
        fallbackCategory = "Personal Development";
        domain.category = fallbackCategory;
      }
    }

    if (mode === "goal-clarify") {
      let r: any;
      try {
        r = await ai(req,
          [
            {
              role: "system",
              content: `You are VOW's specialist goal-discovery researcher. Respond in the user's selected language (language code: ${preferredLanguage}) unless the user explicitly asks for another language. Preserve structured JSON keys in English. Use the supplied VOW knowledge base, domain profile, previous goals, and recent journal context as your first planning reference. Use previous goals and journal entries only to personalise the plan when they are relevant to the current goal. Return ONLY JSON: {questions:[string,string,string],recommended_duration_weeks:number,rationale:string}. Ask high-value questions that resolve the most important missing inputs for this exact domain. If AI research is required, you MUST use the built-in web_search tool before deciding what an ambiguous abbreviation, event, competition, slang term, or specialist phrase means. Never ask generic questions when domain-specific ones are possible. Do not ask for information already supplied. If the user says they do not know, ask a smaller decision question that helps them choose; do not proceed as if the missing information does not matter. Domain profile: ${JSON.stringify(domain)}`,
            },
            { role: "user", content: JSON.stringify({ message, ...context }) },
          ],
          "clarify",
          researchRequired
        );
      } catch (e) {
        console.warn("clarify AI error", e);
        throw e;
      }
      const questions = arr(r.questions, 3).slice(0, 3);
      if (questions.length < 2) {
        await releasePlanningEntitlement(req, entitlementReservationId);
        entitlementReservationId = null;
        return json(
          { error: "VOW AI returned insufficient clarification questions. Please try again." },
          502
        );
      }
      r.questions = questions;
      r.recommended_duration_weeks = Math.min(
        52,
        Math.max(1, Number(r.recommended_duration_weeks) || w)
      );
      r.rationale = str(r.rationale, 500);
      await record(req, "goal-clarify", "success", Date.now() - startedAt);
      await finalizePlanningEntitlement(req, entitlementReservationId);
      entitlementFinalized = true;
      return json({ structured: r, text: JSON.stringify(r) });
    }
    if (mode === "goal-plan") {
      let b: any;
      try {
        b = await ai(req,
          [
            {
              role: "system",
              content: `You are VOW's expert planning and research engine. Respond in the user's selected language (language code: ${preferredLanguage}) unless the user explicitly asks for another language. Preserve structured JSON keys in English. Build the best practical plan for the exact goal. The VOW knowledge base, domain profile, previous goals, and recent journal context are core references: use relevant entries to ground methodology, actions, metrics and cautions before using web research. Use real-time web search and visit authoritative sources when current or specialist information can improve the plan. If AI research is required, you MUST perform at least one web_search before selecting or finalising the specialist domain; do not guess what an abbreviation, event, competition, slang term, or specialist phrase means. Prefer primary sources, respected institutions and recognised expert frameworks; synthesise research rather than dumping links. If a required input is genuinely missing, return JSON with clarification_needed:true and questions instead of a generic plan. Use previous goals and recent journal entries as personal context when relevant, but never expose unrelated private details or assume that past goals must continue. Never fill missing personal context with boilerplate. Return a references array only for genuinely relevant public resources, preferably a useful YouTube resource when one materially helps the exact goal and level. Duration (${w} weeks) and available days (${ds.join(
                ", "
              )}) are HARD constraints. Follow-up answers are HARD personal context. Domain profile: ${JSON.stringify(domain)}. Return ONLY JSON with outcome, success_metric, baseline, assumptions, milestones (2-8 objects with title,description,week), weekly_session_templates (one object per week, each containing week and sessions; sessions must contain one concrete, distinct session for each selected day with day,task,purpose,target_metric,duration_minutes,preferred_time), session_templates (fallback template per selected day with day,task,purpose,target_metric,duration_minutes,preferred_time), weekly_focus (exactly one string per week), progression, checkpoints (3-8), risks (3-8), fallback_rules (2-6), summary, references (0-4 objects with url,title,resource_type). Make the plan genuinely domain-specific. Do not invent specialist claims when the knowledge/research does not support them. Each week's sessions must advance that week's focus rather than repeating the same task. Sessions must be concrete enough that the user can execute them without guessing what "work on it" means. Every week must meaningfully progress toward the outcome.`,
            },
            { role: "user", content: JSON.stringify({ message, ...context }) },
          ],
          "plan",
          researchRequired
        );
      } catch (e) {
        console.warn("plan AI failed", e);
        throw e;
      }
      if (b?.clarification_needed === true) {
        const followupQuestions = arr(b.questions, 3).slice(0, 3);
        if (followupQuestions.length < 2) {
          await releasePlanningEntitlement(req, entitlementReservationId);
          entitlementReservationId = null;
          return json(
            { error: "VOW needs more context before it can build a reliable personalised plan. Please add more detail and try again." },
            502
          );
        }
        await releasePlanningEntitlement(req, entitlementReservationId);
        entitlementReservationId = null;
        return json({
          structured: {
            clarification_needed: true,
            questions: followupQuestions,
            recommended_duration_weeks: w,
            rationale: str(b.rationale, 500) || "VOW needs a bit more detail before it can build a reliable plan.",
          },
        });
      }
      const validationError = validatePlan(
        b,
        w,
        ds,
        [str(g?.title || g?.outcome, 500), str(g?.why_it_matters, 300), message]
          .filter(Boolean)
          .join(" ")
      );
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
              "You are VOW AI, a multilingual coaching assistant. The user's selected language code is " + preferredLanguage + ". Understand the user's actual input language and respond naturally in that language unless the user explicitly asks for another. Do not fail because the user writes in French, Turkish, Greek, Swahili, Arabic, or another language. Use the supplied VOW knowledge base first, then web research when current or specialist information would improve the answer. Preserve user privacy and never reveal internal user data.",
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
    return json({
      text: str(r?.text, 1600) || "I couldn't generate a response right now.",
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
            "OPENAI_API_KEY_MISSING",
            "AI_RESEARCH_NOT_PERFORMED",
            "GROQ_EMPTY_RESPONSE",
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
    if (m === "GROQ_429")
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
    if (m === "GROQ_API_KEY_MISSING")
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