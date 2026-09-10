export type ArmadilloResult = { category:string; goal_type:string; metric:string; evidence:string[]; integration:string|null; fallback:string; confidence:number };

type Rule = { category:string; goal_type:string; metric:string; evidence:string[]; integration:string|null; keywords:string[] };
const rules: Rule[] = [
  {category:'Sports',goal_type:'Running',metric:'distance, pace, time',evidence:['activity distance','activity pace','activity time'],integration:'Strava',keywords:['run','running','5k','10k','marathon','half marathon','mile','km']},
  {category:'Sports',goal_type:'Cycling',metric:'distance, duration',evidence:['ride distance','ride duration'],integration:'Strava',keywords:['cycle','cycling','bike','biking','ride','kilometre']},
  {category:'Sports',goal_type:'Football',metric:'sessions, minutes, performance',evidence:['training sessions','match activity','manual performance notes'],integration:'Strava',keywords:['football','soccer','match','football training']},
  {category:'Sports',goal_type:'Swimming',metric:'distance, duration, sessions',evidence:['swim distance','swim duration','training sessions'],integration:'Strava',keywords:['swim','swimming','freestyle','backstroke','breaststroke','pool']},
  {category:'Education',goal_type:'Study',metric:'study time, task completion, accuracy',evidence:['study sessions','completed tasks','practice results'],integration:'Google Calendar',keywords:['study','revise','revision','exam','homework','learn','learning','physics','chemistry','biology','maths','mathematics','english','history','geography','french']},
  {category:'Technology/Projects',goal_type:'Coding',metric:'commits, pull requests, shipped features',evidence:['GitHub activity','completed deliverables','release history'],integration:'GitHub',keywords:['code','coding','programming','software','developer','github','commit','commits','pull request','repository','repo']},
  {category:'Technology/Projects',goal_type:'Engineering',metric:'iterations, tests, deliverables',evidence:['project milestones','prototype iterations','test results'],integration:'Google Calendar',keywords:['engineering','mechatronics','robotics','arduino','cad','prototype','electronics','mechanical','3d print']},
  {category:'Career/Projects',goal_type:'Career',metric:'applications, interviews, completed actions',evidence:['application tracker','calendar actions','project milestones'],integration:'Google Calendar',keywords:['career','cv','resume','job','application','internship','portfolio','interview','linkedin']},
  {category:'Productivity',goal_type:'Task Execution',metric:'completed tasks, sessions, consistency',evidence:['completed tasks','scheduled sessions','completion rate'],integration:'Google Tasks',keywords:['productive','productivity','tasks','organise','organize','routine','declutter','plan my day','focus']},
  {category:'Reading',goal_type:'Reading',metric:'pages, books, reading time',evidence:['pages read','books completed','reading sessions'],integration:'Google Books',keywords:['read','reading','book','books','pages','novel']},
  {category:'Mindfulness',goal_type:'Meditation',metric:'sessions, duration',evidence:['meditation sessions','meditation duration'],integration:'Medito',keywords:['meditate','meditation','mindfulness','breathing','calm']},
  {category:'Faith',goal_type:'Bible Reading',metric:'chapters, reading sessions, reflections',evidence:['Bible reading sessions','chapters completed','journal reflections'],integration:'YouVersion Bible',keywords:['bible','scripture','prayer','devotion','devotional','verse','christian','faith']},
  {category:'Health',goal_type:'Healthy Routine',metric:'habits completed, sessions, consistency',evidence:['habit completion','scheduled routines','weekly consistency'],integration:'Health Connect',keywords:['health','healthy','sleep','hydration','water','habit','wellness','nutrition']},
];

export function analyseGoalForEvidence(input:{title?:string|null;outcome?:string|null;why_it_matters?:string|null}):ArmadilloResult {
  const text=[input.title,input.outcome,input.why_it_matters].filter(Boolean).join(' ').toLowerCase();
  const scored = rules.map((rule) => ({ rule, score: rule.keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0) })).filter(({ score }) => score > 0).sort((a,b) => b.score - a.score);
  const match = scored[0]?.rule;
  if (!match) return {category:'General',goal_type:'Goal',metric:'measurable progress toward the stated outcome',evidence:['manual progress updates','goal milestones','completed sessions or actions'],integration:null,fallback:'Manual tracking remains the source of truth until a relevant evidence source is connected.',confidence:.55};
  const confidence = Math.min(.98, .65 + scored[0].score * .08 + (scored[1] && scored[0].score > scored[1].score ? .06 : 0));
  return {category:match.category,goal_type:match.goal_type,metric:match.metric,evidence:match.evidence,integration:match.integration,fallback:'Manual tracking remains fully usable if the suggested integration is not connected.',confidence};
}
