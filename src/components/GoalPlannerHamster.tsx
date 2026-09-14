import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { checkContentSafety } from '@/lib/contentSafety';
import { analyseGoalForEvidence, type ArmadilloResult } from '@/lib/armadillo';
import { inferHamsterMode, buildHamsterContext, HAMSTER_WORKFLOWS, type HamsterMode } from '@/lib/hamster';
import { specialistFor } from '@/lib/domainRouter';
import { PageHeader } from './AppShell';

type DraftGoal={id:string;title?:string|null;outcome?:string|null;why_it_matters?:string|null;duration?:string|null;plan_json?:unknown};
type HamsterPlan={mode:HamsterMode;domain:string;completion_definition:string;overview:string;success_metric:string;horizon:string;cadence:string;deadline:string|null;steps:Array<{order:number;title:string;purpose:string;target:string;evidence:string;estimated_minutes:number}>;milestones:Array<{title:string;description:string}>;adaptation_rules:string[];next_action:string;workflow?:Record<string,unknown>;knowledge_count?:number};
type ClarificationQuestion={key:string;question:string};
type ClarificationRow={key?:unknown;question?:unknown;answer?:unknown;question_order?:unknown};

const USER_MESSAGES = {
 retryable_ai: 'VOW saved your goal and is ready to try the planning step again.',
 clarification_unavailable: 'VOW could not finish the questions yet, but your goal is saved.',
 plan_unavailable: 'VOW saved your goal. You can retry the plan when the planning service is available.',
 invalid_request: 'VOW needs a little more information to continue.',
 unsafe: 'That goal cannot be processed by VOW.'
};
function safeHamsterMessage(value: unknown, fallback: string) {
 const raw = value instanceof Error ? value.message : typeof value === 'string' ? value : '';
 const internalCodes = ['HAMSTER_DISCOVERY_FAILED','HAMSTER_EMPTY_PLAN','VOW could not','VOW requires','Missing required clarification input','Answer every VOW question','VOW did not','VOW returned'];
 if (internalCodes.some(code => raw.includes(code))) return fallback;
 return raw || fallback;
}

