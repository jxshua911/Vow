import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { SignJWT, importPKCS8 } from "npm:jose@6.1.0";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:CORS});
function adminClient(){return createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});}
function authClient(req:Request){return createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"",{global:{headers:{Authorization:req.headers.get("Authorization")||""}}});}
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
    .setSubject(account.client_email)
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
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  if(!(req.headers.get("Authorization")||"").startsWith("Bearer "))return json({error:"AUTH_REQUIRED"},401);
  let body:{confirm?:boolean};try{body=await req.json();}catch{return json({error:"INVALID_JSON"},400);}
  if(body.confirm!==true)return json({error:"CONFIRMATION_REQUIRED"},400);
  const auth=authClient(req);const {data:{user},error:userError}=await auth.auth.getUser();if(userError||!user)return json({error:"AUTH_REQUIRED"},401);
  const admin=adminClient();
  const {data:billing}=await admin.from("vow_user_entitlements").select("provider,stripe_subscription_id,status").eq("user_id",user.id).maybeSingle();
  if(billing?.provider==="stripe"&&billing.stripe_subscription_id&&["active","grace"].includes(billing.status)){const stripeSecret=Deno.env.get("STRIPE_SECRET_KEY")||"";if(!stripeSecret)return json({error:"STRIPE_CANCELLATION_NOT_CONFIGURED"},503);try{await cancelStripe(billing.stripe_subscription_id,stripeSecret);}catch{return json({error:"STRIPE_SUBSCRIPTION_CANCELLATION_FAILED"},502);}}
  if(billing?.provider==="google_play"&&["active","grace"].includes(billing.status)){
    const {data:playSubscription,error:playSubscriptionError}=await admin.from("vow_subscription_records")
      .select("provider_purchase_id,current_period_end,auto_renewing")
      .eq("user_id",user.id)
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
  const [{data:google},{data:strava}]=await Promise.all([
    admin.from("google_calendar_connections").select("access_token,refresh_token").eq("user_id",user.id).maybeSingle(),
    admin.from("strava_connections").select("access_token,refresh_token").eq("user_id",user.id).maybeSingle(),
  ]);
  await Promise.all([google?.refresh_token?revokeGoogle(google.refresh_token):Promise.resolve(),google?.access_token?revokeGoogle(google.access_token):Promise.resolve(),strava?.access_token?revokeStrava(strava.access_token):Promise.resolve()]);
  let deletedAt = new Date().toISOString();
  let deletionExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const {data:existingSettings,error:settingsReadError}=await admin.from("user_settings")
    .select("user_id,account_status,deleted_at,deletion_expires_at")
    .eq("user_id",user.id)
    .maybeSingle();
  if(settingsReadError)return json({error:"ACCOUNT_STATE_READ_FAILED"},500);

  const priorDeletedAt = Date.parse(String(existingSettings?.deleted_at || ""));
  const priorDeletionExpiresAt = Date.parse(String(existingSettings?.deletion_expires_at || ""));
  const existingDeletionIsValid = existingSettings?.account_status === "deleted"
    && Number.isFinite(priorDeletedAt)
    && Number.isFinite(priorDeletionExpiresAt);
  let settingsWriteError: { message?: string } | null = null;

  if (existingDeletionIsValid) {
    // Repeated requests must never restart or extend the 14-day grace period.
    // Reuse the original timestamps so the confirmation email's idempotency key remains stable.
    deletedAt = new Date(priorDeletedAt).toISOString();
    deletionExpiresAt = new Date(priorDeletionExpiresAt).toISOString();
  } else if(existingSettings) {
    const result = await admin.from("user_settings").update({
      account_status:"deleted",
      deleted_at:deletedAt,
      deletion_expires_at:deletionExpiresAt,
      updated_at:new Date().toISOString(),
    }).eq("user_id",user.id);
    settingsWriteError = result.error;
  } else {
    const result = await admin.from("user_settings").insert({
      user_id:user.id,
      timezone:"UTC",
      notification_frequency:"weekly",
      coaching_tone:"honest_encouraging",
      onboarding_complete:false,
      account_status:"deleted",
      deleted_at:deletedAt,
      deletion_expires_at:deletionExpiresAt,
      updated_at:new Date().toISOString(),
    });
    settingsWriteError = result.error;
  }
  if(settingsWriteError)return json({error:"ACCOUNT_STATE_WRITE_FAILED"},500);
  // Deletion state is authoritative. Email delivery is best-effort and must
  // never turn a successful deletion request into an apparent failure.
  if (Date.parse(deletionExpiresAt) > Date.now()) {
    try {
      const { error: deletionEmailError } = await admin.functions.invoke("vow-account-deletion-confirmation-email", {
        body: { user_id: user.id, deleted_at: deletedAt, restorable_until: deletionExpiresAt },
      });
      if (deletionEmailError) console.warn("[VOW] Account deletion succeeded but confirmation email could not be sent.");
    } catch {
      console.warn("[VOW] Account deletion succeeded but confirmation email could not be sent.");
    }
  }
  return json({deleted:true,restorable_until:deletionExpiresAt});
});