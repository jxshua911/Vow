import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:CORS});
function adminClient(){return createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});}
function authClient(req:Request){return createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"",{global:{headers:{Authorization:req.headers.get("Authorization")||""}}});}
async function revokeGoogle(token:string){try{await fetch("https://oauth2.googleapis.com/revoke",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({token})});}catch{ /* best-effort external revocation */ }}
async function revokeStrava(token:string){try{await fetch("https://www.strava.com/oauth/deauthorize",{method:"POST",headers:{Authorization:`Bearer ${token}`}});}catch{ /* best-effort external revocation */ }}
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,(character)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]||character));
async function cancelStripe(subscriptionId:string,secret:string){const response=await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,{method:"DELETE",headers:{Authorization:`Bearer ${secret}`}});if(!response.ok)throw new Error("STRIPE_SUBSCRIPTION_CANCELLATION_FAILED");}
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
  const [{data:google},{data:strava}]=await Promise.all([
    admin.from("google_calendar_connections").select("access_token,refresh_token").eq("user_id",user.id).maybeSingle(),
    admin.from("strava_connections").select("access_token,refresh_token").eq("user_id",user.id).maybeSingle(),
  ]);
  await Promise.all([google?.refresh_token?revokeGoogle(google.refresh_token):Promise.resolve(),google?.access_token?revokeGoogle(google.access_token):Promise.resolve(),strava?.access_token?revokeStrava(strava.access_token):Promise.resolve()]);
  const deletionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const {data:existingSettings,error:settingsReadError}=await admin.from("user_settings").select("user_id").eq("user_id",user.id).maybeSingle();
  if(settingsReadError)return json({error:"ACCOUNT_STATE_READ_FAILED"},500);
  const {error:settingsWriteError}=existingSettings
    ? await admin.from("user_settings").update({
        account_status:"deleted",
        deleted_at:new Date().toISOString(),
        deletion_expires_at:deletionExpiresAt,
        updated_at:new Date().toISOString(),
      }).eq("user_id",user.id)
    : await admin.from("user_settings").insert({
        user_id:user.id,
        timezone:"UTC",
        notification_frequency:"weekly",
        coaching_tone:"honest_encouraging",
        onboarding_complete:false,
        account_status:"deleted",
        deleted_at:new Date().toISOString(),
        deletion_expires_at:deletionExpiresAt,
        updated_at:new Date().toISOString(),
      });
  if(settingsWriteError)return json({error:"ACCOUNT_STATE_WRITE_FAILED"},500);
  // This is a deletion-request acknowledgement, not a permanent-deletion receipt.
  // Production currently uses a 30-day recovery window and has no verified purge job.
  let deletionEmailSent=false;
  const resendKey=Deno.env.get("RESEND_API_KEY")?.trim();
  if(resendKey&&user.email){
    const restoreDate=new Date(deletionExpiresAt).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric",timeZone:"UTC"});
    const subject="We received your VOW account deletion request";
    const text=[
      "Hi "+String(user.user_metadata?.full_name||user.user_metadata?.name||"there").trim().slice(0,100)+",","",
      "We received your request to delete your VOW account. Your account is now in a 30-day recovery window, through "+restoreDate+".",
      "You can restore your account before that date using VOW's account restoration flow.","",
      "Important: this email confirms your deletion request and recovery window only. It does not confirm that your account or its data has been permanently deleted. We will only send a separate completion notice if permanent deletion is actually completed.","",
      "VOW Support","https://vowglobal.online",
    ].join("\n");
    const html=`<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto;color:#202020;line-height:1.6"><p>Hi ${escapeHtml(String(user.user_metadata?.full_name||user.user_metadata?.name||"there").trim().slice(0,100))},</p><p>We received your request to delete your VOW account. Your account is now in a <strong>30-day recovery window</strong>, through ${escapeHtml(restoreDate)}.</p><p>You can restore your account before that date using VOW's account restoration flow.</p><p><strong>Important:</strong> this email confirms your deletion request and recovery window only. It does not confirm that your account or its data has been permanently deleted. We will only send a separate completion notice if permanent deletion is actually completed.</p><p>VOW Support<br><a href="https://vowglobal.online">vowglobal.online</a></p></div>`;
    try{
      const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${resendKey}`,"Content-Type":"application/json","Idempotency-Key":`vow-account-deletion-request-${user.id}-${deletionExpiresAt}`},body:JSON.stringify({from:(Deno.env.get("VOW_SUPPORT_FROM_EMAIL")||"VOW Support <support@vowglobal.online>").trim(),to:[user.email],subject,text,html,tags:[{name:"category",value:"account-deletion-request"}]})});
      const result=await response.json().catch(()=>({}));
      deletionEmailSent=response.ok&&typeof result?.id==="string";
      if(!deletionEmailSent)console.error("[VOW Account Delete] Request acknowledgement email was not accepted:",response.status);
    }catch{console.error("[VOW Account Delete] Request acknowledgement email delivery failed.");}
  }else{
    console.warn("[VOW Account Delete] Request acknowledgement email was not sent because email configuration or account email is unavailable.");
  }
  return json({deleted:true,restorable_until:deletionExpiresAt,deletion_email_sent:deletionEmailSent});
});