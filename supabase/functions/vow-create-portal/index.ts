import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: CORS });

function safeReturnUrl() {
  const configured = Deno.env.get("STRIPE_PORTAL_RETURN_URL")?.trim() || "https://vowglobal.online/";
  const url = new URL(configured);
  if (url.protocol !== "https:" || !(url.hostname === "vowglobal.online" || url.hostname.endsWith(".vowglobal.online"))) {
    throw new Error("STRIPE_PORTAL_RETURN_URL_INVALID");
  }
  return url.toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!url || !anonKey || !serviceRoleKey || !stripeSecret) {
      return json({ error: "Stripe subscription management is not configured yet." }, 503);
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Authentication required." }, 401);

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: entitlement, error: entitlementError } = await admin
      .from("vow_user_entitlements")
      .select("provider,stripe_customer_id,plan,status,current_period_end,grace_until")
      .eq("user_id", user.id)
      .maybeSingle();
    if (entitlementError) throw new Error("STRIPE_ENTITLEMENT_LOOKUP_FAILED");
    if (entitlement?.provider !== "stripe" || !entitlement.stripe_customer_id) {
      return json({ error: "No Stripe subscription is linked to this VOW account. If you subscribed through Google Play, manage it in Google Play." }, 409);
    }
    const active = entitlement.plan === "premium" && (
      (["active", "trialing"].includes(String(entitlement.status)) &&
        (!entitlement.current_period_end || new Date(entitlement.current_period_end).getTime() > Date.now())) ||
      (entitlement.status === "grace" && entitlement.grace_until &&
        new Date(entitlement.grace_until).getTime() > Date.now())
    );
    if (!active) return json({ error: "No active Stripe subscription was found for this VOW account." }, 409);

    const returnUrl = safeReturnUrl();
    const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: entitlement.stripe_customer_id,
        return_url: returnUrl,
      }),
    });
    const payload = await response.json();
    if (!response.ok || typeof payload?.url !== "string") {
      console.error("Stripe portal session could not be created.", response.status);
      return json({ error: "Stripe could not open subscription management. Please try again or contact support." }, 502);
    }
    return json({ url: payload.url });
  } catch (error) {
    console.error("Stripe portal session failed:", error instanceof Error ? error.message : "UNKNOWN_ERROR");
    return json({ error: "Stripe subscription management is temporarily unavailable." }, 503);
  }
});
