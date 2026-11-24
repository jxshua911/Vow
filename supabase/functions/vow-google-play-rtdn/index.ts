import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { importPKCS8, jwtVerify, createRemoteJWKSet, SignJWT } from "npm:jose@6.1.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-goog-authenticated-user-jwt, content-type",
  "Content-Type": "application/json",
};

const PACKAGE_NAME = Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME") ?? "com.vow.app";
const SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON") ?? "";
const AUDIENCE = Deno.env.get("GOOGLE_PUBSUB_AUDIENCE") ?? "";
const MONTHLY_PRODUCT_ID = Deno.env.get("VOW_PREMIUM_MONTHLY_PRODUCT_ID") ?? "";
const YEARLY_PRODUCT_ID = Deno.env.get("VOW_PREMIUM_YEARLY_PRODUCT_ID") ?? "";
const GOOGLE_KEYS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

async function sendSubscriptionPush(userId: string, eventId: string, title: string, body: string) {
  const secret = Deno.env.get("VOW_PUSH_INTERNAL_SECRET") || "";
  const baseUrl = Deno.env.get("SUPABASE_URL") || "";
  if (!secret || !baseUrl) return;
  try {
    const response = await fetch(baseUrl + "/functions/v1/vow-send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-vow-push-secret": secret },
      body: JSON.stringify({
        user_id: userId,
        title,
        body,
        category: "subscription",
        data: { billingEventId: eventId },
      }),
    });
    if (!response.ok) console.warn("[VOW] Google Play subscription push was not delivered:", response.status);
  } catch {
    console.warn("[VOW] Google Play subscription push could not be sent.");
  }
}

