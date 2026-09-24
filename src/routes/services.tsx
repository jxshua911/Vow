import { pageHead } from "@/lib/seo";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useLocale } from "@/lib/i18n";

export const Route=createFileRoute("/services")({head:()=>pageHead({path:'/services',title:'Services — Product design, web development & 3D | VOW',description:'Digital product design, web development and 3D visualisation from the team behind VOW, the goal-planning and accountability app.'}),component:Services});

const services=[
["01","Digital product design","Product thinking, UX structure and polished interfaces for apps and digital products.","Mawazo ya bidhaa, muundo wa UX na miingiliano iliyopangiliwa kwa programu na bidhaa za kidijitali."],
["02","Web development","Responsive websites and web applications built around clear content, strong performance and maintainable code.","Tovuti na programu za wavuti zinazojengwa kwa maudhui yaliyo wazi, utendaji mzuri na msimbo unaoweza kudumishwa."],
["03","3D visualisation","3D scenes, product concepts and visualisations that make an idea easier to understand before it is built.","Mandhari za 3D, dhana za bidhaa na taswira zinazofanya wazo lieleweke kabla ya kujengwa."],
["04","Product systems","Design systems, reusable components and interaction patterns that keep a product coherent as it grows.","Design systems, vipengele vinavyoweza kutumika tena na mifumo ya mwingiliano inayoweka bidhaa katika mpangilio inapokua."]
] as const;

function Services(){const sw=useLocale();return <>
<header className="border-b border-vow-border"><div className="container-site py-20 sm:py-24"><p className="vow-label">{sw?"Huduma":"Services"}</p><h1 className="mt-4 max-w-4xl text-5xl leading-none sm:text-7xl">{sw?"Ubunifu, maendeleo na taswira — bila maneno ya ziada.":"Design, development and visualisation — without the fluff."}</h1><p className="mt-7 max-w-2xl text-lg leading-7 text-vow-muted">{sw?"Kuanzia muundo wa kwanza hadi interface ya mwisho, kazi inalenga kufanya wazo liwe la manufaa na rahisi kueleweka.":"From the first structure to the finished interface, the work stays focused on making the idea useful and understandable."}</p></div></header>
<section className="container-site py-16 sm:py-20"><div className="divide-y divide-vow-border border-y border-vow-border">{services.map(([n,t,b,swb])=><article key={n} className="grid gap-5 py-9 md:grid-cols-[5rem_20rem_1fr]"><span className="font-mono text-xs text-vow-muted">{n}</span><h2 className="text-3xl">{sw?({1:"Ubunifu wa bidhaa za kidijitali",2:"Maendeleo ya wavuti",3:"Taswira ya 3D",4:"Mifumo ya bidhaa"} as Record<string,string>)[n.replace("0","")]||t:t}</h2><p className="max-w-2xl text-sm leading-7 text-vow-muted">{sw?swb:b}</p></article>)}</div></section>
<section className="bg-vow-bg text-vow-ink"><div className="container-site py-16 sm:py-20"><p className="vow-label !text-vow-muted">{sw?"Unahitaji kitu maalum?":"Need something specific?"}</p><h2 className="mt-3 max-w-3xl text-4xl sm:text-5xl">{sw?"Tuambie unachojaribu kujenga.":"Tell us what you're trying to build."}</h2><Link to="/support" className="vow-btn-ghost mt-8">{sw?"Wasiliana nasi":"Get in touch"} →</Link></div></section>
</>;}