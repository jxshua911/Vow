import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vow-account-purge-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const BUCKET = "goal-resources";
const PAGE_SIZE = 100;
const MAX_OBJECTS = 10000;
const MAX_FOLDER_DEPTH = 6;

type StorageListItem = {
  name: string;
  id?: string | null;
  metadata?: Record<string, unknown> | null;
};

async function listUserObjects(
  admin: ReturnType<typeof createClient<any>>,
  prefix: string,
  depth = 0,
  output: string[] = [],
): Promise<string[]> {
  if (depth > MAX_FOLDER_DEPTH) throw new Error("STORAGE_FOLDER_DEPTH_EXCEEDED");
  let offset = 0;

  while (true) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error("STORAGE_OBJECT_LIST_FAILED");

    const items = (data || []) as StorageListItem[];
    for (const item of items) {
      if (!item.name || item.name === "." || item.name === "..") continue;
      const path = `${prefix}/${item.name}`;
      const isFolder = item.id == null && item.metadata == null;
      if (isFolder) {
        await listUserObjects(admin, path, depth + 1, output);
      } else {
        output.push(path);
        if (output.length > MAX_OBJECTS) throw new Error("STORAGE_OBJECT_LIMIT_EXCEEDED");
      }
    }

    if (items.length < PAGE_SIZE) break;
    offset += items.length;
  }

  return output;
}