async function googleAccessToken(account: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const audience = account.token_uri ?? "https://oauth2.googleapis.com/token";
  const key = await importPKCS8(account.private_key, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/androidpublisher" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setSubject(account.client_email)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const response = await fetch(audience, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) throw new Error("GOOGLE_OAUTH_FAILED");
  const token = await response.json();
  if (!token.access_token) throw new Error("GOOGLE_ACCESS_TOKEN_MISSING");
  return token.access_token as string;
}

async function verifyPubSub(req: Request) {
  if (!AUDIENCE) throw new Error("GOOGLE_PUBSUB_AUDIENCE_NOT_CONFIGURED");
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("PUBSUB_AUTH_MISSING");

  await jwtVerify(auth.slice(7), GOOGLE_KEYS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: AUDIENCE,
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });
  try {
    await verifyPubSub(req);
  } catch {
    return json(401, { error: "PUBSUB_AUTH_INVALID" });
  }

  if (!SERVICE_ACCOUNT_JSON || !MONTHLY_PRODUCT_ID) {
    return json(503, { error: "GOOGLE_PLAY_NOT_CONFIGURED" });
  }

  let envelope: {
    message?: { messageId?: string; data?: string };
  };
  try { envelope = await req.json(); } catch { return json(400, { error: "INVALID_JSON" }); }

  const message = envelope.message;
  const messageId = message?.messageId;
  if (!messageId || !message?.data) return json(400, { error: "INVALID_PUBSUB_MESSAGE" });

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: inserted, error: insertError } = await serviceClient
    .from("vow_google_play_notifications")
    .insert({
      message_id: messageId,
      package_name: PACKAGE_NAME,
    })
    .select("message_id")
    .maybeSingle();

  if (insertError?.code === "23505") {
    const { data: existing, error: existingError } = await serviceClient
      .from("vow_google_play_notifications")
      .select("message_id, processed_at")
      .eq("message_id", messageId)
      .maybeSingle();

    if (existingError) return json(500, { error: "NOTIFICATION_LEDGER_CHECK_FAILED" });
    if (existing?.processed_at) return json(204, {});
    return json(500, { error: "NOTIFICATION_PROCESSING_IN_PROGRESS" });
  }

  if (insertError || !inserted) return json(500, { error: "NOTIFICATION_LEDGER_FAILED" });

  try {
    const decoded = JSON.parse(atob(message.data));
    if (decoded.packageName !== PACKAGE_NAME) throw new Error("PACKAGE_MISMATCH");

    const notification = decoded.subscriptionNotification;
    if (!notification?.purchaseToken) {
      await serviceClient.from("vow_google_play_notifications")
        .update({ processed_at: new Date().toISOString() })
        .eq("message_id", messageId);
      return json(204, {});
    }

    const purchaseToken = notification.purchaseToken as string;
    const accessToken = await googleAccessToken(JSON.parse(SERVICE_ACCOUNT_JSON) as ServiceAccount);
    const endpoint = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
      + encodeURIComponent(PACKAGE_NAME) + "/purchases/subscriptionsv2/tokens/"
      + encodeURIComponent(purchaseToken);
    const googleResponse = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!googleResponse.ok) throw new Error("GOOGLE_PURCHASE_LOOKUP_FAILED");

    const purchase = await googleResponse.json();
    if ((purchase.packageName ?? PACKAGE_NAME) !== PACKAGE_NAME) throw new Error("PACKAGE_MISMATCH");
    const lineItem = Array.isArray(purchase.lineItems)
      ? purchase.lineItems.find((item: { productId?: string }) =>
          item.productId === MONTHLY_PRODUCT_ID || (Boolean(YEARLY_PRODUCT_ID) && item.productId === YEARLY_PRODUCT_ID))
      : null;
    if (!lineItem) throw new Error("PRODUCT_NOT_ALLOWED");

    const productId = lineItem.productId as string;
    const billingPeriod = YEARLY_PRODUCT_ID && productId === YEARLY_PRODUCT_ID ? "yearly" : "monthly";
    const state = purchase.subscriptionState;
    const expiry = lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
    const activeStates = new Set(["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"]);
    const pendingStates = new Set(["SUBSCRIPTION_STATE_PENDING", "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED"]);
    const active = activeStates.has(state) && (!expiry || expiry.getTime() > Date.now());
    const cancelledPaid = state === "SUBSCRIPTION_STATE_CANCELED" && Boolean(expiry && expiry.getTime() > Date.now());
    const status = active
      ? (state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" ? "grace" : "active")
      : cancelledPaid ? "cancelled"
      : pendingStates.has(state) ? "pending" : "expired";

    const { data: record, error: recordLookupError } = await serviceClient
      .from("vow_subscription_records")
      .select("user_id,status,current_period_end,auto_renewing")
      .eq("provider", "google_play")
      .eq("provider_purchase_id", purchaseToken)
      .maybeSingle();

    if (recordLookupError) throw new Error("PURCHASE_LINK_LOOKUP_FAILED");
    if (!record?.user_id) throw new Error("PURCHASE_NOT_LINKED");

    const storeRegionCode = typeof purchase.regionCode === "string" && /^[A-Z]{2}$/.test(purchase.regionCode.toUpperCase())
      ? purchase.regionCode.toUpperCase()
      : null;
    let marketTier: string | null = null;
    if (storeRegionCode) {
      const { data: market, error: marketError } = await serviceClient
        .from("vow_google_play_market_catalog")
        .select("market_tier")
        .eq("country_code", storeRegionCode)
        .eq("is_enabled", true)
        .maybeSingle();
      if (marketError) throw new Error("GOOGLE_PLAY_MARKET_LOOKUP_FAILED");
      marketTier = market?.market_tier ?? null;
    }

    const { error: writeError } = await serviceClient.rpc("vow_set_subscription_record", {
      p_user_id: record.user_id,
      p_provider: "google_play",
      p_product_id: productId,
      p_billing_period: billingPeriod,
      p_provider_purchase_id: purchaseToken,
      p_provider_event_id: messageId,
      p_status: status,
      p_purchased_at: purchase.startTime ?? null,
      p_current_period_end: lineItem.expiryTime ?? null,
      p_auto_renewing: lineItem.autoRenewingPlan?.autoRenewEnabled ?? null,
    });
    if (writeError) throw new Error("SUBSCRIPTION_STATE_WRITE_FAILED");

    if (storeRegionCode) {
      const { error: marketAssignmentError } = await serviceClient
        .from("vow_subscription_records")
        .update({ store_region_code: storeRegionCode, market_tier: marketTier })
        .eq("provider", "google_play")
        .eq("provider_purchase_id", purchaseToken);
      if (marketAssignmentError) throw new Error("GOOGLE_PLAY_MARKET_ASSIGNMENT_FAILED");
    }

    const previousStatus = String(record.status || "");
    if (status === "cancelled" && previousStatus !== "cancelled") {
      const endDate = expiry ? expiry.toLocaleDateString("en-US") : "the end of your paid period";
      await sendSubscriptionPush(record.user_id, messageId, "Premium renewal stopped", `Your Google Play subscription will not renew. Premium remains active until ${endDate}.`);
    } else if (status === "expired" && previousStatus !== "expired") {
      await sendSubscriptionPush(record.user_id, messageId, "VOW Premium has ended", "Your Google Play Premium subscription has ended. You can resubscribe at any time.");
    } else if (status === "active" && !["active", "grace", "cancelled"].includes(previousStatus)) {
      await sendSubscriptionPush(record.user_id, messageId, "VOW Premium is active", "Your Google Play Premium subscription is active. Your benefits are ready.");
    }

    await serviceClient.from("vow_google_play_notifications")
      .update({
        purchase_token: purchaseToken,
        notification_type: notification.notificationType ?? null,
        event_time: decoded.eventTimeMillis
          ? new Date(Number(decoded.eventTimeMillis)).toISOString()
          : null,
        processed_at: new Date().toISOString(),
      })
      .eq("message_id", messageId);

    return json(204, {});
  } catch (error) {
    await serviceClient.from("vow_google_play_notifications")
      .delete()
      .eq("message_id", messageId);
    return json(500, {
      error: error instanceof Error ? error.message : "RTDN_PROCESSING_FAILED",
    });
  }
});