import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character] || character));

function bearerRole(request: Request): string | null {
  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")));
    return typeof claims.role === "string" ? claims.role : null;
  } catch {
    return null;
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  // The Supabase gateway validates the JWT; require the trusted server role as
  // well, because this endpoint accepts a user ID and sends account email.
  if (bearerRole(request) !== "service_role") return json({ error: "Not authorized." }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!supabaseUrl || !serviceKey || !resendKey) {
    console.error("[VOW Premium Email] Required server configuration is missing.");
    return json({ error: "Email delivery is not configured." }, 503);
  }

  let body: { user_id?: unknown; provider?: unknown; provider_event_id?: unknown; billing_period?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  const provider = body.provider === "google_play" ? "google_play" : body.provider === "stripe" ? "stripe" : "";
  const providerEventId = typeof body.provider_event_id === "string" ? body.provider_event_id.trim() : "";
  const billingPeriod = body.billing_period === "yearly" ? "yearly" : body.billing_period === "monthly" ? "monthly" : "";
  const validProviderEventId = provider === "stripe"
    ? /^evt_[A-Za-z0-9]+$/.test(providerEventId)
    : provider === "google_play" && /^gplay_[a-f0-9]{64}$/.test(providerEventId);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
      || !validProviderEventId || !billingPeriod) {
    return json({ error: "Invalid request." }, 400);
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const eventKey = `premium-email:${provider}:${providerEventId}`;
  const { data: emailEvent, error: eventError } = await db.from("vow_payment_events")
    .select("status,metadata")
    .eq("provider", provider)
    .eq("provider_event_id", eventKey)
    .maybeSingle();
  if (eventError || !emailEvent) {
    console.error("[VOW Premium Email] Idempotency event is missing or could not be read.");
    return json({ error: "Email delivery could not be verified." }, 503);
  }
  if (emailEvent.status === "sent") return json({ sent: true, duplicate: true });
  if (!["pending", "failed"].includes(String(emailEvent.status))) {
    return json({ error: "Email delivery is not eligible for processing." }, 409);
  }

  const { data: entitlement, error: entitlementError } = await db.from("vow_user_entitlements")
    .select("plan,status,provider,current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (entitlementError || entitlement?.plan !== "premium" || entitlement?.status !== "active" || entitlement?.provider !== provider) {
    console.error("[VOW Premium Email] Current server-side entitlement did not confirm active Premium for the requested provider.");
    return json({ error: "An active Premium entitlement could not be verified." }, 409);
  }

  const { data: userResult, error: userError } = await db.auth.admin.getUserById(userId);
  const user = userResult?.user;
  if (userError || !user?.email) return json({ error: "Account email could not be retrieved." }, 404);

  const rawName = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split("@")[0];
  const displayName = String(rawName).trim().slice(0, 100) || "there";
  const from = (Deno.env.get("VOW_SUPPORT_FROM_EMAIL") || "VOW <noreply@vowglobal.online>").trim();
  const periodEnd = entitlement.current_period_end ? new Date(entitlement.current_period_end) : null;
  const validPeriodEnd = periodEnd && Number.isFinite(periodEnd.getTime()) ? periodEnd : null;
  const periodText = validPeriodEnd
    ? `Your current subscription period ends on ${validPeriodEnd.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}.`
    : "You can check your current subscription details in VOW.";
  const text = [
    `Hi ${displayName},`, "",
    "Your VOW Premium access is now active.",
    `Your billing plan is ${billingPeriod}.`,
    periodText,
    "",
    "Open VOW to continue planning toward your goals.",
    "If your account does not show Premium as active, reopen the app and check My Account.",
    "",
    "VOW Support",
    "https://vowglobal.online",
  ].join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto;color:#202020;line-height:1.6"><p>Hi ${escapeHtml(displayName)},</p><p>Your <strong>VOW Premium access is now active.</strong></p><p>Your billing plan is ${escapeHtml(billingPeriod)}. ${escapeHtml(periodText)}</p><p>Open VOW to continue planning toward your goals.</p><p>If your account does not show Premium as active, reopen the app and check My Account.</p><p>VOW Support<br><a href="https://vowglobal.online">vowglobal.online</a></p></div>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `vow-premium-${provider}-${providerEventId}`,
      },
      body: JSON.stringify({
        from,
        to: [user.email],
        subject: "Your VOW Premium access is active",
        text,
        html,
        tags: [{ name: "category", value: "premium-activation" }],
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result?.id !== "string") {
      await db.from("vow_payment_events").update({
        status: "failed",
        metadata: { ...(emailEvent.metadata || {}), provider_http_status: response.status },
      }).eq("provider", provider).eq("provider_event_id", eventKey);
      console.error("[VOW Premium Email] Provider did not accept the message:", response.status);
      return json({ error: "Email delivery failed. The subscription remains active." }, 502);
    }

    const { error: updateError } = await db.from("vow_payment_events").update({
      status: "sent",
      metadata: { ...(emailEvent.metadata || {}), resend_message_id: result.id },
    }).eq("provider", provider).eq("provider_event_id", eventKey);
    if (updateError) {
      console.error("[VOW Premium Email] Could not record provider acceptance.");
      return json({ error: "Email status could not be recorded." }, 503);
    }
    return json({ sent: true });
  } catch {
    await db.from("vow_payment_events").update({ status: "failed" })
      .eq("provider", provider).eq("provider_event_id", eventKey);
    console.error("[VOW Premium Email] Delivery request failed.");
    return json({ error: "Email delivery failed. The subscription remains active." }, 502);
  }
});
