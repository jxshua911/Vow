/* eslint-disable @typescript-eslint/no-explicit-any */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
async function consumePlanningEntitlement(
  req: Request,
  feature: "planning_action" | "adaptive_replan",
  metadata: Record<string, unknown>
) {
  const { data, error } = await client(req).rpc("vow_consume_entitlement", {
    p_feature: feature,
    p_metadata: metadata,
  });
  if (error) throw new Error("ENTITLEMENT_CHECK_FAILED");
  if (!data || typeof data !== "object")
    throw new Error("ENTITLEMENT_CHECK_FAILED");
  return (data as Record<string, unknown>).allowed === true
    ? null
    : (data as Record<string, unknown>);
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

async function ai(req: Request, messages: any[], kind: keyof typeof MAX) {
  const requestId = await claimGuardrail(req);
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) {
    await releaseGuardrail(req, requestId);
    throw new Error("GROQ_API_KEY_MISSING");
  }
  const c = new AbortController(),
    timer = setTimeout(() => c.abort(), 35000);
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "Groq-Model-Version": "latest",
      },
      signal: c.signal,
      body: JSON.stringify({
        model: "groq/compound",
        messages,
        max_completion_tokens: MAX[kind],
        temperature: 0.15,
        compound_custom: {
          tools: { enabled_tools: ["web_search", "visit_website"] },
        },
      }),
    });
    const raw = await r.text();
    if (!r.ok) {
      console.error("Groq", r.status, raw.slice(0, 1200));
      if (r.status === 429) throw new Error("GROQ_429");
      throw new Error(`GROQ_PROVIDER_ERROR_${r.status}`);
    }
    const content = JSON.parse(raw)?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim())
      throw new Error("GROQ_EMPTY_RESPONSE");
    return parse(content);
  } finally {
    clearTimeout(timer);
    await releaseGuardrail(req, requestId);
  }
}
function schedule(b: any, w: number, ds: string[], startDate: string) {
  const rawTemplates = Array.isArray(b?.session_templates) ? b.session_templates : [];
  const templates = rawTemplates.length
    ? rawTemplates
    : ds.map((day, idx) => ({
        day,
        task: str(b?.weekly_focus?.[0], 350) || `Core session ${idx + 1} for ${str(b?.outcome, 100) || "your goal"}`,
        purpose: str(b?.success_metric, 350) || "Make measurable progress toward the milestone target.",
        target_metric: str(b?.success_metric, 180) || "Complete planned execution block",
        duration_minutes: 30,
        preferred_time: "09:00",
      }));
  const focus =
    Array.isArray(b?.weekly_focus) && b.weekly_focus.length
      ? b.weekly_focus
      : [str(b?.summary, 350) || `Focus on progressing ${str(b?.outcome, 100) || "your goal"}`];
  const out: any[] = [];
  const start = new Date(
    `${startDate || new Date().toISOString().slice(0, 10)}T09:00:00`
  );
  const monday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - monday);
  for (let week = 1; week <= w; week++)
    for (const day of ds) {
      const d = new Date(start);
      d.setDate(d.getDate() + (week - 1) * 7 + DAYS.indexOf(day));
      const template =
        templates.find(
          (x: any) =>
            DAYS.includes(x?.day) && x.day.toLowerCase() === day.toLowerCase()
        ) || templates[(week - 1) % templates.length];
      const f = str(focus[Math.min(week - 1, focus.length - 1)], 350);
      const task = str(template?.task, 350) || f;
      out.push({
        week,
        day,
        task,
        purpose: [str(template?.purpose, 350), f].filter(Boolean).join(" "),
        target_metric:
          str(template?.target_metric, 180) ||
          str(b?.success_metric, 180) ||
          "Complete the planned work",
        duration_minutes: Math.max(
          5,
          Math.min(240, Number(template?.duration_minutes) || 30)
        ),
        preferred_time: /^\d{1,2}:\d{2}$/.test(
          str(template?.preferred_time, 10)
        )
          ? template.preferred_time
          : "09:00",
        scheduled_at: d.toISOString(),
      });
    }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  let mode = "chat";
  let uid = "";
  const startedAt = Date.now();
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
    const message0 = str(p?.message, 3000);
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
    const entitlement = await consumePlanningEntitlement(req, feature, {
      goal_id: typeof p?.goal_id === "string" ? p.goal_id : null,
      prompt_type: feature,
    });
    if (entitlement)
      return json(
        {
          error: "This VOW AI feature is not available on your current plan.",
          entitlement,
        },
        403
      );
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
    const knowledge = await searchKnowledge(knowledgeQuery);
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
      knowledge,
    };
    if (mode === "goal-clarify") {
      let r: any;
      try {
        r = await ai(req,
          [
            {
              role: "system",
              content: `You are VOW's specialist goal-discovery researcher. Use the supplied VOW knowledge base and domain profile as your first planning reference. Return ONLY JSON: {questions:[string,string,string],recommended_duration_weeks:number,rationale:string}. Ask high-value questions that resolve the most important missing inputs for this exact domain. Never ask generic questions when domain-specific ones are possible. Do not ask for information already supplied. If the user says they do not know, ask a smaller decision question that helps them choose; do not proceed as if the missing information does not matter. Domain profile: ${JSON.stringify(domain)}`,
            },
            { role: "user", content: JSON.stringify({ message, ...context }) },
          ],
          "clarify"
        );
      } catch (e) {
        console.warn("clarify AI error", e);
        throw e;
      }
      const questions = arr(r.questions, 3).slice(0, 3);
      if (questions.length < 2) {
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
      return json({ structured: r, text: JSON.stringify(r) });
    }
    if (mode === "goal-plan") {
      let b: any;
      try {
        b = await ai(req,
          [
            {
              role: "system",
              content: `You are VOW's expert planning and research engine. Build the best practical plan for the exact goal. The VOW knowledge base and domain profile are core references: use relevant entries to ground methodology, actions, metrics and cautions before using web research. Use real-time web search and visit authoritative sources when current or specialist information can improve the plan. Prefer primary sources, respected institutions and recognised expert frameworks; synthesise research rather than dumping links. If a required input is genuinely missing, return JSON with clarification_needed:true and questions instead of a generic plan. Never fill missing personal context with boilerplate. Return a references array only for genuinely relevant public resources, preferably a useful YouTube resource when one materially helps the exact goal and level. Duration (${w} weeks) and available days (${ds.join(
                ", "
              )}) are HARD constraints. Follow-up answers are HARD personal context. Domain profile: ${JSON.stringify(domain)}. Return ONLY JSON with outcome, success_metric, baseline, assumptions, milestones (2-8 objects with title,description,week), session_templates (one object per selected day with day,task,purpose,target_metric,duration_minutes,preferred_time), weekly_focus (one string per week), progression, checkpoints (3-8), risks (3-8), fallback_rules (2-6), summary, references (0-4 objects with url,title,resource_type). Make the plan genuinely domain-specific. Do not invent specialist claims when the knowledge/research does not support them. For each selected day, choose a distinct high-value session/task when the domain supports it. Every week must meaningfully progress toward the outcome.`,
            },
            { role: "user", content: JSON.stringify({ message, ...context }) },
          ],
          "plan"
        );
      } catch (e) {
        console.warn("plan AI failed", e);
        throw e;
      }
      if (b?.clarification_needed === true) {
        const followupQuestions = arr(b.questions, 3).slice(0, 3);
        if (followupQuestions.length < 2) {
          return json(
            { error: "VOW needs more context before it can build a reliable personalised plan. Please add more detail and try again." },
            502
          );
        }
        return json({
          structured: {
            clarification_needed: true,
            questions: followupQuestions,
            recommended_duration_weeks: w,
            rationale: str(b.rationale, 500) || "VOW needs a bit more detail before it can build a reliable plan.",
          },
        });
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
      return json({ structured: result, text: JSON.stringify(result) });
    }
    let r: any;
    try {
      r = await ai(req,
        [
          {
            role: "system",
            content:
              "You are VOW AI. Answer helpfully and briefly. Use the supplied VOW knowledge base first, then web research when current or specialist information would improve the answer.",
          },
          { role: "user", content: JSON.stringify({ message, ...context }) },
        ],
        "chat"
      );
    } catch (e) {
      console.warn("chat AI failed", e);
      throw e;
    }
    await record(req, "chat", "success", Date.now() - startedAt);
    return json({
      text: str(r?.text, 1600) || "I couldn't generate a response right now.",
    });
  } catch (e) {
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
    if (uid) {
      await record(
        req,
        telemetryMode,
        blocked ? "blocked" : "error",
        Date.now() - startedAt,
        m
      );
    }
    console.error("vow-goal-ai", { mode, message: m });
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
    if (m === "AI_CONCURRENCY_LIMIT")
      return json({ error: "VOW AI is already processing another request for you. Please wait a moment." }, 429, { "Retry-After": "15" });
    if (m === "AI_USER_DAILY_LIMIT" || m === "AI_USER_MONTHLY_LIMIT")
      return json({ error: "You have reached your VOW AI usage limit for this period." }, 429);
    if (m === "AI_GLOBAL_DAILY_BUDGET" || m === "AI_GLOBAL_MONTHLY_BUDGET")
      return json({ error: "VOW AI is temporarily at its usage safety limit. Please try again later." }, 503);
    if (m === "ENTITLEMENT_CHECK_FAILED")
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