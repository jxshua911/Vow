import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
Deno.serve(async req=>{
  if(req.method!=="POST") return json({error:"POST_REQUIRED"},405);
  try{
    const expected=Deno.env.get("VOW_SNAPSHOT_CRON_SECRET")||"";
    const provided=req.headers.get("x-vow-cron-secret")||"";
    if(!expected||provided.length!==expected.length) return json({error:"UNAUTHORIZED"},401);
    let diff=0; for(let i=0;i<expected.length;i++) diff|=provided.charCodeAt(i)^expected.charCodeAt(i);
    if(diff!==0) return json({error:"UNAUTHORIZED"},401);
    const body=await req.json().catch(()=>({}));
    let weekStart=typeof body.week_start==="string"?body.week_start:null;
    if(!weekStart){const d=new Date();const day=d.getUTCDay();d.setUTCDate(d.getUTCDate()-(day===0?6:day-1)-7);weekStart=d.toISOString().slice(0,10);}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return json({error:"INVALID_WEEK_START"},400);
    const start=new Date(`${weekStart}T00:00:00Z`);const end=new Date(start);end.setUTCDate(end.getUTCDate()+7);
    const {data:users,error}=await db.from("sessions").select("user_id").gte("scheduled_at",start.toISOString()).lt("scheduled_at",end.toISOString()).limit(100000);
    if(error) throw error;
    const ids=[...new Set((users||[]).map((x:any)=>x.user_id))];
    let created=0; for(const userId of ids){const {error:e}=await db.rpc("create_raven_weekly_snapshot",{p_user_id:userId,p_week_start:weekStart});if(e)throw e;created++;}
    return json({ok:true,week_start:weekStart,snapshots_created:created});
  }catch(e){return json({error:e instanceof Error?e.message:"SNAPSHOT_FAILED"},500);}
});