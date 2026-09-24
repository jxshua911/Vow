import { pageHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";
import { privacyIntro, privacySections } from "@/content/privacy";
import { termsIntro, termsSections } from "@/content/terms";
import { copyrightIntro, copyrightSections } from "@/content/copyright";
import { site } from "@/content/site";

export const Route=createFileRoute("/legal")({
 head:()=>pageHead({path:'/legal',title:'Privacy Policy, Terms & Account Deletion | VOW app',description:'Privacy Policy, Terms of Use / EULA, copyright and account deletion information for the VOW goal-planning and accountability app.'}),
 component:Legal
});
const prefix=(p:string,sections:typeof privacySections)=>sections.map(s=>({...s,id:`${p}-${s.id}`,heading:`${p==="privacy"?"Privacy":p==="terms"?"Terms":"Copyright"} — ${s.heading}`}));
const sections=[...prefix("privacy",privacySections),...prefix("terms",termsSections),...prefix("copyright",copyrightSections)];
function Legal(){return <LegalPage eyebrow="VOW / Legal" title="Privacy, terms & rights." intro={`${privacyIntro} ${termsIntro}`} dates={[{label:"Effective date",value:site.policy.effectiveDate},{label:"Last updated",value:site.policy.lastUpdated}]} sections={sections}/>;}