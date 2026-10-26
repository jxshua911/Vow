import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: CORS });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return json({ error: "Authentication required." }, 401);

    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    const successUrl = Deno.env.get("STRIPE_SUCCESS_URL");
    const cancelUrl = Deno.env.get("STRIPE_CANCEL_URL");
    if (!secret || !successUrl || !cancelUrl) return json({ error: "Checkout is not configured yet." }, 503);

    // VOW launch pricing is monthly-only. Ignore client-supplied billing
    // intervals so callers cannot start a new yearly checkout.
    const billing = "monthly";

    const { data: existingEntitlement, error: entitlementError } = await supabase
      .from("vow_user_entitlements")
      .select("stripe_customer_id, provider, plan, status, current_period_end, grace_until, personal_build_override, personal_build_plan")
      .eq("user_id", user.id)
      .maybeSingle();
    if (entitlementError) return json({ error: "Could not verify your current Premium status." }, 503);

    const periodEnd = existingEntitlement?.current_period_end
      ? new Date(existingEntitlement.current_period_end).getTime()
      : null;
    const graceEnd = existingEntitlement?.grace_until
      ? new Date(existingEntitlement.grace_until).getTime()
      : null;
    const alreadyPremium = Boolean(
      (existingEntitlement?.personal_build_override && existingEntitlement.personal_build_plan === "premium") ||
      (existingEntitlement?.provider && existingEntitlement.plan === "premium" &&
        ["active", "trialing"].includes(String(existingEntitlement.status)) &&
        (periodEnd === null || periodEnd > Date.now())) ||
      (existingEntitlement?.provider && existingEntitlement.plan === "premium" &&
        existingEntitlement.status === "grace" && graceEnd !== null && graceEnd > Date.now()) ||
      (existingEntitlement?.provider === "manual" && existingEntitlement.plan === "premium" &&
        ["active", "trialing"].includes(String(existingEntitlement.status)))
    );
    if (alreadyPremium) {
      return json({ error: "Premium is already active for this account. Manage the existing subscription instead of purchasing again." }, 409);
    }

    const priceId = Deno.env.get("STRIPE_PRICE_ID_MONTHLY");
    if (!priceId) return json({ error: "VOW monthly pricing is not configured yet." }, 503);

    const body = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      ...(existingEntitlement?.stripe_customer_id
        ? { customer: existingEntitlement.stripe_customer_id }
        : { customer_email: user.email || "" }),
      success_url: successUrl,
      cancel_url: cancelUrl,
      "metadata[user_id]": user.id,
      "metadata[billing]": billing,
      "subscription_data[metadata][user_id]": user.id,
      "subscription_data[metadata][billing]": billing,
      payment_method_collection: "always",
    });

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const payload = await response.json();
    if (!response.ok || !payload?.url) {
      console.error("stripe checkout error", response.status, payload);
      return json({ error: "Could not start checkout." }, 502);
    }

    return json({ url: payload.url });
  } catch (error) {
    console.error("vow-create-checkout", error);
    return json({ error: "Could not start checkout." }, 500);
  }
});
