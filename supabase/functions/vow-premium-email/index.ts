import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

function publishableKey(): string {
  if (Deno.env.get("SUPABASE_ANON_KEY")) return Deno.env.get("SUPABASE_ANON_KEY")!;
  try { return JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default || ""; }
  catch { return ""; }
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c] || c));

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Sign in to continue." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = publishableKey();
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!supabaseUrl || !anonKey || !resendKey) {
    console.error("[VOW Premium Email] Required environment configuration is missing.");
    return json({ error: "Premium email delivery is not configured." }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user?.email) return json({ error: "A valid signed-in account is required." }, 401);

  const { data: snapshot, error: entitlementError } = await userClient.rpc("vow_get_entitlement_snapshot");
  if (entitlementError) {
    console.error("[VOW Premium Email] Entitlement verification failed:", entitlementError.message);
    return json({ error: "We could not verify Premium access. Please try again." }, 503);
  }
  if (snapshot?.plan !== "premium") return json({ error: "An active Premium entitlement is required." }, 403);

  const displayNameRaw = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split("@")[0];
  const displayName = String(displayNameRaw).trim().slice(0, 100) || "there";
  const from = Deno.env.get("PREMIUM_FROM_EMAIL") || "VOW Premium <premium@vowglobal.online>";
  const subject = "Your VOW Premium access is active";
  const text = [
    `Hi ${displayName},`,
    "",
    "Your VOW account has been updated successfully. Premium access is now active.",
    "",
    "Open VOW and visit your dashboard to start planning with your Premium benefits.",
    "",
    'If your account does not show "Premium · Active", reopen the app and check My Account.',
    "",
    "Thanks for being part of VOW.",
    "",
    "VOW Support",
    "https://vowglobal.online",
  ].join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto;color:#202020;line-height:1.6"><p>Hi ${escapeHtml(displayName)},</p><p>Your VOW account has been updated successfully. <strong>Premium access is now active.</strong></p><p>Open VOW and visit your dashboard to start planning with your Premium benefits.</p><p>If your account does not show “Premium · Active”, reopen the app and check My Account.</p><p>Thanks for being part of VOW.</p><p>VOW Support<br><a href="https://vowglobal.online">vowglobal.online</a></p></div>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [user.email],
        subject,
        text,
        html,
        tags: [{ name: "category", value: "premium-activation" }],
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[VOW Premium Email] Provider rejected delivery:", response.status, result?.message || result?.name || "unknown");
      return json({ sent: false, error: "The email provider could not accept this message. Check the verified sender domain and Resend configuration." }, 502);
    }
    return json({ sent: true, message: "Premium activation email accepted for delivery." });
  } catch (error) {
    console.error("[VOW Premium Email] Delivery request failed:", error instanceof Error ? error.message : "unknown error");
    return json({ sent: false, error: "Email delivery is temporarily unavailable." }, 502);
  }
});
