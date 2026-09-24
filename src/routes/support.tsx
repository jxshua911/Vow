import { pageHead } from "@/lib/seo";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { site } from "@/content/site";
import { useLocale } from "@/lib/i18n";

export const Route=createFileRoute("/support")({head:()=>pageHead({path:'/support',title:'Contact & support | VOW goal-planning app',description:'Contact VOW for app support, feedback, partnerships, privacy requests or account deletion.'}),component:SupportPage});

const faqs=[
  ["How do I delete my VOW account?","Use the account deletion option in VOW where available, or contact support and we will help with the request."],
  ["How do I manage a subscription?","Subscriptions are managed through the platform where you purchased them, such as Google Play."],
  ["How do I disconnect an integration?","Disconnect Google Calendar, Strava or another connected service from VOW or the connected service's own account settings."],
  ["How do I turn off reminders?","Change notification preferences in VOW or in your device settings."]
] as const;

function SupportPage(){
  const sw=useLocale();
  const [sent,setSent]=useState(false);
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const data=new FormData(e.currentTarget);
    const reason=String(data.get("reason")||"General enquiry");
    const body=[`Name: ${data.get("name")||""}`,`Email: ${data.get("email")||""}`,`Phone: ${data.get("phone")||"Not provided"}`,`State / Region: ${data.get("state")||""}`,`Enquiry type: ${reason}`,"",String(data.get("message")||"")].join("\n");
    const params=new URLSearchParams({subject:"VOW — "+reason,body,cc:site.contactCc});
    window.location.href=`mailto:${site.supportEmail}?${params.toString()}`;
    setSent(true);
  }
  return <>
    <section className="relative overflow-hidden bg-vow-bg text-vow-ink">
      <div className="absolute inset-0 opacity-20" aria-hidden><div className="vow-contact-grid h-full w-full" /></div>
      <div className="container-site relative py-20 sm:py-28 lg:py-36">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <p className="vow-label !text-vow-muted">{sw?"Wasiliana na VOW":"Contact VOW"}</p>
            <h1 className="mt-6 max-w-5xl text-[clamp(4rem,10vw,9rem)] leading-[.78] tracking-[-.05em]">Let's<br /><span className="text-vow-muted">talk.</span></h1>
          </div>
          <div className="lg:col-span-4 lg:pb-2">
            <p className="max-w-[34ch] text-lg leading-[1.7] text-vow-muted">{sw?"Maswali, maoni, ushirikiano au maombi ya faragha. Tuambie unachohitaji.":"Questions, feedback, partnerships or privacy requests. Tell us what you need."}</p>
          </div>
        </div>
      </div>
    </section>
    <section className="container-site relative -mt-8 pb-20 sm:-mt-12 sm:pb-28">
      <div className="grid border border-vow-border bg-vow-bg shadow-[0_25px_70px_rgba(0,0,0,.08)] lg:grid-cols-12">
        <aside className="border-b border-vow-border p-7 sm:p-10 lg:col-span-4 lg:border-b-0 lg:border-r lg:p-12">
          <p className="vow-label text-vow-blue">{sw?"Wasiliana nasi":"Get in touch"}</p>
          <h2 className="mt-5 text-[clamp(2.4rem,4vw,4rem)] leading-[.9]">A direct line to VOW.</h2>
          <p className="mt-6 leading-[1.8] text-vow-muted">{sw?"Tumia fomu na programu yako ya barua pepe itafunguka ikiwa na ujumbe ulioelekezwa kwa VOW moja kwa moja.":"Use the form and your email app will open with the message addressed to VOW automatically."}</p>
          <div className="mt-10 border-t border-vow-border pt-6">
            <p className="vow-label">Email</p>
            <a className="mt-2 block break-all text-sm font-semibold underline underline-offset-4" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>
            
          </div>
        </aside>
        <div className="p-7 sm:p-10 lg:col-span-8 lg:p-12">
          {sent&&<div className="mb-7 border-l-2 border-vow-blue bg-vow-surface px-5 py-4 text-sm leading-6">Your email draft has been prepared for VOW.</div>}
          <div className="mb-10 flex items-end justify-between gap-6 border-b border-vow-border pb-6">
            <div><p className="vow-label">{sw?"Fomu ya mawasiliano":"Enquiry form"}</p><h2 className="mt-2 text-3xl sm:text-4xl">{sw?"Tunaweza kusaidia na nini?":"What can we help with?"}</h2></div>
            <span className="hidden font-mono text-xs text-vow-muted sm:block">VOW / 01</span>
          </div>
          <form onSubmit={submit} className="space-y-7">
            <div className="grid gap-7 sm:grid-cols-2">
              <label><span className="vow-label">01 · Name</span><input required name="name" className="vow-field" placeholder="Your name"/></label>
              <label><span className="vow-label">02 · Email</span><input required type="email" name="email" className="vow-field" placeholder="you@example.com"/></label>
            </div>
            <label className="block"><span className="vow-label">05 · Enquiry type</span><select required name="reason" className="vow-field"><option>General support</option><option>Bug or technical issue</option><option>Feedback</option><option>Partnership / business enquiry</option><option>Privacy request</option><option>Account deletion</option></select></label>
            <label className="block"><span className="vow-label">06 · Message</span><textarea required minLength={10} name="message" rows={8} className="vow-field resize-y leading-7" placeholder="Tell us what you need..."/></label>
            <div className="flex flex-wrap items-center gap-6 pt-2"><button type="submit" className="vow-btn-blue">{sw?"Andaa ujumbe":"Prepare message"} <span aria-hidden>→</span></button><Link to="/legal" hash="privacy" className="text-sm text-vow-muted underline underline-offset-4">Privacy Policy</Link></div>
          </form>
        </div>
      </div>
    </section>
    <section className="border-t border-vow-border bg-vow-bg text-vow-ink">
      <div className="container-site py-20 sm:py-28">
        <div className="flex flex-col gap-8 border-b border-vow-border pb-10 md:flex-row md:items-end md:justify-between">
          <div><p className="vow-label !text-vow-ink">FAQ</p><h2 className="mt-4 text-[clamp(2.8rem,5vw,5rem)] leading-[.88]">{sw?"Majibu ya haraka.":"Quick answers."}</h2></div>
          <p className="max-w-sm leading-7 text-vow-ink/60">A few things people commonly ask before getting in touch.</p>
        </div>
        <div className="mt-10 divide-y divide-vow-bg/15 border-y border-vow-border">
          {faqs.map(([q,a])=><details key={q} className="group py-6"><summary className="flex cursor-pointer list-none items-center justify-between gap-8 text-xl sm:text-2xl"><span>{q}</span><span className="font-sans text-2xl font-light text-vow-blue transition-transform group-open:rotate-45">+</span></summary><p className="mt-4 max-w-2xl leading-7 text-vow-ink/60">{a}</p></details>)}
        </div>
      </div>
    </section>
  </>;
}