const PLAN_PLACEHOLDERS=[/^step\s*\d+$/i,/^complete the action\.?$/i,/^complete the next action required for this goal\.?$/i,/^record what was completed\.?$/i,/^milestone$/i];
function meaningfulGoalTokens(goal:string){return goal.toLowerCase().split(/[^a-z0-9+#.\-]+/i).map(token=>token.trim()).filter(token=>token.length>=4&&!['want','learn','how','what','with','from','into','this','that','make','become','need','goal','please','help'].includes(token));}
function planIntegrity(value:unknown, goal:string){
 if(!value||typeof value!=='object')return false;
 const source=value as Record<string,unknown>;
 if(typeof source.domain!=='string'||!source.domain.trim()||typeof source.completion_definition!=='string'||!source.completion_definition.trim()||typeof source.overview!=='string'||!source.overview.trim()||typeof source.success_metric!=='string'||!source.success_metric.trim()||typeof source.next_action!=='string'||!source.next_action.trim())return false;
 if(!Array.isArray(source.steps)||source.steps.length<2)return false;
 const steps=source.steps as unknown[];
 if(steps.some(item=>{if(!item||typeof item!=='object')return true;const step=item as Record<string,unknown>;const title=typeof step.title==='string'?step.title.trim():'';const purpose=typeof step.purpose==='string'?step.purpose.trim():'';const target=typeof step.target==='string'?step.target.trim():'';const evidence=typeof step.evidence==='string'?step.evidence.trim():'';return !title||!purpose||!target||!evidence||PLAN_PLACEHOLDERS.some(pattern=>pattern.test(title)||pattern.test(purpose)||pattern.test(target)||pattern.test(evidence));}))return false;
 const body=JSON.stringify(source).toLowerCase();
 const tokens=meaningfulGoalTokens(goal);
 return tokens.length===0||tokens.some(token=>body.includes(token));
}
function normalisePlan(value: unknown, expectedMode: HamsterMode, duration: string|null): HamsterPlan {
 const source=value&&typeof value==='object'?value as Record<string,unknown>:{};
 const mode=expectedMode;
 const text=(key:string,fallback:string)=>typeof source[key]==='string'&&String(source[key]).trim()?String(source[key]).trim():fallback;
 const steps=Array.isArray(source.steps)?source.steps.map((item,index)=>{
  const step=item&&typeof item==='object'?item as Record<string,unknown>:{};
  const hasNumericOrder=typeof step.order==='number'&&Number.isFinite(step.order);
  const hasNumericMinutes=typeof step.estimated_minutes==='number'&&Number.isFinite(step.estimated_minutes);
  return {order:hasNumericOrder?Number(step.order):index+1,title:textFrom(step.title,''),purpose:textFrom(step.purpose,''),target:textFrom(step.target,''),evidence:textFrom(step.evidence,''),estimated_minutes:hasNumericMinutes?Math.max(0,Math.round(Number(step.estimated_minutes))):0};
 }):[];
 const milestones=Array.isArray(source.milestones)?source.milestones.map((item)=>{const milestone=item&&typeof item==='object'?item as Record<string,unknown>:{};return {title:textFrom(milestone.title,''),description:textFrom(milestone.description,'')}}):[];
 const adaptation_rules=Array.isArray(source.adaptation_rules)?source.adaptation_rules.filter((item):item is string=>typeof item==='string'&&Boolean(item.trim())):[];
 const sourceDeadline=typeof source.deadline==='string'&&source.deadline.trim()&&source.deadline.trim().toLowerCase()!=='none'?source.deadline.trim():null;
 return {mode,domain:text('domain',''),completion_definition:text('completion_definition',''),overview:text('overview',''),success_metric:text('success_metric',''),horizon:duration?text('horizon',duration):'As needed',cadence:duration?text('cadence','As needed'):'As needed',deadline:duration?(sourceDeadline||duration):null,steps,milestones,adaptation_rules,next_action:text('next_action',steps[0]?.title||''),workflow:source.workflow&&typeof source.workflow==='object'?source.workflow as Record<string,unknown>:undefined,knowledge_count:typeof source.knowledge_count==='number'?source.knowledge_count:undefined};
}
function textFrom(value: unknown, fallback: string) { return typeof value==='string'&&Boolean(value.trim())?value.trim():fallback; }

export function GoalPlanner({userId,onCreated,onCancel,draftGoal}:{userId:string;onCreated:()=>void;onCancel?:()=>void|Promise<void>;draftGoal?:DraftGoal|null}){
 const [goal,setGoal]=useState(draftGoal?.title||draftGoal?.outcome||''); const [why,setWhy]=useState(draftGoal?.why_it_matters||''); const [duration,setDuration]=useState<string|null>(draftGoal?.duration||null); const [armadillo,setArmadillo]=useState<ArmadilloResult|null>(null); const [specialist,setSpecialist]=useState<ReturnType<typeof specialistFor>|null>(null);
 const [mode,setMode]=useState<HamsterMode|null>(null); const [questions,setQuestions]=useState<ClarificationQuestion[]>([]); const [answers,setAnswers]=useState<string[]>([]); const [plan,setPlan]=useState<HamsterPlan|null>(null); const [draftId,setDraftId]=useState<string|null>(draftGoal?.id||null); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
 const [readyToBuild,setReadyToBuild]=useState(false);
 const workflow=useMemo(()=>mode?HAMSTER_WORKFLOWS[mode]:null,[mode]);
 useEffect(()=>{if(!draftGoal?.id)return;setGoal(draftGoal.title||draftGoal.outcome||'');setWhy(draftGoal.why_it_matters||'');setDuration(draftGoal.duration||null);setDraftId(draftGoal.id);},[draftGoal?.id,draftGoal?.title,draftGoal?.outcome,draftGoal?.why_it_matters,draftGoal?.duration]);
 useEffect(()=>{if(!draftGoal?.id)return;let cancelled=false;(async()=>{const {data}=await supabase.from('goal_clarification_answers').select('key,question,answer,question_order').eq('goal_id',draftGoal.id).eq('user_id',userId).order('question_order',{ascending:true});if(cancelled||!data?.length)return;const rows=data as ClarificationRow[];const restoredQuestions:ClarificationQuestion[]=[];for(const row of rows.slice(0,4)){if(typeof row.key==='string'&&row.key.trim()&&typeof row.question==='string'&&row.question.trim())restoredQuestions.push({key:row.key.trim(),question:row.question.trim()});}if(!restoredQuestions.length)return;const restoredAnswers:string[]=[];for(const row of rows.slice(0,restoredQuestions.length)){restoredAnswers.push(typeof row.answer==='string'?row.answer:'');}setQuestions(restoredQuestions);setAnswers(restoredAnswers);})();return()=>{cancelled=true;};},[draftGoal?.id,userId]);
 async function safe(text:string){if(!text.trim())return;const r=await checkContentSafety(text);if(r.status!=='safe')throw new Error(r.message||USER_MESSAGES.unsafe);}
 async function draft(){if(draftId){const {error}=await supabase.from('goals').update({duration}).eq('id',draftId).eq('user_id',userId);if(error)throw error;return draftId;}const {data,error:e}=await supabase.from('goals').insert({user_id:userId,title:goal,outcome:goal,why_it_matters:why.trim()||null,status:'draft',weekly_commitment_target:0,duration}).select('id').single();if(e||!data)throw e||new Error('Could not start this goal.');setDraftId(data.id);return data.id;}
 async function start(){
  const originalGoal=goal; const trimmedGoal=originalGoal.trim(); if(!trimmedGoal||busy)return;
  setBusy(true);setError('');setPlan(null);setReadyToBuild(false);
  try{
   await safe(originalGoal); await safe(why);
   const a=analyseGoalForEvidence({title:originalGoal,outcome:originalGoal,why_it_matters:why});
   const s=specialistFor({title:originalGoal,category:a.category,goal_type:a.goal_type});
   setArmadillo(a);setSpecialist(s);
   const inferred=inferHamsterMode({title:originalGoal,outcome:originalGoal,why_it_matters:why,category:a.category,goal_type:a.goal_type,target:a.target,time_target:a.time_target});
   setMode(inferred);
   const context=buildHamsterContext({title:originalGoal,outcome:originalGoal,why_it_matters:why,category:s.domain||a.category,goal_type:s.goal_types[0]||a.goal_type,time_target:duration,planning_mode:inferred});
   const id=await draft();
   const {data,error:e}=await supabase.functions.invoke('vow-hamster',{body:{action:'clarify',goal:{id,title:originalGoal,outcome:originalGoal,why_it_matters:why.trim()||null,duration},armadillo:{...a,category:s.domain||a.category,goal_type:s.goal_types[0]||a.goal_type},hamster_context:{...context,mode:inferred,domain:s,duration},answers:[],required_inputs:s.required_inputs||[]}});
   if(e||!data?.structured) throw new Error(USER_MESSAGES.clarification_unavailable);
   const qs:ClarificationQuestion[]=Array.isArray(data.structured.questions)?data.structured.questions.map((value:unknown)=>{if(!value||typeof value!=='object')return null;const item=value as Record<string,unknown>;return {key:typeof item.key==='string'?item.key.trim():'',question:typeof item.question==='string'?item.question.trim():''};}).filter((value: ClarificationQuestion | null): value is ClarificationQuestion=>Boolean(value?.key&&value.question)).slice(0,3):[];
   if(s.required_inputs.length){
    const requiredKeys=new Set(s.required_inputs.map(input=>input.key)); const returnedKeys=new Set(qs.map(question=>question.key)); const missing=s.required_inputs.map(input=>input.key).filter(key=>!returnedKeys.has(key));
    if(missing.length)throw new Error(USER_MESSAGES.clarification_unavailable); if(qs.some(question=>!requiredKeys.has(question.key)))throw new Error(USER_MESSAGES.clarification_unavailable);
   }
   setQuestions(qs);setAnswers(qs.map(()=>''));setReadyToBuild(qs.length===0);
   const {error:deleteError}=await supabase.from('goal_clarification_answers').delete().eq('goal_id',id).eq('user_id',userId);if(deleteError)throw deleteError;
   if(qs.length){const {error:saveError}=await supabase.from('goal_clarification_answers').insert(qs.map((question,index)=>({goal_id:id,user_id:userId,key:question.key,question:question.question,answer:null,question_order:index})));if(saveError)throw saveError;}
  }catch(e){setError(e instanceof Error&&e.message===USER_MESSAGES.unsafe?e.message:safeHamsterMessage(e,USER_MESSAGES.clarification_unavailable));}finally{setBusy(false);}
 }
 async function build(){
  if(!draftId||busy)return; setBusy(true);setError('');
  try{
   const clean=answers.map(a=>a.trim()); if(clean.length!==questions.length||clean.some(answer=>!answer))throw new Error(USER_MESSAGES.invalid_request); await safe(clean.join('\n'));
   const {error:deleteError}=await supabase.from('goal_clarification_answers').delete().eq('goal_id',draftId).eq('user_id',userId);if(deleteError)throw deleteError;
   if(questions.length){const {error:answerError}=await supabase.from('goal_clarification_answers').insert(questions.map((question,index)=>({goal_id:draftId,user_id:userId,key:question.key,question:question.question,answer:clean[index],question_order:index})));if(answerError)throw answerError;}
   const a=armadillo||analyseGoalForEvidence({title:goal,outcome:goal,why_it_matters:why}); const s=specialist||specialistFor({title:goal,category:a.category,goal_type:a.goal_type});
   const resolvedMode=mode||inferHamsterMode({title:goal,outcome:goal,why_it_matters:why,category:a.category,goal_type:a.goal_type,target:a.target,time_target:a.time_target});
   if(!mode)setMode(resolvedMode); if(!armadillo)setArmadillo(a); if(!specialist)setSpecialist(s);
   const ctx=buildHamsterContext({title:goal,outcome:goal,why_it_matters:why,category:s.domain||a.category,goal_type:s.goal_types[0]||a.goal_type,time_target:duration,planning_mode:resolvedMode});
   const request=supabase.functions.invoke('vow-hamster',{body:{action:'plan',goal:{id:draftId,title:goal,outcome:goal,why_it_matters:why.trim()||null,duration},armadillo:{...a,category:s.domain||a.category,goal_type:s.goal_types[0]||a.goal_type},hamster_context:{...ctx,mode:resolvedMode,domain:s,duration},answers:questions.map((question,index)=>({key:question.key,question:question.question,answer:clean[index]})),required_inputs:s.required_inputs||[]}});
   const result=await Promise.race([request,new Promise<never>((_,reject)=>window.setTimeout(()=>reject(new Error(USER_MESSAGES.plan_unavailable)),30000))]); const {data,error:e}=result; if(e||!data?.structured)throw new Error(USER_MESSAGES.plan_unavailable);
   if(data?.code==='PLAN_QUALITY_REJECTED'||!planIntegrity(data.structured,goal))throw new Error(USER_MESSAGES.plan_unavailable);
   const next=normalisePlan(data.structured,resolvedMode,duration); setPlan(next);setReadyToBuild(false);
  }catch(e){console.error('[VOW] Plan build failed:',e);setPlan(null);setError(e instanceof Error&&e.message===USER_MESSAGES.invalid_request?e.message:USER_MESSAGES.plan_unavailable);}finally{setBusy(false);}
 }
 async function lock(){
  if(!plan||!draftId||busy)return; setBusy(true);setError('');
  try{
   if(!planIntegrity(plan,goal))throw new Error(USER_MESSAGES.plan_unavailable);
   const context={planning:{mode:plan.mode,workflow:HAMSTER_WORKFLOWS[plan.mode],specialist,plan},analysis:armadillo||{},personalisation:{questions,answers,completed:answers.length>0&&answers.every(Boolean),duration},original_goal:goal.trim(),planner_completion_definition:plan.completion_definition};
   const {error:e}=await supabase.from('goals').update({title:goal,outcome:goal.trim(),why_it_matters:why.trim()||null,status:'active',plan_json:plan,goal_context_json:context,plan_version:2,plan_generated_at:new Date().toISOString(),planning_horizon_weeks:null,planning_timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,deadline:null,duration}).eq('id',draftId).eq('user_id',userId);
   if(e)throw e;
   const {error:milestoneDeleteError}=await supabase.from('milestones').delete().eq('goal_id',draftId).eq('user_id',userId);if(milestoneDeleteError)throw milestoneDeleteError;
   if(plan.milestones?.length){const {error:milestoneInsertError}=await supabase.from('milestones').insert(plan.milestones.filter(m=>m.title.trim()).map((m,i)=>({goal_id:draftId,user_id:userId,title:m.title,description:m.description,sort_order:i,status:i===0?'in_progress':'pending',deadline:null})));if(milestoneInsertError)throw milestoneInsertError;}
   onCreated();
  }catch(e){setError(e instanceof Error?e.message:'Could not lock this VOW.');}finally{setBusy(false);}
 }
 if(plan){const planWorkflow=HAMSTER_WORKFLOWS[plan.mode]||HAMSTER_WORKFLOWS.adaptive;return <div><PageHeader title="Your VOW" subtitle={`Personalised planning · ${plan.domain}`} /><div className="max-w-3xl space-y-5"><section className="border border-vow-border p-5"><p className="vow-label mb-2">How this goal works</p><p className="text-lg font-medium text-vow-ink">{plan.overview}</p><p className="text-sm text-vow-muted mt-3">{plan.completion_definition}</p></section><section className="border border-vow-border p-5"><p className="vow-label mb-3">Execution</p><div className="space-y-4">{plan.steps.map((s)=><div key={`${s.order}-${s.title}`} className="border-l-2 border-vow-accent pl-4"><p className="text-sm font-medium text-vow-ink">{s.order}. {s.title}</p><p className="text-xs text-vow-muted mt-1">{s.purpose}</p><p className="text-xs text-vow-muted mt-1">Target: {s.target} · Evidence: {s.evidence}{s.estimated_minutes?` · ~${s.estimated_minutes} min`:''}</p></div>)}</div></section><section className="border border-vow-border p-5"><p className="vow-label mb-3">Planning</p><p className="text-sm text-vow-ink">{planWorkflow.name}: {planWorkflow.purpose}</p><p className="text-sm text-vow-muted mt-2">Horizon: {plan.horizon} · Cadence: {plan.cadence} · Deadline: {plan.deadline}</p><p className="text-sm text-vow-muted mt-2">{plan.next_action}</p></section>{plan.adaptation_rules?.length>0&&<section className="border border-vow-border p-5"><p className="vow-label mb-3">What changes the plan</p>{plan.adaptation_rules.map(rule=><p key={rule} className="text-sm text-vow-muted py-1">{rule}</p>)}</section>}{error&&<p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">{error}</p>}<div className="flex gap-3"><button className="vow-btn-ghost" onClick={()=>setPlan(null)}>Adjust</button><button className="vow-btn-primary flex-1" onClick={lock} disabled={busy}>{busy?'Saving...':'Lock in VOW'}</button></div></div></div>}
 if(questions.length)return <div><PageHeader title="VOW needs your context" subtitle={`${workflow?.name||'Personalised'} planning · ${specialist?.domain||'your domain'}`} /><div className="max-w-xl space-y-5"><p className="text-sm text-vow-muted">VOW only asks for context that materially changes the plan. Timing is optional and handled separately.</p>{questions.map((q,i)=><div key={`${q.key}-${i}`}><label className="vow-label block mb-2" htmlFor={`vow-q-${i}`}>{q.question} <span aria-hidden="true">*</span></label><textarea id={`vow-q-${i}`} rows={4} value={answers[i]||''} onChange={e=>setAnswers(x=>x.map((a,j)=>j===i?e.target.value:a))} className="vow-input resize-none" placeholder="Your answer..." required aria-required="true" /></div>)}{error&&<p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">{error}</p>}<div className="flex gap-3"><button className="vow-btn-ghost" onClick={()=>setQuestions([])}>Back</button><button className="vow-btn-primary flex-1" onClick={build} disabled={busy||answers.length!==questions.length||answers.some(a=>!a.trim())}>{busy?'Building your plan...':'Build my VOW'}</button></div></div></div>;
 if(readyToBuild)return <div><PageHeader title="Your goal is ready" subtitle={`${workflow?.name||'Personalised'} planning · ${specialist?.domain||'your domain'}`} /><div className="max-w-xl space-y-5"><p className="text-sm text-vow-muted">VOW has enough information to build this goal without additional questions.</p>{error&&<p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">{error}</p>}<div className="flex gap-3"><button className="vow-btn-ghost" onClick={()=>{setReadyToBuild(false);setError('');}}>Back</button><button className="vow-btn-primary flex-1" onClick={build} disabled={busy}>{busy?'Building your plan...':'Build my VOW'}</button></div></div></div>;
 return <div><PageHeader title="Make your VOW" subtitle="Tell VOW what you want to accomplish. VOW will keep clarification focused and let you choose a timeframe only if you want one." /><div className="max-w-xl space-y-5"><textarea autoFocus rows={4} value={goal} onChange={e=>setGoal(e.target.value)} className="vow-input resize-none" placeholder="e.g. Become good at hockey" /><textarea rows={3} value={why} onChange={e=>setWhy(e.target.value)} className="vow-input resize-none" placeholder="Why does this matter?" /><div><label className="vow-label block mb-2" htmlFor="goal-timeframe">When would you like to achieve this? <span className="text-vow-muted normal-case tracking-normal">(optional)</span></label><input id="goal-timeframe" value={duration||''} onChange={e=>setDuration(e.target.value||null)} className="vow-input" placeholder="e.g. in 2 weeks, by December, before my birthday" /></div>{error&&<p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3">{error}</p>}<div className="flex gap-3"><button className="vow-btn-ghost" onClick={()=>void onCancel?.()}>Cancel</button><button className="vow-btn-primary flex-1" disabled={!goal.trim()||busy} onClick={start}>{busy?'VOW is understanding your goal...':'Continue'}</button></div></div></div>;
}
