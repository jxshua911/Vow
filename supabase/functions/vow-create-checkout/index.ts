import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    let billing = "monthly";
    try {
      const body = await req.json();
      if (body?.billing === "yearly") billing = "yearly";
    } catch {
      // Default to monthly when no JSON body is supplied.
    }

    const { data: existingEntitlement } = await supabase
      .from("vow_user_entitlements")
      .select("stripe_customer_id, plan, status")
      .eq("user_id", user.id)
      .maybeSingle();

    const priceId = billing === "yearly"
      ? Deno.env.get("STRIPE_PRICE_ID_YEARLY")
      : Deno.env.get("STRIPE_PRICE_ID_MONTHLY");
    if (!priceId) return json({ error: `VOW Premium ${billing} pricing is not configured yet.` }, 503);

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
