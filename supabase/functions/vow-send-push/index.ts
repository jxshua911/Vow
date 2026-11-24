import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type PushCategory = "session" | "weekly_review" | "deadline" | "streak" | "account" | "security" | "subscription";
type PushRequest = { user_id: string; title: string; body: string; category?: PushCategory; data?: Record<string, string>; queue_id?: string };
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
        .select("enabled,sessions_enabled,weekly_reviews_enabled,deadlines_enabled,streaks_enabled")
        .eq("user_id", payload.user_id)
        .maybeSingle();
      if (preferencesError) throw new Error("Unable to verify notification preferences");
      let categoryEnabled = true;
      if (category === "session") categoryEnabled = preferences?.sessions_enabled === true;
      else if (category === "weekly_review") categoryEnabled = preferences?.weekly_reviews_enabled === true;
      else if (category === "deadline") categoryEnabled = preferences?.deadlines_enabled === true;
      else if (category === "streak") categoryEnabled = preferences?.streaks_enabled === true;
      if (preferences?.enabled !== true || !categoryEnabled) {
        return Response.json({ sent: 0, failed: 0, removed: 0, skipped: "notifications_disabled" });
      }
    }
    const { data: devices, error: devicesError } = await supabaseAdmin.from("vow_push_devices").select("id, token, channel_id").eq("user_id", payload.user_id);
    if (devicesError) throw new Error("Unable to load push devices");
    const queueId = typeof payload.queue_id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.queue_id)
      ? payload.queue_id
      : null;
    let deliveryByDevice = new Map<string, { id: string; status: string; attempts: number }>();
    if (queueId) {
      const { data: queueItem, error: queueError } = await supabaseAdmin
        .from("vow_notification_queue")
        .select("id,user_id")
        .eq("id", queueId)
        .maybeSingle();
      if (queueError || !queueItem || queueItem.user_id !== payload.user_id) {
        return Response.json({ error: "Notification queue item is invalid" }, { status: 403 });
      }
      if ((devices ?? []).length) {
        const { error: seedError } = await supabaseAdmin
          .from("vow_notification_deliveries")
          .upsert((devices ?? []).map((device) => ({
            queue_id: queueId,
            user_id: payload.user_id,
            device_id: device.id,
            status: "pending",
          })), { onConflict: "queue_id,device_id", ignoreDuplicates: true });
        if (seedError) throw new Error("Unable to initialise per-device notification delivery");
      }
      const { data: deliveries, error: deliveryError } = await supabaseAdmin
        .from("vow_notification_deliveries")
        .select("id,device_id,status,attempts")
        .eq("queue_id", queueId);
      if (deliveryError) throw new Error("Unable to load per-device notification delivery state");
      deliveryByDevice = new Map((deliveries ?? []).map((delivery) => [delivery.device_id, delivery]));
    }
    const accessToken = await createGoogleAccessToken(serviceAccount);
    const results = await Promise.all((devices ?? []).map(async (device) => {
      const delivery = queueId ? deliveryByDevice.get(device.id) : null;
      if (queueId && delivery?.status === "sent") return { id: device.id, ok: true, remove: false, skipped: true };
      const nextAttempts = (delivery?.attempts ?? 0) + 1;
      if (queueId && delivery) {
        const { error: attemptError } = await supabaseAdmin
          .from("vow_notification_deliveries")
          .update({ status: "pending", attempts: nextAttempts, last_error: null })
          .eq("id", delivery.id);
        if (attemptError) throw new Error("Unable to start per-device notification delivery");
      }
      const response = await fetch("https://fcm.googleapis.com/v1/projects/" + serviceAccount.project_id + "/messages:send", {
        method: "POST", headers: { authorization: "Bearer " + accessToken, "content-type": "application/json" },
        body: JSON.stringify({ message: { token: device.token, notification: { title: payload.title, body: payload.body }, data: { ...(payload.data ?? {}), category }, android: { priority: "HIGH", notification: { channel_id: device.channel_id || "vow-reminders-sound-vibrate-v1", icon: "ic_vow_monochrome" } } } }),
      });
      if (response.ok) {
        if (queueId && delivery) {
          const { error: sentError } = await supabaseAdmin.from("vow_notification_deliveries")
            .update({ status: "sent", attempts: nextAttempts, last_error: null, sent_at: new Date().toISOString() })
            .eq("id", delivery.id);
          if (sentError) throw new Error("Unable to record successful device notification delivery");
        }
        return { id: device.id, ok: true, remove: false, skipped: false };
      }
      const failure = await response.json().catch(() => null);
      const details = Array.isArray(failure?.error?.details) ? failure.error.details : [];
      const permanentTokenFailure = details.some((item: { errorCode?: string }) => item?.errorCode === "UNREGISTERED");
      console.warn("[VOW] FCM delivery failed for a registered device:", response.status, failure?.error?.status || "UNKNOWN");
      if (queueId && delivery && !permanentTokenFailure) {
        const { error: failedError } = await supabaseAdmin.from("vow_notification_deliveries")
          .update({ status: "failed", attempts: nextAttempts, last_error: String(failure?.error?.status || response.status).slice(0, 160) })
          .eq("id", delivery.id);
        if (failedError) throw new Error("Unable to record failed device notification delivery");
      }
      return { id: device.id, ok: false, remove: permanentTokenFailure, skipped: false };
    }));
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
    return Response.json({ sent: results.filter((result) => result.ok).length, failed: results.filter((result) => !result.ok).length, removed: invalidIds.length, already_delivered: results.filter((result) => result.skipped).length });
  } catch (error) { console.error("[VOW] Push send failed:", error); return Response.json({ error: "Push delivery failed" }, { status: 502 }); }
});