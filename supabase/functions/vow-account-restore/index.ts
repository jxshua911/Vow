import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { importPKCS8, SignJWT } from "npm:jose@6.1.0";

type GoogleServiceAccount = { client_email: string; private_key: string; token_uri?: string };
async function googleAccessToken(account: GoogleServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = account.token_uri ?? "https://oauth2.googleapis.com/token";
  const key = await importPKCS8(account.private_key, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/androidpublisher" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error("GOOGLE_OAUTH_FAILED");
  const result = await response.json();
  if (typeof result.access_token !== "string" || !result.access_token) throw new Error("GOOGLE_ACCESS_TOKEN_MISSING");
  return result.access_token as string;
}


const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

async function sendAccountPush(userId:string,title:string,body:string,data:Record<string,string>={}){
  const secret=Deno.env.get("VOW_PUSH_INTERNAL_SECRET")||"";
  const baseUrl=Deno.env.get("SUPABASE_URL")||"";
  if(!secret||!baseUrl)return;
  try{
    const response=await fetch(baseUrl+"/functions/v1/vow-send-push",{
      method:"POST",headers:{"Content-Type":"application/json","x-vow-push-secret":secret},
      body:JSON.stringify({user_id:userId,title,body,category:"account",data}),
    });
    if(!response.ok)console.warn("[VOW] Account restoration push was not delivered:",response.status);
  }catch{console.warn("[VOW] Account restoration push could not be sent.");}
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!anonKey || !serviceKey) return json({ error: "SERVER_CONFIGURATION_ERROR" }, 503);

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "AUTH_REQUIRED" }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: settings, error: settingsError } = await admin.from("user_settings")
      .select("account_status,deletion_expires_at").eq("user_id", user.id).maybeSingle();
    if (settingsError) return json({ error: "ACCOUNT_STATE_LOOKUP_FAILED" }, 503);

    if (settings?.account_status === "purging") return json({ status: "purging" }, 200);
    if (settings?.account_status === "deleted") {
      const expiresAt = settings.deletion_expires_at ? new Date(settings.deletion_expires_at).getTime() : 0;
      if (!expiresAt || expiresAt <= Date.now()) return json({ status: "expired" }, 200);
    }

    const { data: entitlement, error: entitlementError } = await admin.from("vow_user_entitlements")
      .select("provider,stripe_subscription_id,status").eq("user_id", user.id).maybeSingle();
    if (entitlementError) return json({ error: "BILLING_LOOKUP_FAILED" }, 503);

    let stripeResumed = false;
    let resubscribeRequired = false;
    let billingStatusUnverified = false;
    let currentPeriodEnd: string | null = null;

    if (settings?.account_status === "deleted" && entitlement?.provider === "stripe"
      && entitlement.stripe_subscription_id && ["active", "grace"].includes(String(entitlement.status))) {
      const secret = Deno.env.get("STRIPE_SECRET_KEY") || "";
      if (!secret) return json({ error: "STRIPE_RESTORATION_NOT_CONFIGURED" }, 503);
      const response = await fetch("https://api.stripe.com/v1/subscriptions/" + encodeURIComponent(entitlement.stripe_subscription_id), {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ cancel_at_period_end: "false" }),
      });
      if (!response.ok) return json({ error: "STRIPE_RESTORATION_FAILED" }, 503);
      stripeResumed = true;
    } else if (settings?.account_status === "deleted" && entitlement?.provider === "google_play") {
      const { data: subscription, error: subscriptionError } = await admin.from("vow_subscription_records")
        .select("auto_renewing,current_period_end,status,provider_purchase_id").eq("user_id", user.id).eq("provider", "google_play")
        .order("current_period_end", { ascending: false }).limit(1).maybeSingle();
      if (subscriptionError) return json({ error: "GOOGLE_PLAY_SUBSCRIPTION_LOOKUP_FAILED" }, 503);
      currentPeriodEnd = subscription?.current_period_end || null;
      let autoRenewing = subscription?.auto_renewing;
      const purchaseToken = String(subscription?.provider_purchase_id || "").trim();
      const serviceAccountRaw = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON") || "";
      if (purchaseToken && serviceAccountRaw) {
        const account = JSON.parse(serviceAccountRaw) as GoogleServiceAccount;
        const accessToken = await googleAccessToken(account);
        const packageName = Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME") || "com.vow.app";
        const endpoint = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
          + encodeURIComponent(packageName) + "/purchases/subscriptionsv2/tokens/" + encodeURIComponent(purchaseToken);
        const googleResponse = await fetch(endpoint, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!googleResponse.ok) {
          billingStatusUnverified = true;
        } else {
          const purchase = await googleResponse.json();
          const lineItem = Array.isArray(purchase.lineItems) ? purchase.lineItems[0] : null;
          autoRenewing = lineItem?.autoRenewingPlan?.autoRenewEnabled ?? autoRenewing;
          currentPeriodEnd = lineItem?.expiryTime || currentPeriodEnd;
        }
      }
      resubscribeRequired = autoRenewing === false
        && Boolean(currentPeriodEnd && new Date(currentPeriodEnd).getTime() > Date.now());
    }

    const { data: restored, error: restoreError } = await userClient.rpc("vow_restore_account");
    if (restoreError || !["restored", "active"].includes(String(restored?.status))) {
      if (stripeResumed && entitlement?.stripe_subscription_id) {
        const secret = Deno.env.get("STRIPE_SECRET_KEY") || "";
        if (secret) {
          await fetch("https://api.stripe.com/v1/subscriptions/" + encodeURIComponent(entitlement.stripe_subscription_id), {
            method: "POST",
            headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ cancel_at_period_end: "true" }),
          }).catch(() => undefined);
        }
      }
      if (restoreError) return json({ error: "ACCOUNT_RESTORATION_FAILED" }, 503);
      return json({ status: String(restored?.status || "expired") });
    }

    await sendAccountPush(user.id,"Your VOW account has been restored","Your account is active again. Your saved goals and progress are ready.",{event:"account_restored"});

    return json({
      status: restored.status,
      provider: entitlement?.provider || null,
      resubscribe_required: resubscribeRequired,
      billing_status_unverified: billingStatusUnverified,
      current_period_end: currentPeriodEnd,
    });
  } catch (error) {
    console.error("[VOW] Account restoration failed:", error instanceof Error ? error.message : "UNKNOWN_ERROR");
    return json({ error: "ACCOUNT_RESTORATION_FAILED" }, 503);
  }
});
