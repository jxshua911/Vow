import { pageHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { site } from "@/content/site";
import { useLocale } from "@/lib/i18n";

export const Route=createFileRoute("/assistant")({
  head:()=>pageHead({path:'/assistant',title:'Ask VOW — Assistant for the VOW goal-planning app',description:'Ask the VOW assistant about the goal-planning app, support, privacy and how VOW works, or hand the conversation to a person.'}),
  component:Assistant,
});

type Message={role:"user"|"assistant";text:string};
function answer(question:string,sw:boolean){
  const q=question.toLowerCase();
  if(sw){
    if(q.includes("vow ni nini")||q.includes("vow ni")||q.includes("app")) return "VOW ni mfumo wa kupanga malengo na uwajibikaji unaounganisha lengo, mpango, vipindi vya kazi, ukumbusho na mapitio katika mzunguko mmoja.";
    if(q.includes("ai")||q.includes("akili bandia")) return "AI ya VOW husaidia kugeuza lengo kuwa mpango wa kuanzia na mapendekezo ya vitendo. Mtumiaji ndiye anayebaki na udhibiti wa lengo na maamuzi.";
    if(q.includes("privacy")||q.includes("faragha")) return "VOW ina sera ya faragha inayoeleza data inayokusanywa, jinsi inavyotumiwa, huduma zilizounganishwa na haki za mtumiaji. Unaweza kuomba msaada kupitia ukurasa wa Mawasiliano.";
    if(q.includes("support")||q.includes("msaada")||q.includes("human")) return "Ukitaka jibu kutoka kwa mtu, chagua Mwombe Joshua ajibu. Swali na maelezo ya mazungumzo yataandaliwa kwa barua pepe ya VOW.";
    return "Nimeelewa swali lako. Ninaweza kusaidia kuhusu VOW, jinsi mfumo unavyofanya kazi, AI, Premium, faragha, integrations na msaada. Kwa jambo lisilo kwenye maarifa yangu, unaweza kumwomba Joshua ajibu moja kwa moja.";
  }
  if(q.includes("what is vow")||q.includes("what is the vow")||q.includes("app")) return "VOW is a goal-planning and accountability system that connects the goal, the plan, scheduled work, reminders and honest review into one continuous loop.";
  if(q.includes("ai")||q.includes("artificial intelligence")) return "VOWs AI assists with turning a goal into a useful starting structure and practical suggestions. You keep control of the goal, the plan and the decisions; AI assists rather than replaces that judgement.";
  if(q.includes("premium")||q.includes("price")||q.includes("subscription")) return "VOW Premium is planned at $9.99 per month, with a 40% discount on the yearly plan. Availability and final billing are handled through the applicable platform.";
  if(q.includes("privacy")||q.includes("data")) return "VOWs Privacy Policy explains the information VOW collects, how it is used, connected services, retention and your available choices. You can also contact VOW directly for privacy requests.";
  if(q.includes("calendar")||q.includes("strava")||q.includes("integration")) return "VOW can connect with services such as Google Calendar and Strava where those integrations are enabled. Connections are user-authorised and can be disconnected through the relevant controls.";
  if(q.includes("delete")||q.includes("account")) return "Account deletion can be requested through the VOW app where the feature is available, or through VOW support. The legal page explains the deletion process and limited retention exceptions.";
  if(q.includes("human")||q.includes("joshua")||q.includes("person")||q.includes("live")) return "You can ask for a human response at any time. Choose Ask Joshua to respond below and the conversation will be prepared for VOWs support inbox.";
  return "I can help with VOW, how the system works, AI-assisted planning, Premium, privacy, integrations and support. If your question needs a human answer, ask Joshua to respond and VOW can take the conversation out of automated mode.";
}

function Assistant(){
 const sw=useLocale();
 const [messages,setMessages]=useState<Message[]>([{role:"assistant",text:sw?"Habari. Mimi ni msaidizi wa VOW. Niulize kuhusu VOW, jinsi inavyofanya kazi, AI, Premium, faragha au msaada.":"Hi. I am the VOW virtual assistant. Ask me about VOW, how it works, AI, Premium, privacy or support."}]);
 const [input,setInput]=useState("");
 const [human,setHuman]=useState(false);
 const [name,setName]=useState("");
 const [email,setEmail]=useState("");
 const [sent,setSent]=useState(false);
 const greeting=sw?"Uliza swali kuhusu VOW.":"Ask a question about VOW.";
 const submit=(e:FormEvent)=>{e.preventDefault();const q=input.trim();if(!q)return;setMessages(m=>[...m,{role:"user",text:q},{role:"assistant",text:answer(q,Boolean(sw))}]);setInput("");};
 const transcript=useMemo(()=>messages.map(m=>(m.role==="user"?"User":"VOW Assistant")+": "+m.text).join("\n\n"),[messages]);
 const sendHuman=(e:FormEvent)=>{e.preventDefault();const body=["Name: "+name,"Email: "+email,"",transcript].join("\n");window.location.href="mailto:"+site.supportEmail+"?subject=VOW%20Assistant%20%E2%80%94%20Human%20response&body="+encodeURIComponent(body)+"&cc="+encodeURIComponent(site.contactCc);setSent(true);};
 return <>
  <section className="border-b border-vow-border"><div className="container-site py-20 sm:py-28"><p className="vow-label">{sw?"VOW / Msaidizi":"VOW / Assistant"}</p><div className="mt-5 grid gap-10 lg:grid-cols-12 lg:items-end"><div className="lg:col-span-8"><h1 className="max-w-5xl text-[clamp(3.8rem,9vw,8rem)] leading-[.82] tracking-[-.035em]">{sw?"Uliza VOW.":"Ask VOW."}</h1></div><p className="max-w-[36ch] text-lg leading-[1.75] text-vow-muted lg:col-span-4">{sw?"Msaidizi wa kiotomatiki anaweza kujibu maswali ya kawaida. Unapohitaji mtu, unaweza kumwomba Joshua achukue mazungumzo.":"The automated assistant handles common questions. When you need a person, you can ask Joshua to take over the conversation."}</p></div></div></section>
  <main className="container-site py-12 sm:py-20"><div className="mx-auto max-w-4xl overflow-hidden border border-vow-border bg-vow-bg">
   <div className="flex items-center justify-between gap-5 border-b border-vow-border px-5 py-4 sm:px-7"><div><p className="vow-label">{sw?"Msaidizi wa VOW":"VOW Assistant"}</p><p className="mt-1 text-xs text-vow-muted">{sw?"AI iko tayari":"AI is active"}</p></div><button type="button" onClick={()=>setHuman(v=>!v)} className="vow-btn-ghost text-xs">{human?(sw?"Rudi kwa AI":"Back to AI"):(sw?"Mwombe Joshua":"Ask Joshua to respond")}</button></div>
   {!human ? <><div className="min-h-[25rem] space-y-5 p-5 sm:p-7">{messages.map((m,i)=><div key={i} className={m.role==="user"?"ml-auto max-w-[82%]":"max-w-[88%]"}><p className="vow-label">{m.role==="user"?(sw?"Wewe":"You"):"VOW Assistant"}</p><div className={m.role==="user"?"mt-2 border border-vow-ink bg-vow-ink px-4 py-3 text-sm leading-7 text-vow-bg":"mt-2 border border-vow-border bg-vow-surface/40 px-4 py-3 text-sm leading-7"}>{m.text}</div></div>)}</div>
    <form onSubmit={submit} className="border-t border-vow-border p-4 sm:p-5"><div className="flex gap-3"><input value={input} onChange={e=>setInput(e.target.value)} className="vow-field mt-0" placeholder={greeting} aria-label={greeting}/><button className="vow-btn-primary shrink-0" type="submit">{sw?"Tuma":"Send"}</button></div></form></> :
    <div className="p-5 sm:p-7"><p className="max-w-2xl text-base leading-7 text-vow-muted">{sw?"Joshua anaweza kuchukua mazungumzo haya wakati unahitaji jibu la kibinadamu. Tuma mazungumzo haya kwenye inbox ya VOW; jibu lako litaandaliwa pamoja na historia ya mazungumzo.":"Joshua can take over when a human answer is useful. Send the conversation to VOWs support inbox with the transcript included."}</p>{sent&&<div className="mt-5 border-l-2 border-vow-ink bg-vow-surface px-4 py-3 text-sm">Your human-response email draft is ready.</div>}<form onSubmit={sendHuman} className="mt-8 grid gap-6 sm:grid-cols-2"><label><span className="vow-label">Name</span><input required value={name} onChange={e=>setName(e.target.value)} className="vow-field" placeholder="Your name"/></label><label><span className="vow-label">Email</span><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="vow-field" placeholder="you@example.com"/></label><div className="sm:col-span-2"><button type="submit" className="vow-btn-primary">{sw?"Tuma kwa VOW":"Send to VOW"} →</button></div></form></div>}
   </div></main>
  <section className="border-t border-vow-border bg-vow-surface/35"><div className="container-site py-14"><p className="vow-label">{sw?"Uwazi":"Clear handoff"}</p><p className="mt-3 max-w-3xl leading-7 text-vow-muted">{sw?"Majibu ya kiotomatiki yanatolewa kwa maarifa ya bidhaa ya VOW. Maswali yanayohitaji muktadha au uamuzi wa mtu yanaweza kupelekwa kwa Joshua.":"Automated replies are based on VOWs product knowledge. Questions that need context, judgement or a personal response can be handed to Joshua."}</p></div></section>
 </>;
}