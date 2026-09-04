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
    try {
      key = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default || "";
    } catch {}
  }
  return createClient(Deno.env.get("SUPABASE_URL")!, key, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
  });
}

function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, secret(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalise(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
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
    return {
      status: "blocked",
      category: text.includes("child") ? "child_safety" : "sexual_violence",
      severity: "critical",
      confidence: 0.99,
      message: "This wording can't be used in VOW because it appears to describe serious abuse or sexual violence.",
    };
  }

  const highPatterns = [
    /\b(?:i will|i'm going to|im going to|gonna|plan to|want to|intend to)\b.{0,80}\b(?:kill|murder|hurt|attack|stab|shoot|beat|kidnap)\b/i,
    /\b(?:kill|murder|hurt|attack|stab|shoot|beat|kidnap)\b.{0,80}\b(?:him|her|them|someone|somebody|a person)\b/i,
    /\b(?:threaten|terrorise|terrorize|blackmail)\b.{0,80}\b(?:him|her|them|someone|somebody)\b/i,
  ];
  if (highPatterns.some((pattern) => pattern.test(text))) {
    return {
      status: "blocked",
      category: "threat",
      severity: "high",
      confidence: 0.95,
      message: "This wording can't be used in VOW because it appears to describe a serious threat or intent to harm someone.",
    };
  }

  const selfHarmPatterns = [
    /\b(?:kill myself|end my life|suicide|self-harm|self harm)\b/i,
  ];
  if (selfHarmPatterns.some((pattern) => pattern.test(text))) {
    return {
      status: "blocked",
      category: "self_harm",
      severity: "high",
      confidence: 0.96,
      message: "That wording needs a safer, clearer direction before VOW can continue.",
    };
  }

  const ambiguousPatterns = [
    /\b(?:eat|consume|cook|hunt|kill)\b\s+(?:kids?|children|people|humans?)\b/i,
    /\b(?:hurt|attack|beat|destroy)\b\s+(?:kids?|children|someone|somebody|people)\b/i,
    /\b(?:do|make|get)\b\s+(?:something|stuff)\b.*\b(?:to|with)\b\s+(?:someone|somebody|a person)\b/i,
  ];
  if (ambiguousPatterns.some((pattern) => pattern.test(text))) {
    return {
      status: "ambiguous",
      category: "ambiguous_action",
      severity: "ambiguous",
      confidence: 0.86,
      message: "VOW isn't accusing you of anything, but this wording could be interpreted in a harmful way. Please reword it so the intended activity is explicit.",
    };
  }

  return {
    status: "safe",
    category: "none",
    severity: "ambiguous",
    confidence: 0.99,
    message: "",
  };
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

async function enforceSeriousViolation(userId: string, classification: Classification) {
  const db = adminClient();
  const { count, error: countError } = await db
    .from("moderation_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("severity", ["high", "critical"]);

  if (countError) throw new Error("MODERATION_HISTORY_FAILED");

  const strikeNumber = (count || 0) + 1;
  let action: "suspended" | "banned";
  let banDuration: string;
  let bannedUntil: Date | null = null;

  if (strikeNumber === 1) {
    action = "suspended";
    banDuration = "168h";
    bannedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  } else if (strikeNumber === 2) {
    action = "suspended";
    banDuration = "1464h";
    bannedUntil = addMonths(new Date(), 2);
  } else {
    action = "banned";
    banDuration = "876000h";
  }

  const { data: userData, error: userError } = await db.auth.admin.getUserById(userId);
  if (userError || !userData.user) throw new Error("MODERATION_USER_LOOKUP_FAILED");

  const existingMeta = userData.user.app_metadata || {};
  const nextMeta = {
    ...existingMeta,
    moderation_strikes: strikeNumber,
    moderation_status: action === "banned" ? "permanently_banned" : "suspended",
    moderation_banned_until: bannedUntil ? bannedUntil.toISOString() : null,
  };

  const { error: banError } = await db.auth.admin.updateUserById(userId, {
    ban_duration: banDuration,
    app_metadata: nextMeta,
  });
  if (banError) throw new Error("MODERATION_ENFORCEMENT_FAILED");

  const { error: eventError } = await db.from("moderation_events").insert({
    user_id: userId,
    category: classification.category,
    severity: classification.severity,
    confidence: clamp(classification.confidence),
    action,
    strike_number: strikeNumber,
  });
  if (eventError) throw new Error("MODERATION_EVENT_RECORD_FAILED");

  return {
    action,
    strikeNumber,
    retryAfterSeconds: bannedUntil ? Math.max(1, Math.ceil((bannedUntil.getTime() - Date.now()) / 1000)) : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    if (!(req.headers.get("Authorization") || "").startsWith("Bearer ")) {
      return json({ error: "Authentication required." }, 401);
    }

    const { data, error } = await authClient(req).auth.getUser();
    if (error || !data.user) return json({ error: "Authentication required." }, 401);

    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return json({ status: "safe" });

    const classification = classify(text);
    if (classification.status === "safe" || classification.status === "ambiguous") {
      if (classification.status === "ambiguous") {
        const db = adminClient();
        await db.from("moderation_events").insert({
          user_id: data.user.id,
          category: classification.category,
          severity: classification.severity,
          confidence: clamp(classification.confidence),
          action: "reword_required",
          strike_number: null,
        });
      }
      return json({
        status: classification.status,
        category: classification.category,
        confidence: classification.confidence,
        message: classification.message,
      });
    }

    const enforcement = await enforceSeriousViolation(data.user.id, classification);
    const message = enforcement.action === "banned"
      ? "This account has been permanently banned because of repeated serious safety violations."
      : enforcement.strikeNumber === 1
        ? "This content was blocked and your VOW account has been suspended for 7 days because of a serious safety violation."
        : "This content was blocked and your VOW account has been suspended for 2 months because of a repeated serious safety violation.";

    return json({
      status: "suspended",
      category: classification.category,
      confidence: classification.confidence,
      message,
      strike_number: enforcement.strikeNumber,
      retry_after_seconds: enforcement.retryAfterSeconds,
    }, 403);
  } catch (error) {
    console.error("content safety", error);
    return json({ error: "VOW could not complete its safety check." }, 500);
  }
});
