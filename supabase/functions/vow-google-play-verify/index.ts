import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { importPKCS8, SignJWT } from "https://esm.sh/jose@6.1.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const PACKAGE_NAME = Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME") ?? "com.vow.app";
const SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON") ?? "";
const MONTHLY_PRODUCT_ID = Deno.env.get("VOW_PREMIUM_MONTHLY_PRODUCT_ID") ?? "";
const YEARLY_PRODUCT_ID = Deno.env.get("VOW_PREMIUM_YEARLY_PRODUCT_ID") ?? "";
const MAX_TOKEN_LENGTH = 4096;

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type VerifyBody = {
  purchaseToken?: string;
  productId?: string;
  billingPeriod?: "monthly" | "yearly";
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function isAllowedProduct(productId: string, billingPeriod: string) {
  return (billingPeriod === "monthly" && productId === MONTHLY_PRODUCT_ID)
    || (billingPeriod === "yearly" && productId === YEARLY_PRODUCT_ID);
}

async function googleAccessToken(account: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(account.private_key, "RS256");
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/androidpublisher",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setSubject(account.client_email)
    .setAudience(account.token_uri ?? "https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const tokenResponse = await fetch(account.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!tokenResponse.ok) throw new Error("GOOGLE_OAUTH_FAILED");
  const token = await tokenResponse.json();
  if (!token.access_token) throw new Error("GOOGLE_ACCESS_TOKEN_MISSING");
  return token.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  if (!SERVICE_ACCOUNT_JSON || !MONTHLY_PRODUCT_ID || !YEARLY_PRODUCT_ID) {
    return json(503, { error: "GOOGLE_PLAY_NOT_CONFIGURED" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json(401, { error: "UNAUTHORIZED" });

  let body: VerifyBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "INVALID_JSON" });
  }

  const purchaseToken = body.purchaseToken?.trim();
  const productId = body.productId?.trim();
  const billingPeriod = body.billingPeriod;

  if (!purchaseToken || !productId || !billingPeriod || !isAllowedProduct(productId, billingPeriod)) {
    return json(400, { error: "INVALID_PRODUCT" });
  }
  if (purchaseToken.length > MAX_TOKEN_LENGTH) return json(400, { error: "INVALID_PURCHASE_TOKEN" });
  if (!/^[A-Za-z0-9._:-]+$/.test(purchaseToken)) return json(400, { error: "INVALID_PURCHASE_TOKEN" });

  let account: ServiceAccount;
  try {
    account = JSON.parse(SERVICE_ACCOUNT_JSON);
  } catch {
    return json(503, { error: "INVALID_GOOGLE_SERVICE_ACCOUNT" });
  }

  try {
    const accessToken = await googleAccessToken(account);
    const endpoint =
      "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
      + encodeURIComponent(PACKAGE_NAME)
      + "/purchases/subscriptionsv2/tokens/"
      + encodeURIComponent(purchaseToken);

    const googleResponse = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!googleResponse.ok) {
      return json(400, { error: "GOOGLE_PURCHASE_VERIFICATION_FAILED" });
    }

    const purchase = await googleResponse.json();
    const lineItem = Array.isArray(purchase.lineItems)
      ? purchase.lineItems.find((item: { productId?: string }) => item.productId === productId)
      : null;

    if (!lineItem) return json(400, { error: "PRODUCT_MISMATCH" });

    const expectedAccountToken = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(user.id),
    );
    const expectedAccountTokenHex = Array.from(new Uint8Array(expectedAccountToken))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const linkedAccountToken =
      purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null;

    if (!linkedAccountToken || linkedAccountToken !== expectedAccountTokenHex) {
      return json(403, { error: "PURCHASE_ACCOUNT_MISMATCH" });
    }

    const purchasePackage = purchase.packageName ?? PACKAGE_NAME;
    if (purchasePackage !== PACKAGE_NAME) return json(400, { error: "PACKAGE_MISMATCH" });

    const state = purchase.subscriptionState;
    const activeStates = new Set([
      "SUBSCRIPTION_STATE_ACTIVE",
      "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
    ]);
    const pendingStates = new Set([
      "SUBSCRIPTION_STATE_PENDING",
      "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED",
    ]);

    const expiry = lineItem.expiryTime ? new Date(lineItem.expiryTime) : null;
    const active = activeStates.has(state) && (!expiry || expiry.getTime() > Date.now());
    const status = active
      ? (state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" ? "grace" : "active")
      : pendingStates.has(state) ? "pending" : "expired";

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing } = await serviceClient
      .from("vow_subscription_records")
      .select("id, user_id")
      .eq("provider", "google_play")
      .eq("provider_purchase_id", purchaseToken)
      .maybeSingle();

    if (existing?.user_id && existing.user_id !== user.id) {
      return json(409, { error: "PURCHASE_ALREADY_LINKED" });
    }

    const { error: recordError } = await serviceClient.rpc("vow_set_subscription_record", {
      p_user_id: user.id,
      p_provider: "google_play",
      p_product_id: productId,
      p_billing_period: billingPeriod,
      p_provider_purchase_id: purchaseToken,
      p_provider_event_id: null,
      p_status: status,
      p_purchased_at: purchase.startTime ?? null,
      p_current_period_end: lineItem.expiryTime ?? null,
      p_auto_renewing: lineItem.autoRenewingPlan?.autoRenewEnabled ?? null,
    });

    if (recordError) throw new Error("SUBSCRIPTION_RECORD_FAILED");

    // Google recommends server-side acknowledgement after verification.
    if (active && purchase.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING") {
      const ackEndpoint =
        "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
        + encodeURIComponent(PACKAGE_NAME)
        + "/purchases/subscriptions/"
        + encodeURIComponent(productId)
        + "/tokens/"
        + encodeURIComponent(purchaseToken)
        + ":acknowledge";

      const ackResponse = await fetch(ackEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!ackResponse.ok) throw new Error("GOOGLE_ACKNOWLEDGEMENT_FAILED");
    }

    return json(200, {
      ok: true,
      plan: active ? "premium" : "free",
      status,
      currentPeriodEnd: lineItem.expiryTime ?? null,
      restored: Boolean(existing),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "GOOGLE_PLAY_VERIFICATION_FAILED";
    return json(502, { error: code });
  }
});
