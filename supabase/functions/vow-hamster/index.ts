import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  return new Response(JSON.stringify({error:"VOW_PLANNER_RETIRED",message:"This legacy planning endpoint has been retired. Use vow-goal-ai."}),{status:410,headers:CORS});
});