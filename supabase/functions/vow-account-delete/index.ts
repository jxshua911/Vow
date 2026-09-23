import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:CORS});
function adminClient(){return createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});}
function authClient(req:Request){return createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||"",{global:{headers:{Authorization:req.headers.get("Authorization")||""}}});}
async function revokeGoogle(token:string){try{await fetch("https://oauth2.googleapis.com/revoke",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({token})});}catch{ /* best-effort external revocation */ }}
async function revokeStrava(token:string){try{await fetch("https://www.strava.com/oauth/deauthorize",{method:"POST",headers:{Authorization:`Bearer ${token}`}});}catch{ /* best-effort external revocation */ }}
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
  const {error:deleteDataError}=await admin.rpc("delete_user_account_data",{p_user_id:user.id});if(deleteDataError)return json({error:"DATA_DELETION_FAILED"},500);
  const {error:deleteUserError}=await admin.auth.admin.deleteUser(user.id);if(deleteUserError)return json({error:"AUTH_ACCOUNT_DELETION_FAILED"},500);
  return json({deleted:true});
});