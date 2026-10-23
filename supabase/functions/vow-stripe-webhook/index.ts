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
    let premiumEmailContext: { userId: string; billingPeriod: "monthly" | "yearly" } | null = null;

    // Do not grant Premium from checkout completion alone: checkout completion is
    // not authoritative proof that the subscription is active. Subscription
    // lifecycle events are signature-verified above and flow through the
    // canonical server-only subscription RPC so both records and entitlements
    // remain consistent.
    const isSubscriptionEvent = [
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(String(event.type));

    if (isSubscriptionEvent) {
      const { data: existing, error: lookupError } = await db
        .from("vow_user_entitlements")
        .select("user_id,plan,status")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();
      if (lookupError) throw new Error("SUBSCRIPTION_OWNER_LOOKUP_FAILED");

      const userId = metadataUserId || existing?.user_id;
      if (!userId || !subscriptionId) {
        // A verified but unlinked Stripe subscription must never grant access.
        console.warn("vow-stripe-webhook: subscription event has no linked VOW user", String(event.id));
      } else {
        const price = object?.items?.data?.[0]?.price;
        const productId = typeof price?.id === "string" ? price.id : "";
        const billingPeriod = object?.metadata?.billing === "yearly" || price?.recurring?.interval === "year"
          ? "yearly"
          : object?.metadata?.billing === "monthly" || price?.recurring?.interval === "month"
            ? "monthly"
            : null;
        if (!productId || !billingPeriod) {
          throw new Error("SUBSCRIPTION_PRICE_METADATA_MISSING");
        }

        const stripeStatus = event.type === "customer.subscription.deleted"
          ? "cancelled"
          : String(object?.status ?? "");
        const status = stripeStatus === "active" || stripeStatus === "trialing"
          ? "active"
          : stripeStatus === "past_due"
            ? "grace"
            : stripeStatus === "paused"
              ? "paused"
              : stripeStatus === "incomplete"
                ? "pending"
                : "expired";

        const wasPremiumActive = existing?.plan === "premium" && existing?.status === "active";
        if (status === "active") {
          premiumEmailContext = { userId, billingPeriod };
          if (!wasPremiumActive) {
            const emailEventKey = `premium-email:stripe:${String(event.id)}`;
            const { error: emailEventInsertError } = await db.from("vow_payment_events").insert({
              user_id: userId,
              provider: "stripe",
              provider_event_id: emailEventKey,
              event_type: "premium_confirmation_email",
              amount_minor: null,
              currency: null,
              status: "pending",
              metadata: { stripe_event_id: String(event.id), billing_period: billingPeriod },
            });
            if (emailEventInsertError && emailEventInsertError.code !== "23505") {
              throw new Error("PREMIUM_EMAIL_EVENT_CREATE_FAILED");
            }
          }
        }

        const { error: recordError } = await db.rpc("vow_set_subscription_record", {
          p_user_id: userId,
          p_provider: "stripe",
          p_product_id: productId,
          p_billing_period: billingPeriod,
          p_provider_purchase_id: subscriptionId,
          p_provider_event_id: String(event.id),
          p_status: status,
          p_purchased_at: object?.start_date ? new Date(Number(object.start_date) * 1000).toISOString() : null,
          p_current_period_end: object?.current_period_end ? new Date(Number(object.current_period_end) * 1000).toISOString() : null,
          p_auto_renewing: typeof object?.cancel_at_period_end === "boolean" ? !object.cancel_at_period_end : null,
        });
        if (recordError) {
          console.error("vow-stripe-webhook: canonical subscription write failed.");
          throw new Error("SUBSCRIPTION_STATE_WRITE_FAILED");
        }

        const { error: customerUpdateError } = await db
          .from("vow_user_entitlements")
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          })
          .eq("user_id", userId);
        if (customerUpdateError) throw new Error("SUBSCRIPTION_CUSTOMER_LINK_WRITE_FAILED");
      }
    }

    const { error: paymentEventError } = await db.from("vow_payment_events").upsert({
      user_id: metadataUserId || null,
      provider: "stripe",
      provider_event_id: String(event.id),
      event_type: String(event.type),
      amount_minor: Number.isInteger(object?.amount_total) ? object.amount_total : null,
      currency: typeof object?.currency === "string" ? object.currency : null,
      status: typeof object?.status === "string" ? object.status : null,
      metadata: { customer_id: customerId, subscription_id: subscriptionId },
    }, { onConflict: "provider,provider_event_id" });
    if (paymentEventError) throw new Error("PAYMENT_EVENT_LEDGER_WRITE_FAILED");

    if (premiumEmailContext) {
      const emailEventKey = `premium-email:stripe:${String(event.id)}`;
      const { data: emailEvent, error: emailLookupError } = await db.from("vow_payment_events")
        .select("status")
        .eq("provider", "stripe")
        .eq("provider_event_id", emailEventKey)
        .maybeSingle();
      if (emailLookupError) throw new Error("PREMIUM_EMAIL_EVENT_LOOKUP_FAILED");
      if (emailEvent && ["pending", "failed"].includes(String(emailEvent.status))) {
        const { data: emailResult, error: emailInvokeError } = await db.functions.invoke(
          "vow-premium-confirmation-email",
          { body: {
            user_id: premiumEmailContext.userId,
            provider: "stripe",
            provider_event_id: String(event.id),
            billing_period: premiumEmailContext.billingPeriod,
          } },
        );
        if (emailInvokeError || !emailResult?.sent) {
          console.error("vow-stripe-webhook: Premium confirmation email will be retried.");
          throw new Error("PREMIUM_CONFIRMATION_EMAIL_FAILED");
        }
      }
    }

    return json({ received: true });
  } catch (error) {
    console.error("vow-stripe-webhook: processing failed.");
    return json({ error: "Webhook processing failed." }, 500);
  }
});
