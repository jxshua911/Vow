import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { SignJWT, importPKCS8 } from "npm:jose@6.1.0";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:CORS});
function adminClient(){return createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});}
function authClient(req:Request){return createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"",{global:{headers:{Authorization:req.headers.get("Authorization")||""}}});}
type GoogleServiceAccount={client_email:string;private_key:string;token_uri?:string};
async function googleAccessToken(account:GoogleServiceAccount){
  const now=Math.floor(Date.now()/1000);
  const key=await importPKCS8(account.private_key,"RS256");
  const assertion=await new SignJWT({scope:"https://www.googleapis.com/auth/androidpublisher"})
    .setProtectedHeader({alg:"RS256",typ:"JWT"}).setIssuer(account.client_email)
    .setAudience(account.token_uri??"https://oauth2.googleapis.com/token")
    .setIssuedAt(now).setExpirationTime(now+3600).sign(key);
  const response=await fetch(account.token_uri??"https://oauth2.googleapis.com/token",{
    method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion}),
  });
  if(!response.ok)throw new Error("GOOGLE_OAUTH_FAILED");
  const token=await response.json();
  if(typeof token.access_token!=="string"||!token.access_token)throw new Error("GOOGLE_ACCESS_TOKEN_MISSING");
  return token.access_token as string;
}
async function stopStripeRenewal(subscriptionId:string,secret:string){
  const response=await fetch("https://api.stripe.com/v1/subscriptions/"+encodeURIComponent(subscriptionId),{
    method:"POST",headers:{Authorization:`Bearer ${secret}`,"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({cancel_at_period_end:"true"}),
  });
  if(!response.ok)throw new Error("STRIPE_RENEWAL_CANCELLATION_FAILED");
}
async function stopGooglePlayRenewal(purchaseToken:string,packageName:string,account:GoogleServiceAccount){
  const accessToken=await googleAccessToken(account);
  const base="https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
    +encodeURIComponent(packageName)+"/purchases/subscriptionsv2/tokens/"+encodeURIComponent(purchaseToken);
  const currentResponse=await fetch(base,{headers:{Authorization:`Bearer ${accessToken}`}});
  if(!currentResponse.ok)throw new Error("GOOGLE_PLAY_SUBSCRIPTION_LOOKUP_FAILED");
  const current=await currentResponse.json();
  const lineItem=Array.isArray(current.lineItems)?current.lineItems[0]:null;
  if(lineItem?.autoRenewingPlan?.autoRenewEnabled===false)return;
  const response=await fetch(base+":cancel",{
    method:"POST",headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},
    body:JSON.stringify({cancellationContext:{cancellationType:"USER_REQUESTED_STOP_RENEWALS"}}),
  });
  if(!response.ok)throw new Error("GOOGLE_PLAY_RENEWAL_CANCELLATION_FAILED");
}
async function stopRenewalForAccount(admin:ReturnType<typeof createClient<any>>,userId:string){
  const {data:billing,error}=await admin.from("vow_user_entitlements")
    .select("provider,stripe_subscription_id,status").eq("user_id",userId).maybeSingle();
  if(error)throw new Error("BILLING_LOOKUP_FAILED");
  if(!billing||!["active","grace"].includes(String(billing.status)))return;
  if(billing.provider==="stripe"){
    const subscriptionId=String(billing.stripe_subscription_id||"").trim();
    const secret=Deno.env.get("STRIPE_SECRET_KEY")||"";
    if(!subscriptionId||!secret)throw new Error("STRIPE_CANCELLATION_NOT_CONFIGURED");
    await stopStripeRenewal(subscriptionId,secret);
    return;
  }
  if(billing.provider==="google_play"){
    const {data:subscription,error:subscriptionError}=await admin.from("vow_subscription_records")
      .select("provider_purchase_id,auto_renewing").eq("user_id",userId).eq("provider","google_play")
      .in("status",["active","grace","cancelled"]).order("current_period_end",{ascending:false}).limit(1).maybeSingle();
    if(subscriptionError)throw new Error("GOOGLE_PLAY_SUBSCRIPTION_LOOKUP_FAILED");
    if(subscription?.auto_renewing===false)return;
    const purchaseToken=String(subscription?.provider_purchase_id||"").trim();
    const raw=Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON")||"";
    if(!purchaseToken||!raw)throw new Error("GOOGLE_PLAY_CANCELLATION_NOT_CONFIGURED");
    let account:GoogleServiceAccount;
    try{account=JSON.parse(raw) as GoogleServiceAccount;}catch{throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_INVALID");}
    await stopGooglePlayRenewal(purchaseToken,Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME")||"com.vow.app",account);
  }
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  if(!(req.headers.get("Authorization")||"").startsWith("Bearer "))return json({error:"AUTH_REQUIRED"},401);
  let body:{confirm?:boolean};try{body=await req.json();}catch{return json({error:"INVALID_JSON"},400);}
  if(body.confirm!==true)return json({error:"CONFIRMATION_REQUIRED"},400);
  const auth=authClient(req);const {data:{user},error:userError}=await auth.auth.getUser();
  if(userError||!user)return json({error:"AUTH_REQUIRED"},401);
  const admin=adminClient();
  let deletedAt=new Date().toISOString();
  let deletionExpiresAt=new Date(Date.now()+14*24*60*60*1000).toISOString();
  const {data:existingSettings,error:settingsReadError}=await admin.from("user_settings")
    .select("user_id,account_status,deleted_at,deletion_expires_at").eq("user_id",user.id).maybeSingle();
  if(settingsReadError)return json({error:"ACCOUNT_STATE_READ_FAILED"},500);
  if(existingSettings?.account_status==="purging")return json({error:"ACCOUNT_PURGE_ALREADY_STARTED"},409);
  const priorDeletedAt=Date.parse(String(existingSettings?.deleted_at||""));
  const priorDeletionExpiresAt=Date.parse(String(existingSettings?.deletion_expires_at||""));
  const existingDeletionIsValid=existingSettings?.account_status==="deleted"
    &&Number.isFinite(priorDeletedAt)&&Number.isFinite(priorDeletionExpiresAt);
  let settingsWriteError:{message?:string}|null=null;
  if(existingDeletionIsValid){
    deletedAt=new Date(priorDeletedAt).toISOString();
    deletionExpiresAt=new Date(priorDeletionExpiresAt).toISOString();
  }else if(existingSettings){
    const result=await admin.from("user_settings").update({
      account_status:"deleted",deleted_at:deletedAt,deletion_expires_at:deletionExpiresAt,updated_at:new Date().toISOString(),
    }).eq("user_id",user.id);
    settingsWriteError=result.error;
  }else{
    const result=await admin.from("user_settings").insert({
      user_id:user.id,timezone:"UTC",notification_frequency:"weekly",coaching_tone:"honest_encouraging",
      onboarding_complete:false,account_status:"deleted",deleted_at:deletedAt,deletion_expires_at:deletionExpiresAt,
      updated_at:new Date().toISOString(),
    });
    settingsWriteError=result.error;
  }
  if(settingsWriteError)return json({error:"ACCOUNT_STATE_WRITE_FAILED"},500);

  // Stop renewal now while preserving the already-paid period. Stripe's
  // cancel_at_period_end is reversible during restoration; Google Play's
  // USER_REQUESTED_STOP_RENEWALS preserves the current entitlement period.
  try{
    await stopRenewalForAccount(admin,user.id);
  }catch(error){
    if(!existingDeletionIsValid){
      await admin.from("user_settings").update({
        account_status:"active",deleted_at:null,deletion_expires_at:null,updated_at:new Date().toISOString(),
      }).eq("user_id",user.id);
    }
    console.error("[VOW] Subscription renewal cancellation failed:",error instanceof Error?error.message:"UNKNOWN_ERROR");
    return json({error:"SUBSCRIPTION_CANCELLATION_FAILED",message:"Account deletion was not completed because subscription renewal could not be safely stopped. Please try again or contact support."},503);
  }

  const {error:pushDeviceCleanupError}=await admin.from("vow_push_devices").delete().eq("user_id",user.id);
  if(pushDeviceCleanupError)console.warn("[VOW] Account is pending deletion but push-device cleanup needs retry.");
  await admin.from("reminder_preferences").update({enabled:false,updated_at:new Date().toISOString()}).eq("user_id",user.id);

  if(Date.parse(deletionExpiresAt)>Date.now()){
    try{
      const {error:deletionEmailError}=await admin.functions.invoke("vow-account-deletion-confirmation-email",{
        body:{user_id:user.id,deleted_at:deletedAt,restorable_until:deletionExpiresAt},
      });
      if(deletionEmailError)console.warn("[VOW] Account deletion succeeded but confirmation email could not be sent.");
    }catch{console.warn("[VOW] Account deletion succeeded but confirmation email could not be sent.");}
  }
  return json({deleted:true,restorable_until:deletionExpiresAt});
});
