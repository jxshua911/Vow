import { pageHead } from "@/lib/seo";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useLocale } from "@/lib/i18n";

export const Route = createFileRoute("/founders")({
  head:()=>pageHead({path:'/founders',title:'Founder — Joshua Nathan Kasanga | VOW',description:'Meet Joshua Nathan Kasanga, founder of VOW, the goal-planning and accountability app, and the thinking behind the product.'}),
  component: Founders,
});

function Founders() {
  const sw=useLocale();
  return (
    <>
      <section className="border-b border-vow-border bg-vow-bg">
        <div className="container-site py-20 sm:py-28">
          <p className="vow-label">{sw?"Mwanzilishi":"The founder"}</p>
          <div className="mt-6 grid gap-12 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8">
              <h1 className="max-w-5xl text-[clamp(4rem,9vw,8rem)] leading-[.82] tracking-[-.045em]">{sw?<>Imejengwa na<br />Joshua.</>:<>Built by<br />Joshua.</>}</h1>
            </div>
            <div className="lg:col-span-4">
              <p className="max-w-[34ch] text-lg leading-[1.75] text-vow-muted">{sw?"VOW ni bidhaa iliyojengwa kutokana na imani rahisi: kuwa na lengo ni rahisi. Sehemu ngumu ni kutimiza ahadi uliyojiwekea.":"VOW is a product built from a simple belief: having a goal is easy. Keeping your word to yourself is the harder part."}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-site py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-6">
            <div className="relative aspect-[4/5] overflow-hidden bg-vow-surface border border-vow-border">
              <div className="absolute inset-0 flex items-end justify-between p-7 sm:p-9">
                <span className="text-[clamp(5rem,12vw,10rem)] leading-none tracking-[-.07em] text-vow-ink/10">JK</span>
                <span className="vow-label">{sw?"Picha inakuja":"Photo coming soon"}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 lg:col-start-8 lg:pt-2">
            <p className="vow-label">Joshua Nathan Kasanga</p>
            <h2 className="mt-4 text-4xl leading-none sm:text-5xl">{sw?"Mwanzilishi wa VOW.":"Founder of VOW."}</h2>
            <div className="mt-8 space-y-5 text-[1.05rem] leading-[1.85] text-vow-muted">
              <p>{sw?"Mimi ni Joshua — mbunifu wa bidhaa za kidijitali na mtengenezaji wa wavuti ninayeendelea kuelekea uhandisi na teknolojia. Nilianza VOW kwa sababu nilitaka kujenga kitu kinachohusiana na tatizo nililokuwa nikilirudia: mara nyingi watu hawashindwi kwa kukosa malengo; wanashindwa kuyageuza kuwa hatua thabiti.":"I'm Joshua — a digital product designer and web developer with a growing focus on engineering and technology. I started VOW because I wanted to build something around a problem I kept coming back to: people don't usually struggle because they don't have goals; they struggle to turn those goals into consistent action."}</p>
              <p>{sw?"VOW inaunganisha mipango, vipindi vilivyopangwa, uwajibikaji na mapitio katika mfumo mmoja. Inajengwa kwa mtazamo ninaotumia kwenye kazi zangu nyingine: iwe na manufaa, iwe wazi na ijali maelezo ambayo watu hupitia kweli.":"VOW brings planning, scheduled sessions, accountability and review into one system. It's being built with the same mindset I bring to my other work: make it useful, make it clear, and care about the details that people actually experience."}</p>
              <p>{sw?"Pia ninaelekea kuwa mhandisi wa mechatronics, hivyo VOW iko kwenye makutano ninayoyafurahia — ubunifu, programu, mifumo na nidhamu ya kufanya wazo liwe halisi.":"I'm also working towards becoming a mechatronics engineer, so VOW sits at an intersection I genuinely enjoy — design, software, systems and the discipline of making an idea real."}</p>
            </div>
            <div className="mt-10 border-t border-vow-border pt-7">
              <p className="text-2xl leading-tight">Make your VOW.<br />Keep your VOW.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-vow-border bg-vow-surface/35">
        <div className="container-site py-16 sm:py-20">
          <div className="grid gap-8 md:grid-cols-3">
            <div><p className="vow-label">01</p><h3 className="mt-5 text-2xl">{sw?"Ubunifu":"Design"}</h3><p className="mt-3 leading-7 text-vow-muted">{sw?"Bidhaa zinapaswa kuonekana zimefikirika, si ngumu.":"Products should feel considered, not complicated."}</p></div>
            <div><p className="vow-label">02</p><h3 className="mt-5 text-2xl">{sw?"Jenga":"Build"}</h3><p className="mt-3 leading-7 text-vow-muted">{sw?"Mawazo huwa na maana yanapofanya kazi katika ulimwengu halisi.":"Ideas become meaningful when they work in the real world."}</p></div>
            <div><p className="vow-label">03</p><h3 className="mt-5 text-2xl">{sw?"Timiza":"Follow through"}</h3><p className="mt-3 leading-7 text-vow-muted">{sw?"Kazi bora ni ile unayoendelea kuifanyia kazi.":"The best work is the work you keep showing up for."}</p></div>
          </div>
        </div>
      </section>

      <section className="container-site py-20 sm:py-24">
        <div className="flex flex-col gap-8 border-t border-vow-border pt-8 md:flex-row md:items-end md:justify-between">
          <div><p className="vow-label">{sw?"Unataka kuzungumza?":"Want to talk?"}</p><h2 className="mt-4 text-[clamp(2.6rem,5vw,4.5rem)] leading-[.9]">{sw?"Tujenge kitu cha manufaa.":"Let's build something useful."}</h2></div>
          <Link to="/support" className="vow-btn-primary">Get in touch</Link>
        </div>
      </section>
    </>
  );
}