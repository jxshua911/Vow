import { detectDomainFlow } from './domainFlows.ts';

export type FaithReadingRecommendation = { theme:string; books:string[]; verses:string[]; rationale:string };
export type ArmadilloResult = { category:string; goal_type:string; metric:string; evidence:string[]; integration:string|null; fallback:string; confidence:number; needs_clarification:boolean; clarification_reasons:string[]; flow_id:string; flow_progression:string; research_focus:string[] };

export function isFaithGoal(input:{title?:string|null;outcome?:string|null;why_it_matters?:string|null}) {
  const { flow } = detectDomainFlow(input);
  return flow.id === 'faith';
}

export function faithClarificationQuestions() {
  return detectDomainFlow({title:'Bible reading'}).flow.discovery_questions;
}

export function resolveFaithReadingRecommendation(answers:Array<{question?:string;answer?:string|null}>):FaithReadingRecommendation {
  const text=answers.map((item)=>item.answer||'').join(' ').toLowerCase();
  const themes:Array<[string,string[],string[]]>=[
    ['Knowing Jesus',['John','Luke'],['John 3:16','John 15:1-11','Luke 15:11-32']],
    ['Building faith',['Mark','Hebrews'],['Mark 4:35-41','Hebrews 11:1-6','Hebrews 12:1-3']],
    ['Growing in prayer',['Luke','Philippians'],['Luke 11:1-13','Philippians 4:4-9']],
    ['Wisdom and daily character',['Proverbs','James'],['Proverbs 1:1-7','James 1:2-8','James 3:13-18']],
    ['Understanding grace and new life',['Romans','Ephesians'],['Romans 5:1-11','Ephesians 2:1-10']],
  ];
  const selected=themes.find(([theme])=>{const key=theme.toLowerCase();if(key.includes('jesus'))return /jesus|gospel|know god|knowing god/.test(text);if(key.includes('faith'))return /faith|trust|believe|doubt/.test(text);if(key.includes('prayer'))return /pray|prayer|praying/.test(text);if(key.includes('wisdom'))return /wisdom|character|discipline|proverb|decision/.test(text);return /grace|saved|salvation|new life|christian life/.test(text);})||themes[0];
  const time=/45|60|hour/.test(text)?'a slower reading pace with reflection':/10|15|20|30/.test(text)?'a short repeatable reading pace':'a moderate repeatable reading pace';
  return {theme:selected[0],books:selected[1],verses:selected[2],rationale:`Start with ${selected[1].join(' and ')} and ${selected[2][0]} as an anchor passage, using ${time}. The plan should adapt after the first week of reflection.`};
}

export function analyseGoalForEvidence(input:{title?:string|null;outcome?:string|null;why_it_matters?:string|null}):ArmadilloResult {
  const {flow,confidence}=detectDomainFlow(input);
  const recognised=flow.id!=='domain-discovery';
  return {
    category:flow.category,
    goal_type:flow.goal_types[0],
    metric:flow.metrics.join(', '),
    evidence:flow.evidence,
    integration:flow.integrations[0]||null,
    fallback:recognised?'Manual tracking remains fully usable if a suggested integration is not connected.':'VOW must identify the goal domain and evidence model before a plan is generated; generic planning is not allowed.',
    confidence,
    needs_clarification:true,
    clarification_reasons:recognised?flow.discovery_questions:['The goal domain is not yet mapped to a specialist flow.','VOW needs domain-specific success criteria and baseline information.','VOW must identify the right evidence and progression model before planning.'],
    flow_id:flow.id,
    flow_progression:flow.progression,
    research_focus:flow.research_focus,
  };
}