async function revokeGoogle(token:string){try{await fetch("https://oauth2.googleapis.com/revoke",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({token})});}catch{ /* best-effort external revocation */ }}
async function revokeStrava(token:string){try{await fetch("https://www.strava.com/oauth/deauthorize",{method:"POST",headers:{Authorization:`Bearer ${token}`}});}catch{ /* best-effort external revocation */ }}
async function cancelStripe(subscriptionId:string,secret:string){const response=await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,{method:"DELETE",headers:{Authorization:`Bearer ${secret}`}});if(!response.ok)throw new Error("STRIPE_SUBSCRIPTION_CANCELLATION_FAILED");}
type GoogleServiceAccount = { client_email: string; private_key: string; token_uri?: string };
async function googleAccessToken(account: GoogleServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(account.private_key, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/androidpublisher" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setAudience(account.token_uri ?? "https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const tokenResponse = await fetch(account.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!tokenResponse.ok) throw new Error("GOOGLE_OAUTH_FAILED");
  const token = await tokenResponse.json();
  if (typeof token.access_token !== "string" || !token.access_token) throw new Error("GOOGLE_ACCESS_TOKEN_MISSING");
  return token.access_token as string;
}
async function cancelGooglePlaySubscription(purchaseToken: string, packageName: string, account: GoogleServiceAccount) {
  const accessToken = await googleAccessToken(account);
  const endpoint = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}:cancel`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ cancellationContext: { cancellationType: "USER_REQUESTED_STOP_RENEWALS" } }),
  });
  if (!response.ok) throw new Error("GOOGLE_PLAY_SUBSCRIPTION_CANCELLATION_FAILED");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const suppliedSecret = req.headers.get("x-vow-account-purge-secret") || "";
    if (!suppliedSecret) return json({ error: "Not authorized." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Account purge: Supabase runtime configuration is missing.");
      return json({ error: "Account deletion is temporarily unavailable." }, 503);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authorized, error: authorizationError } = await admin.rpc("vow_validate_account_purge_cron_secret", {
      p_secret: suppliedSecret,
    });
    if (authorizationError || authorized !== true) return json({ error: "Not authorized." }, 401);

    const { data: expiredAccounts, error: expiredLookupError } = await admin
      .from("user_settings")
      .select("user_id,deletion_expires_at")
      .eq("account_status", "deleted")
      .not("deletion_expires_at", "is", null)
      .lte("deletion_expires_at", new Date().toISOString())
      .order("deletion_expires_at", { ascending: true })
      .limit(50);
    if (expiredLookupError) throw new Error("EXPIRED_ACCOUNT_LOOKUP_FAILED");

    let purged = 0;
    const failed: string[] = [];
    for (const account of expiredAccounts || []) {
      const userId = String(account.user_id || "");
      if (!userId) continue;
      try {
        // Re-check eligibility immediately before destructive work. A restored
        // account must never be deleted by a stale batch result.
        const { data: current, error: currentError } = await admin
          .from("user_settings")
          .select("account_status,deletion_expires_at")
          .eq("user_id", userId)
          .maybeSingle();
        if (currentError) throw new Error("ACCOUNT_STATE_RECHECK_FAILED");
        if (!current || current.account_status !== "deleted" || !current.deletion_expires_at
            || new Date(current.deletion_expires_at).getTime() > Date.now()) continue;

        // External billing cancellation and OAuth revocation are deferred until
        // the 14-day restoration window has expired. A restored account keeps its
        // existing provider subscription and connected services.
        const {data:billing}=await admin.from("vow_user_entitlements").select("provider,stripe_subscription_id,status").eq("user_id",userId).maybeSingle();
        if(billing?.provider==="stripe"&&billing.stripe_subscription_id&&["active","grace"].includes(billing.status)){const stripeSecret=Deno.env.get("STRIPE_SECRET_KEY")||"";if(!stripeSecret)return json({error:"STRIPE_CANCELLATION_NOT_CONFIGURED"},503);try{await cancelStripe(billing.stripe_subscription_id,stripeSecret);}catch{return json({error:"STRIPE_SUBSCRIPTION_CANCELLATION_FAILED"},502);}}
        if(billing?.provider==="google_play"&&["active","grace"].includes(billing.status)){
        const {data:playSubscription,error:playSubscriptionError}=await admin.from("vow_subscription_records")
        .select("provider_purchase_id,current_period_end,auto_renewing")
        .eq("user_id",userId)
        .eq("provider","google_play")
        .in("status",["active","grace"])
        .order("current_period_end",{ascending:false})
        .limit(1)
        .maybeSingle();
        if(playSubscriptionError)return json({error:"GOOGLE_PLAY_SUBSCRIPTION_LOOKUP_FAILED"},500);
        if(playSubscription?.auto_renewing!==false){
        const purchaseToken=String(playSubscription?.provider_purchase_id||"").trim();
        if(!purchaseToken)return json({error:"GOOGLE_PLAY_CANCELLATION_NOT_CONFIGURED"},503);
        const serviceAccountJson=Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON")||"";
        const packageName=Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME")||"com.vow.app";
        if(!serviceAccountJson)return json({error:"GOOGLE_PLAY_CANCELLATION_NOT_CONFIGURED"},503);
        try{
        const account=JSON.parse(serviceAccountJson) as GoogleServiceAccount;
        await cancelGooglePlaySubscription(purchaseToken,packageName,account);
        }catch{
        return json({error:"GOOGLE_PLAY_SUBSCRIPTION_CANCELLATION_FAILED"},502);
        }
        }
        }
        
        const [{data:google},{data:strava}] = await Promise.all([
          admin.from("google_calendar_connections").select("access_token,refresh_token").eq("user_id",userId).maybeSingle(),
          admin.from("strava_connections").select("access_token,refresh_token").eq("user_id",userId).maybeSingle(),
        ]);
        await Promise.all([
          google?.refresh_token ? revokeGoogle(google.refresh_token) : Promise.resolve(),
          google?.access_token ? revokeGoogle(google.access_token) : Promise.resolve(),
          strava?.access_token ? revokeStrava(strava.access_token) : Promise.resolve(),
        ]);

        const objectPaths = await listUserObjects(admin, userId);
        for (let offset = 0; offset < objectPaths.length; offset += PAGE_SIZE) {
          const batch = objectPaths.slice(offset, offset + PAGE_SIZE);
          const { error: storageError } = await admin.storage.from(BUCKET).remove(batch);
          if (storageError) throw new Error("STORAGE_OBJECT_PURGE_FAILED");
        }

        // Remove user-linked moderation/IP records. Preserve only a minimal,
        // unlinked payment audit record where accounting history is required.
        const { error: moderationCleanupError } = await admin
          .from("moderation_ip_bans")
          .delete()
          .eq("user_id", userId);
        if (moderationCleanupError) throw new Error("MODERATION_DATA_PURGE_FAILED");

        const { error: paymentAuditCleanupError } = await admin
          .from("vow_payment_events")
          .update({ user_id: null, metadata: {} })
          .eq("user_id", userId);
        if (paymentAuditCleanupError) throw new Error("PAYMENT_AUDIT_ANONYMIZATION_FAILED");

        const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
        if (deleteError) throw new Error("AUTH_USER_DELETE_FAILED");
        purged += 1;
      } catch (error) {
        failed.push(userId);
        console.error("[VOW] Permanent account purge failed:", error instanceof Error ? error.message : "UNKNOWN_ERROR");
      }
    }

    return json({ processed: (expiredAccounts || []).length, purged, failed: failed.length });
  } catch (error) {
    console.error("Account purge failed:", error instanceof Error ? error.message : "UNKNOWN_ERROR");
    return json({ error: "Account deletion is temporarily unavailable." }, 503);
  }
});
