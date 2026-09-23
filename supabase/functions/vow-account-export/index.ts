import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const HEADERS={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:HEADERS});
const TABLES=[
  "user_settings","goals","commitment_log","data_requests","goal_clarification_answers","goal_dependencies",
  "goal_evidence","goal_milestones","goal_plan_items","goal_reminders","goal_resources","milestones",
  "plan_adjustments","sessions","journal_entries","journal_insights","reviews","reminder_preferences",
  "raven_awards","raven_weekly_snapshots","moderation_appeals","moderation_events","moderation_ip_bans",
  "offline_operations","user_entitlements","vow_user_entitlements","vow_ai_usage","vow_ai_usage_events",
  "vow_ai_request_leases","vow_app_events","vow_payment_events","vow_subscription_records","vow_terms_acceptances",
  "integration_connections","google_calendar_connections","strava_connections","strava_oauth_states"
] as const;

function admin(){return createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:HEADERS});
  if(req.method!=="POST") return json({error:"METHOD_NOT_ALLOWED"},405);
  try{
    const authHeader=req.headers.get("Authorization")||"";
    if(!authHeader.startsWith("Bearer ")) return json({error:"AUTH_REQUIRED"},401);
    const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")||"",{global:{headers:{Authorization:authHeader}}});
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError||!user) return json({error:"AUTH_REQUIRED"},401);
    const db=admin();
    const exported:Record<string,unknown>={exported_at:new Date().toISOString(),account:{id:user.id,email:user.email||null,created_at:user.created_at}};
    for(const table of TABLES){
      let query=db.from(table).select("*").eq("user_id",user.id);
      if(table==="google_calendar_connections"||table==="strava_connections"){
        query=table==="google_calendar_connections"
          ? db.from(table).select("id,user_id,expires_at,scope,created_at,updated_at,oauth_state_expires_at,oauth_redirect_uri,google_account_id,google_account_email").eq("user_id",user.id)
          : db.from(table).select("id,user_id,athlete_id,expires_at,scope,updated_at,created_at").eq("user_id",user.id);
      }
      const {data,error}=await query;
      if(error) return json({error:"EXPORT_FAILED"},500);
      exported[table]=data||[];
    }
    const {error:requestError}=await db.from("data_requests").insert({user_id:user.id,request_type:"export",status:"completed",completed_at:new Date().toISOString()});
    if(requestError) return json({error:"EXPORT_RECORD_FAILED"},500);
    return json({exported});
  }catch(error){
    console.error("vow-account-export",{error:error instanceof Error?error.message:"EXPORT_FAILED"});
    return json({error:"EXPORT_FAILED"},500);
  }
});