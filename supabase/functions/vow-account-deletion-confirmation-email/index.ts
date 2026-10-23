import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => {
  const entities: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  };
  return entities[character] ?? character;
});

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
  if (bearerRole(request) !== "service_role") return json({ error: "Not authorized." }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!supabaseUrl || !serviceKey || !resendKey) {
    console.error("[VOW Account Deletion Email] Required server configuration is missing.");
    return json({ error: "Email delivery is not configured." }, 503);
  }

  let body: { user_id?: unknown; deleted_at?: unknown; restorable_until?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  const deletedAt = typeof body.deleted_at === "string" ? body.deleted_at : "";
  const restorableUntil = typeof body.restorable_until === "string" ? body.restorable_until : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
      || !Number.isFinite(Date.parse(deletedAt))
      || !Number.isFinite(Date.parse(restorableUntil))) {
    return json({ error: "Invalid request." }, 400);
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: settings, error: settingsError } = await db.from("user_settings")
    .select("account_status,deleted_at,deletion_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (settingsError || settings?.account_status !== "deleted"
      || Date.parse(String(settings.deleted_at || "")) !== Date.parse(deletedAt)
      || Date.parse(String(settings.deletion_expires_at || "")) !== Date.parse(restorableUntil)) {
    console.error("[VOW Account Deletion Email] Current server-side deletion state could not be verified.");
    return json({ error: "Account deletion state could not be verified." }, 409);
  }

  const { data: userResult, error: userError } = await db.auth.admin.getUserById(userId);
  const user = userResult?.user;
  if (userError || !user?.email) return json({ error: "Account email could not be retrieved." }, 404);

  const rawName = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split("@")[0];
  const displayName = String(rawName).trim().slice(0, 100) || "there";
  const from = (Deno.env.get("VOW_SUPPORT_FROM_EMAIL") || "VOW <noreply@vowglobal.online>").trim();
  const restoreDate = new Date(restorableUntil).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
  const text = [
    `Hi ${displayName},`, "",
    "We received your request to delete your VOW account.",
    `Your account is scheduled for deletion. You can restore it by signing back in before ${restoreDate}.`,
    "If you did not request this, sign in to restore your account and contact VOW Support.",
    "", "VOW Support", "https://vowglobal.online",
  ].join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto;color:#202020;line-height:1.6"><p>Hi ${escapeHtml(displayName)},</p><p>We received your request to delete your VOW account.</p><p>Your account is scheduled for deletion. You can restore it by signing back in before <strong>${escapeHtml(restoreDate)}</strong>.</p><p>If you did not request this, sign in to restore your account and contact VOW Support.</p><p>VOW Support<br><a href="https://vowglobal.online">vowglobal.online</a></p></div>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `vow-account-deletion-${userId}-${Date.parse(deletedAt)}`,
      },
      body: JSON.stringify({
        from,
        to: [user.email],
        subject: "Your VOW account deletion request",
        text,
        html,
        tags: [{ name: "category", value: "account-deletion-confirmation" }],
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || typeof result?.id !== "string") {
      console.error("[VOW Account Deletion Email] Provider rejected delivery:", response.status);
      return json({ error: "Email delivery failed." }, 502);
    }
    return json({ sent: true });
  } catch {
    console.error("[VOW Account Deletion Email] Delivery request failed.");
    return json({ error: "Email delivery failed." }, 502);
  }
});
