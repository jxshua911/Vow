import { Link, createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { site } from "@/content/site";

export const Route=createFileRoute("/support")({
  head:()=>({meta:[{title:"Get in Touch — VOW"},{name:"description",content:"Contact VOW support and send a message directly from the website."}],links:[{rel:"canonical",href:"/support"}]}),
  component:SupportPage
});

const faqs=[
  ["How do I delete my VOW account?","Use the in-app deletion option where available, or use the account deletion page to send a request."],
  ["How do I manage a subscription?","Subscriptions are managed through the platform where you purchased them, such as Google Play."],
  ["How do I disconnect an integration?","Disconnect Google Calendar, Strava or another connected service from the relevant controls in VOW or that service's account settings."],
  ["How do I turn off reminders?","Change notification preferences in VOW or in your device settings."]
] as const;

function SupportPage(){
  const [sent,setSent]=useState(false);
  function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const data=new FormData(e.currentTarget);
    const subject=String(data.get("subject")||"VOW website enquiry");
    const body=[`Name: ${data.get("name")||""}`,`Email: ${data.get("email")||""}`,`Reason: ${subject}`,"",String(data.get("message")||"")].join("\n");
    window.location.href=`mailto:${site.supportEmail}?subject=${encodeURIComponent("VOW — "+subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }
  return <><header className="border-b border-vow-border"><div className="container-site py-20 sm:py-24"><p className="vow-label">Get in touch</p><h1 className="mt-4 max-w-4xl text-5xl leading-none sm:text-7xl">Tell us what you need.</h1><p className="mt-7 max-w-2xl text-lg leading-7 text-vow-muted">Use the form below for support, feedback, partnership enquiries or privacy questions. No home address is published here.</p></div></header>
  <section className="container-site grid gap-14 py-16 lg:grid-cols-[1fr_1.2fr] lg:py-20">
    <div><p className="vow-label">Contact</p><h2 className="mt-3 text-4xl">A direct line to VOW.</h2><p className="mt-5 max-w-md leading-7 text-vow-muted">Your message is prepared as an email to our support inbox. For privacy or deletion requests, you can also contact {site.privacyEmail} directly.</p><div className="mt-8 space-y-3 text-sm"><a className="block underline underline-offset-4" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a><a className="block underline underline-offset-4" href={`mailto:${site.privacyEmail}`}>{site.privacyEmail}</a></div></div>
    <div className="border border-vow-border bg-vow-surface/35 p-6 sm:p-8">
      {sent&&<div className="mb-6 border border-vow-border bg-vow-bg p-4 text-sm leading-6">Your email draft has been opened. If it did not open automatically, send your message to <a className="underline underline-offset-4" href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.</div>}
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2"><label className="block"><span className="vow-label">Name</span><input required name="name" className="mt-2 w-full border border-vow-border bg-vow-bg px-3.5 py-3 text-sm outline-none focus:border-vow-ink" placeholder="Your name"/></label><label className="block"><span className="vow-label">Email</span><input required type="email" name="email" className="mt-2 w-full border border-vow-border bg-vow-bg px-3.5 py-3 text-sm outline-none focus:border-vow-ink" placeholder="you@example.com"/></label></div>
        <label className="block"><span className="vow-label">Reason</span><select name="subject" className="mt-2 w-full border border-vow-border bg-vow-bg px-3.5 py-3 text-sm outline-none focus:border-vow-ink"><option>General support</option><option>Bug or technical issue</option><option>Feedback</option><option>Partnership / business enquiry</option><option>Privacy request</option><option>Account deletion</option></select></label>
        <label className="block"><span className="vow-label">Message</span><textarea required name="message" rows={7} className="mt-2 w-full resize-y border border-vow-border bg-vow-bg px-3.5 py-3 text-sm leading-6 outline-none focus:border-vow-ink" placeholder="Tell us what is going on..."/></label>
        <div className="flex flex-wrap items-center gap-4"><button type="submit" className="vow-btn-primary">Open email draft →</button><Link to="/privacy-policy" className="text-sm text-vow-muted underline underline-offset-4">Privacy Policy</Link></div>
      </form>
    </div>
  </section>
  <section className="border-t border-vow-border bg-vow-surface"><div className="container-site py-16"><div className="max-w-2xl"><p className="vow-label">Common questions</p><h2 className="mt-3 text-4xl">Quick answers.</h2></div><div className="mt-10 grid gap-px border border-vow-border bg-vow-border md:grid-cols-2">{faqs.map(([q,a])=><details key={q} className="bg-vow-surface p-6"><summary className="cursor-pointer list-none font-semibold">{q}</summary><p className="mt-3 text-sm leading-6 text-vow-muted">{a}</p></details>)}</div></div></section></>;
}