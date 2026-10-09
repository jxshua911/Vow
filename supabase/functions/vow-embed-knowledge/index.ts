import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
function equal(a:string,b:string){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
type KnowledgeRow={id:string;domain:string|null;topic:string|null;title:string|null;content:string|null;principles:unknown;recommended_actions:unknown;metrics:unknown;cautions:unknown};
Deno.serve(async req=>{
  if(req.method!=="POST") return json({error:"POST_REQUIRED"},405);
  try{
    const secret=Deno.env.get("VOW_EMBED_SECRET")||"",provided=req.headers.get("x-vow-embed-secret")||"";
    if(!secret||!equal(secret,provided)) return json({error:"UNAUTHORIZED"},401);
    const body=await req.json().catch(()=>({}));
    const limit=Math.min(50,Math.max(1,Number(body.limit)||50));
    const {data:rows,error}=await db.from("vow_knowledge").select("id,domain,topic,title,content,principles,recommended_actions,metrics,cautions").eq("active",true).is("embedding",null).order("updated_at",{ascending:true}).limit(limit);
    if(error)throw error;
    if(!rows?.length)return json({ok:true,embedded:0,remaining:0});
    const key=Deno.env.get("OPENAI_API_KEY");if(!key)throw new Error("OPENAI_API_KEY_MISSING");
    const typedRows=rows as unknown as KnowledgeRow[];
    const input=typedRows.map(r=>[r.domain,r.topic,r.title,r.content,JSON.stringify(r.principles||[]),JSON.stringify(r.recommended_actions||[]),JSON.stringify(r.metrics||[]),JSON.stringify(r.cautions||[])].join("\n"));
    const response=await fetch("https://api.openai.com/v1/embeddings",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"text-embedding-3-small",dimensions:384,input})});
    if(!response.ok)throw new Error(`OPENAI_EMBEDDING_${response.status}`);
    const payload=await response.json();
    for(let i=0;i<typedRows.length;i++){const vector=payload?.data?.[i]?.embedding;if(!Array.isArray(vector)||vector.length!==384)throw new Error("EMBEDDING_DIMENSION_MISMATCH");const {error:e}=await db.from("vow_knowledge").update({embedding:vector}).eq("id",typedRows[i].id);if(e)throw e;}
    const {count,error:ce}=await db.from("vow_knowledge").select("id",{count:"exact",head:true}).eq("active",true).is("embedding",null);if(ce)throw ce;
    return json({ok:true,embedded:typedRows.length,remaining:count||0,model:"text-embedding-3-small",dimensions:384});
  }catch(e){return json({error:e instanceof Error?e.message:"EMBED_FAILED"},500);}
});