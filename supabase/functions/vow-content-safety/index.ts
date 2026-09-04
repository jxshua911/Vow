import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: CORS });
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function secret() {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    if (keys.default) return keys.default;
  } catch {}
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

function authClient(req: Request) {
  let key = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!key) {
    try { key = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default || ""; } catch {}
  }
  return createClient(Deno.env.get("SUPABASE_URL")!, key, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
}

function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, secret(), { auth: { persistSession: false, autoRefreshToken: false } });
}

function normalise(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
}

function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return req.headers.get("cf-connecting-ip")?.trim() || forwarded || req.headers.get("x-real-ip")?.trim() || null;
}

async function hashIp(ip: string) {
  const material = `${secret()}:${ip.trim()}`;
  const bytes = new TextEncoder().encode(material);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function getActiveIpBan(ip: string | null) {
  if (!ip || !secret()) return null;
  const ipHash = await hashIp(ip);
  const { data, error } = await adminClient()
    .from("moderation_ip_bans")
    .select("banned_until, reason")
    .eq("ip_hash", ipHash)
    .maybeSingle();
  if (error) throw new Error("MODERATION_IP_LOOKUP_FAILED");
  if (!data) return null;
  if (data.banned_until && new Date(data.banned_until).getTime() <= Date.now()) return null;
  return data;
}

type Classification = {
  status: "safe" | "ambiguous" | "blocked";
  category: "none" | "threat" | "sexual_violence" | "child_safety" | "violent_harm" | "self_harm" | "abuse" | "ambiguous_action";
  severity: "ambiguous" | "high" | "critical";
  confidence: number;
  message: string;
};

function classify(input: string): Classification {
  const text = normalise(input);
  const criticalPatterns = [
    /\b(?:rape|sexual assault|force someone sexually|sexually assault)\b/i,
    /\b(?:sexually exploit|exploit (?:a|an|the) child|child sexual abuse|sexual abuse of (?:a|an|the) child)\b/i,
  ];
  if (criticalPatterns.some((pattern) => pattern.test(text))) {
    return { status: "blocked", category: text.includes("child") ? "child_safety" : "sexual_violence", severity: "critical", confidence: 0.99, message: "This wording can't be used in VOW because it appears to describe serious abuse or sexual violence." };
  }

  const highPatterns = [
    /\b(?:i will|i'm going to|im going to|gonna|plan to|want to|intend to)\b.{0,80}\b(?:kill|murder|hurt|attack|stab|shoot|beat|kidnap)\b/i,
    /\b(?:kill|murder|hurt|attack|stab|shoot|beat|kidnap)\b.{0,80}\b(?:him|her|them|someone|somebody|a person)\b/i,
    /\b(?:threaten|terrorise|terrorize|blackmail)\b.{0,80}\b(?:him|her|them|someone|somebody)\b/i,
  ];
  if (highPatterns.some((pattern) => pattern.test(text))) {
    return { status: "blocked", category: "threat", severity: "high", confidence: 0.95, message: "This wording can't be used in VOW because it appears to describe a serious threat or intent to harm someone." };
  }

  const selfHarmPatterns = [/\b(?:kill myself|end my life|suicide|self-harm|self harm)\b/i];
  if (selfHarmPatterns.some((pattern) => pattern.test(text))) {
    return { status: "blocked", category: "self_harm", severity: "high", confidence: 0.96, message: "That wording needs a safer, clearer direction before VOW can continue." };
  }

  const ambiguousPatterns = [
    /\b(?:eat|consume|cook|hunt|kill)\b\s+(?:kids?|children|people|humans?)\b/i,
    /\b(?:hurt|attack|beat|destroy)\b\s+(?:kids?|children|someone|somebody|people)\b/i,
    /\b(?:do|make|get)\b\s+(?:something|stuff)\b.*\b(?:to|with)\b\s+(?:someone|somebody|a person)\b/i,
  ];
  if (ambiguousPatterns.some((pattern) => pattern.test(text))) {
    return { status: "ambiguous", category: "ambiguous_action", severity: "ambiguous", confidence: 0.86, message: "VOW isn't accusing you of anything, but this wording could be interpreted in a harmful way. Please reword it so the intended activity is explicit." };
  }

  return { status: "safe", category: "none", severity: "ambiguous", confidence: 0.99, message: "" };
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

async function upsertIpBan(ip: string | null, userId: string, bannedUntil: Date | null, reason: string) {
  if (!ip || !secret()) return;
  const ipHash = await hashIp(ip);
  const db = adminClient();
  const { data: existing, error: existingError } = await db
    .from("moderation_ip_bans")
    .select("id, banned_until")
    .eq("ip_hash", ipHash)
    .maybeSingle();
  if (existingError) throw new Error("MODERATION_IP_LOOKUP_FAILED");

  if (existing?.banned_until === null) return;

  const { error } = existing
    ? await db.from("moderation_ip_bans").update({ user_id: userId, banned_until: bannedUntil?.toISOString() ?? null, reason }).eq("id", existing.id)
    : await db.from("moderation_ip_bans").insert({ ip_hash: ipHash, user_id: userId, banned_until: bannedUntil?.toISOString() ?? null, reason });
  if (error) throw new Error("MODERATION_IP_BAN_FAILED");
}

async function enforceSeriousViolation(userId: string, classification: Classification, ip: string | null) {
  const db = adminClient();
  const { count, error: countError } = await db.from("moderation_events").select("id", { count: "exact", head: true }).eq("user_id", userId).in("severity", ["high", "critical"]);
  if (countError) throw new Error("MODERATION_HISTORY_FAILED");
  const strikeNumber = (count || 0) + 1;
  let action: "suspended" | "banned";
  let banDuration: string;
  let bannedUntil: Date | null = null;
  if (strikeNumber === 1) { action = "suspended"; banDuration = "168h"; bannedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); }
  else if (strikeNumber === 2) { action = "suspended"; banDuration = "1464h"; bannedUntil = addMonths(new Date(), 2); }
  else { action = "banned"; banDuration = "876000h"; }

  const { data: userData, error: userError } = await db.auth.admin.getUserById(userId);
  if (userError || !userData.user) throw new Error("MODERATION_USER_LOOKUP_FAILED");
  const existingMeta = userData.user.app_metadata || {};
  const nextMeta = { ...existingMeta, moderation_strikes: strikeNumber, moderation_status: action === "banned" ? "permanently_banned" : "suspended", moderation_banned_until: bannedUntil ? bannedUntil.toISOString() : null };
  const { error: banError } = await db.auth.admin.updateUserById(userId, { ban_duration: banDuration, app_metadata: nextMeta });
  if (banError) throw new Error("MODERATION_ENFORCEMENT_FAILED");
  await upsertIpBan(ip, userId, bannedUntil, `VOW moderation strike ${strikeNumber}: ${classification.category}`);
  const { error: eventError } = await db.from("moderation_events").insert({ user_id: userId, category: classification.category, severity: classification.severity, confidence: clamp(classification.confidence), action, strike_number: strikeNumber });
  if (eventError) throw new Error("MODERATION_EVENT_RECORD_FAILED");
  return { action, strikeNumber, retryAfterSeconds: bannedUntil ? Math.max(1, Math.ceil((bannedUntil.getTime() - Date.now()) / 1000)) : null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const ip = clientIp(req);
    const ipBan = await getActiveIpBan(ip);
    if (ipBan) {
      return json({ status: "suspended", category: "access_restricted", confidence: 1, message: "Access to VOW is temporarily or permanently restricted from this network address." }, 403);
    }

    if (!(req.headers.get("Authorization") || "").startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);
    const { data, error } = await authClient(req).auth.getUser();
    if (error || !data.user) return json({ error: "Authentication required." }, 401);
    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return json({ status: "safe" });
    const classification = classify(text);
    if (classification.status === "safe" || classification.status === "ambiguous") {
      if (classification.status === "ambiguous") {
        await adminClient().from("moderation_events").insert({ user_id: data.user.id, category: classification.category, severity: classification.severity, confidence: clamp(classification.confidence), action: "reword_required", strike_number: null });
      }
      return json({ status: classification.status, category: classification.category, confidence: classification.confidence, message: classification.message });
    }
    const enforcement = await enforceSeriousViolation(data.user.id, classification, ip);
    const message = enforcement.action === "banned"
      ? "This account has been permanently banned because of repeated serious safety violations, and this network address has also been blocked."
      : enforcement.strikeNumber === 1
        ? "This content was blocked and access to your VOW account and network address has been suspended for 7 days because of a serious safety violation."
        : "This content was blocked and access to your VOW account and network address has been suspended for 2 months because of a repeated serious safety violation.";
    return json({ status: "suspended", category: classification.category, confidence: classification.confidence, message, strike_number: enforcement.strikeNumber, retry_after_seconds: enforcement.retryAfterSeconds });
  } catch (error) {
    console.error("content safety", error);
    return json({ error: "VOW could not complete its safety check." }, 500);
  }
});
