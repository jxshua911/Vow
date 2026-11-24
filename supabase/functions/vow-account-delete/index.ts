import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { SignJWT, importPKCS8 } from "npm:jose@6.1.0";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:CORS});
function adminClient(){return createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});}
function authClient(req:Request){return createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"",{global:{headers:{Authorization:req.headers.get("Authorization")||""}}});}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  if(!(req.headers.get("Authorization")||"").startsWith("Bearer "))return json({error:"AUTH_REQUIRED"},401);
  let body:{confirm?:boolean};try{body=await req.json();}catch{return json({error:"INVALID_JSON"},400);}
  if(body.confirm!==true)return json({error:"CONFIRMATION_REQUIRED"},400);
  const auth=authClient(req);const {data:{user},error:userError}=await auth.auth.getUser();if(userError||!user)return json({error:"AUTH_REQUIRED"},401);
  const admin=adminClient();
  const { error: pushDeviceCleanupError } = await admin.from("vow_push_devices").delete().eq("user_id", user.id);
  if (pushDeviceCleanupError) return json({error:"PUSH_REGISTRATION_CLEANUP_FAILED"},500);
  await admin.from("reminder_preferences").update({enabled:false,updated_at:new Date().toISOString()}).eq("user_id",user.id);
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