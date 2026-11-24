import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type PushCategory = "session" | "weekly_review" | "deadline" | "streak" | "account" | "security" | "subscription";
type PushRequest = { user_id: string; title: string; body: string; category?: PushCategory; data?: Record<string, string> };
function base64Url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function pemToDer(pem: string): ArrayBuffer {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const binary = atob(base64); const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i); return bytes.buffer;
}
async function createGoogleAccessToken(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({ iss: serviceAccount.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const unsigned = header + "." + claim;
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(serviceAccount.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = unsigned + "." + base64Url(new Uint8Array(signature));
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  if (!response.ok) throw new Error("Google OAuth token exchange failed");
  const result = await response.json(); if (!result.access_token) throw new Error("Google OAuth token was not returned"); return result.access_token;
}
Deno.serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const expectedSecret = Deno.env.get("VOW_PUSH_INTERNAL_SECRET");
  if (!expectedSecret || req.headers.get("x-vow-push-secret") !== expectedSecret) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const serviceAccountRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!serviceAccountRaw) return Response.json({ error: "Push service is not configured" }, { status: 503 });
  let payload: PushRequest; try { payload = await req.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  if (!payload?.user_id || !payload?.title || !payload?.body) return Response.json({ error: "Missing notification fields" }, { status: 400 });
  const allowedCategories: PushCategory[] = ["session", "weekly_review", "deadline", "streak", "account", "security", "subscription"];
  const category = payload.category ?? "session";
  if (!allowedCategories.includes(category)) return Response.json({ error: "Invalid notification category" }, { status: 400 });
  try {
    const serviceAccount = JSON.parse(serviceAccountRaw) as { project_id: string; client_email: string; private_key: string };
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });

    // Do not send pushes to accounts inside the deletion grace period.
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("user_settings")
      .select("account_status")
      .eq("user_id", payload.user_id)
      .maybeSingle();
    if (settingsError) throw new Error("Unable to verify account notification status");
    if (!settings || settings.account_status === "deleted") {
      return Response.json({ sent: 0, failed: 0, removed: 0, skipped: "account_inactive" });
    }

    // Routine reminders respect the product-wide notification switch.
    // Critical account, security and subscription notices remain deliverable.
    if (!["account", "security", "subscription"].includes(category)) {
      const { data: preferences, error: preferencesError } = await supabaseAdmin
        .from("reminder_preferences")
        .select("enabled")
        .eq("user_id", payload.user_id)
        .maybeSingle();
      if (preferencesError) throw new Error("Unable to verify notification preferences");
      if (preferences?.enabled !== true) {
        return Response.json({ sent: 0, failed: 0, removed: 0, skipped: "notifications_disabled" });
      }
    }
    const { data: devices, error: devicesError } = await supabaseAdmin.from("vow_push_devices").select("id, token, channel_id").eq("user_id", payload.user_id);
    if (devicesError) throw new Error("Unable to load push devices");
    const accessToken = await createGoogleAccessToken(serviceAccount);
    const results = await Promise.all((devices ?? []).map(async (device) => {
      const response = await fetch("https://fcm.googleapis.com/v1/projects/" + serviceAccount.project_id + "/messages:send", {
        method: "POST", headers: { authorization: "Bearer " + accessToken, "content-type": "application/json" },
        body: JSON.stringify({ message: { token: device.token, notification: { title: payload.title, body: payload.body }, data: { ...(payload.data ?? {}), category }, android: { priority: "HIGH", notification: { channel_id: device.channel_id || "vow-reminders-sound-vibrate-v1", icon: "ic_vow_monochrome" } } } }),
      });
      if (response.ok) return { id: device.id, ok: true, remove: false };
      const failure = await response.json().catch(() => null);
      const details = Array.isArray(failure?.error?.details) ? failure.error.details : [];
      const permanentTokenFailure = details.some((item: { errorCode?: string }) => item?.errorCode === "UNREGISTERED");
      console.warn("[VOW] FCM delivery failed for a registered device:", response.status, failure?.error?.status || "UNKNOWN");
      return { id: device.id, ok: false, remove: permanentTokenFailure };
    }));
    const invalidIds = results.filter((result) => result.remove).map((result) => result.id);
    if (invalidIds.length) await supabaseAdmin.from("vow_push_devices").delete().in("id", invalidIds);
    return Response.json({ sent: results.filter((result) => result.ok).length, failed: results.filter((result) => !result.ok).length, removed: invalidIds.length });
  } catch (error) { console.error("[VOW] Push send failed:", error); return Response.json({ error: "Push delivery failed" }, { status: 502 }); }
});