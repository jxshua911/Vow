export type ArmadilloResult = { category:string; goal_type:string; metric:string; evidence:string[]; integration:string|null; fallback:string; confidence:number };

const rules=[
  {category:'Sports',goal_type:'Running',metric:'distance, pace, time',evidence:['activity distance','activity pace','activity time'],integration:'Strava',keywords:['run','running','5k','10k','marathon','half marathon','mile','km']},
  {category:'Sports',goal_type:'Cycling',metric:'distance, duration',evidence:['ride distance','ride duration'],integration:'Strava',keywords:['cycle','cycling','bike','biking','ride','kilometre']},
  {category:'Sports',goal_type:'Football',metric:'sessions, minutes, performance',evidence:['training sessions','match activity','manual performance notes'],integration:'Strava',keywords:['football','soccer','match','football training']},
  {category:'Education',goal_type:'Study',metric:'study time, task completion, accuracy',evidence:['study sessions','completed tasks','practice results'],integration:'Google Calendar',keywords:['study','revise','revision','exam','homework','learn','learning','physics','chemistry','biology','maths','mathematics']},
  {category:'Reading',goal_type:'Reading',metric:'pages, books, reading time',evidence:['pages read','books completed','reading sessions'],integration:null,keywords:['read','reading','book','books','pages']},
  {category:'Mindfulness',goal_type:'Meditation',metric:'sessions, duration',evidence:['meditation sessions','meditation duration'],integration:'Medito',keywords:['meditate','meditation','mindfulness']},
  {category:'Technology/Projects',goal_type:'GitHub Contributions',metric:'contributions, pull requests, commits',evidence:['GitHub activity'],integration:'GitHub',keywords:['github','commit','commits','pull request','contribution','coding project']},
  {category:'Career/Projects',goal_type:'Project',metric:'deliverables, milestones, completion',evidence:['project milestones','completed deliverables','project review'],integration:'Google Calendar',keywords:['portfolio','project','career','cv','resume','job','application','internship']},
];

export function analyseGoalForEvidence(input:{title?:string|null;outcome?:string|null;why_it_matters?:string|null}):ArmadilloResult{
 const text=[input.title,input.outcome,input.why_it_matters].filter(Boolean).join(' ').toLowerCase();
 const match=rules.find(rule=>rule.keywords.some(keyword=>text.includes(keyword)));
 if(!match)return {category:'General',goal_type:'Goal',metric:'measurable progress toward the stated outcome',evidence:['manual progress updates','goal milestones','completed sessions or actions'],integration:null,fallback:'Manual tracking remains the source of truth until a relevant evidence source is connected.',confidence:.55};
 return {category:match.category,goal_type:match.goal_type,metric:match.metric,evidence:match.evidence,integration:match.integration,fallback:'Manual tracking remains fully usable if the suggested integration is not connected.',confidence:.9};
}
