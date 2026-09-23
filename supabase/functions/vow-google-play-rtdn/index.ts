import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { importPKCS8, jwtVerify, createRemoteJWKSet, SignJWT } from "https://esm.sh/jose@6.1.0";

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

  if (!SERVICE_ACCOUNT_JSON || !MONTHLY_PRODUCT_ID || !YEARLY_PRODUCT_ID) {
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

  if (insertError?.code === "23505") return json(204, {});
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
          item.productId === MONTHLY_PRODUCT_ID || item.productId === YEARLY_PRODUCT_ID)
      : null;
    if (!lineItem) throw new Error("PRODUCT_NOT_ALLOWED");

    const productId = lineItem.productId as string;
    const billingPeriod = productId === YEARLY_PRODUCT_ID ? "yearly" : "monthly";
    const state = purchase.subscriptionState;
    const expiry = lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
    const activeStates = new Set(["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"]);
    const pendingStates = new Set(["SUBSCRIPTION_STATE_PENDING", "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED"]);
    const active = activeStates.has(state) && (!expiry || expiry.getTime() > Date.now());
    const status = active
      ? (state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" ? "grace" : "active")
      : pendingStates.has(state) ? "pending" : "expired";

    const { data: record } = await serviceClient
      .from("vow_subscription_records")
      .select("user_id")
      .eq("provider", "google_play")
      .eq("provider_purchase_id", purchaseToken)
      .maybeSingle();

    if (!record?.user_id) throw new Error("PURCHASE_NOT_LINKED");

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
    // Return non-2xx so Pub/Sub retries transient failures.
    await serviceClient.from("vow_google_play_notifications")
      .delete()
      .eq("message_id", messageId);
    return json(500, {
      error: error instanceof Error ? error.message : "RTDN_PROCESSING_FAILED",
    });
  }
});