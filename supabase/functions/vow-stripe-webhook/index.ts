import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: CORS });

function hex(bytes: Uint8Array) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function verifySignature(payload: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || !signatures.length) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = hex(new Uint8Array(digest));
  return signatures.some((candidate) => constantTimeEqual(candidate, expected));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const signature = req.headers.get("stripe-signature");
    if (!webhookSecret || !signature) return json({ error: "Webhook is not configured." }, 503);

    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 256 * 1024) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
    if (!(await verifySignature(raw, signature, webhookSecret))) return json({ error: "Invalid signature." }, 400);

    const event = JSON.parse(raw);
    const object = event?.data?.object || {};
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) return json({ error: "Server configuration error." }, 503);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const metadataUserId = object?.metadata?.user_id || object?.subscription_data?.metadata?.user_id;
    const customerId = typeof object?.customer === "string" ? object.customer : null;
    const subscriptionId = typeof object?.subscription === "string" ? object.subscription : (typeof object?.id === "string" && event.type.startsWith("customer.subscription.") ? object.id : null);

    if (event.type === "checkout.session.completed" && metadataUserId) {
      await db.from("vow_user_entitlements").upsert({
        user_id: metadataUserId,
        plan: "premium",
        status: "active",
        provider: "stripe",
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        current_period_end: null,
      }, { onConflict: "user_id" });
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const status = object?.status === "active" || object?.status === "trialing" ? object.status : event.type === "customer.subscription.deleted" ? "cancelled" : "past_due";
      const { data: existing } = await db.from("vow_user_entitlements").select("user_id").eq("stripe_subscription_id", subscriptionId).maybeSingle();
      const userId = existing?.user_id || metadataUserId;
      if (userId) {
        await db.from("vow_user_entitlements").upsert({
          user_id: userId,
          plan: status === "active" || status === "trialing" ? "premium" : "free",
          status,
          provider: "stripe",
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          current_period_end: object?.current_period_end ? new Date(Number(object.current_period_end) * 1000).toISOString() : null,
        }, { onConflict: "user_id" });
      }
    }

    await db.from("vow_payment_events").upsert({
      user_id: metadataUserId || null,
      provider: "stripe",
      provider_event_id: String(event.id),
      event_type: String(event.type),
      amount_minor: Number.isInteger(object?.amount_total) ? object.amount_total : null,
      currency: typeof object?.currency === "string" ? object.currency : null,
      status: typeof object?.status === "string" ? object.status : null,
      metadata: { customer_id: customerId, subscription_id: subscriptionId },
    }, { onConflict: "provider_event_id" });

    return json({ received: true });
  } catch (error) {
    console.error("vow-stripe-webhook", error);
    return json({ error: "Webhook processing failed." }, 500);
  }
});
