export type FaithReadingRecommendation = {
  theme: string;
  books: string[];
  verses: string[];
  rationale: string;
};

export type ArmadilloResult = { category:string; goal_type:string; metric:string; evidence:string[]; integration:string|null; fallback:string; confidence:number; needs_clarification:boolean; clarification_reasons:string[] };

type Rule = { category:string; goal_type:string; metric:string; evidence:string[]; integration:string|null; keywords:string[]; clarificationReasons?:string[] };
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
  {category:'Faith',goal_type:'Bible Reading',metric:'chapters, reading sessions, reflections',evidence:['Bible reading sessions','chapters completed','journal reflections'],integration:'YouVersion Bible',keywords:['bible','scripture','prayer','devotion','devotional','verse','verses','christian','christ','god','jesus','faith','spiritual','spiritually','church','closer to god','closer to God'],clarificationReasons:['spiritual focus must be personalised before VOW chooses passages','Bible familiarity and preferred reading depth affect book selection','available time and consistency determine the reading plan']},
  {category:'Reading',goal_type:'Reading',metric:'pages, books, reading time',evidence:['pages read','books completed','reading sessions'],integration:'Google Books',keywords:['read','reading','book','books','pages','novel']},
  {category:'Mindfulness',goal_type:'Meditation',metric:'sessions, duration',evidence:['meditation sessions','meditation duration'],integration:'Medito',keywords:['meditate','meditation','mindfulness','breathing','calm']},
  {category:'Health',goal_type:'Healthy Routine',metric:'habits completed, sessions, consistency',evidence:['habit completion','scheduled routines','weekly consistency'],integration:'Health Connect',keywords:['health','healthy','sleep','hydration','water','habit','wellness','nutrition']},
];

export function isFaithGoal(input:{title?:string|null;outcome?:string|null;why_it_matters?:string|null}) {
  const text=[input.title,input.outcome,input.why_it_matters].filter(Boolean).join(' ').toLowerCase();
  const faith = rules.find((rule) => rule.goal_type === 'Bible Reading');
  return Boolean(faith?.keywords.some((keyword) => text.includes(keyword.toLowerCase())));
}

export function faithClarificationQuestions() {
  return [
    'What are you hoping to grow in spiritually right now — knowing God better, understanding Jesus, prayer, faith, wisdom, character, or something else?',
    'How familiar are you with the Bible, and have you read any books of it before?',
    'How much time can you realistically give to Bible reading, and how often would you like to read each week?',
  ];
}

export function resolveFaithReadingRecommendation(answers: Array<{ question?:string; answer?:string|null }>): FaithReadingRecommendation {
  const text = answers.map((item) => item.answer || '').join(' ').toLowerCase();
  const themes: Array<[string,string[],string[]]> = [
    ['Knowing Jesus',['John','Luke'],['John 3:16','John 15:1-11','Luke 15:11-32']],
    ['Building faith',['Mark','Hebrews'],['Mark 4:35-41','Hebrews 11:1-6','Hebrews 12:1-3']],
    ['Growing in prayer',['Luke','Philippians'],['Luke 11:1-13','Philippians 4:4-9']],
    ['Wisdom and daily character',['Proverbs','James'],['Proverbs 1:1-7','James 1:2-8','James 3:13-18']],
    ['Understanding grace and new life',['Romans','Ephesians'],['Romans 5:1-11','Ephesians 2:1-10']],
  ];
  const selected = themes.find(([theme]) => {
    const key = theme.toLowerCase();
    if (key.includes('jesus')) return /jesus|gospel|know god|knowing god/.test(text);
    if (key.includes('faith')) return /faith|trust|believe|doubt/.test(text);
    if (key.includes('prayer')) return /pray|prayer|praying/.test(text);
    if (key.includes('wisdom')) return /wisdom|character|discipline|proverb|decision/.test(text);
    return /grace|saved|salvation|new life|christian life/.test(text);
  }) || themes[0];
  const time = /45|60|hour/.test(text) ? 'a slower reading pace with reflection' : /10|15|20|30/.test(text) ? 'a short repeatable reading pace' : 'a moderate repeatable reading pace';
  return { theme: selected[0], books: selected[1], verses: selected[2], rationale: `Start with ${selected[1].join(' and ')} and ${selected[2][0]} as an anchor passage, using ${time}. The final plan should adapt after the first week of reflection.` };
}

export function analyseGoalForEvidence(input:{title?:string|null;outcome?:string|null;why_it_matters?:string|null}):ArmadilloResult {
  const text=[input.title,input.outcome,input.why_it_matters].filter(Boolean).join(' ').toLowerCase();
  const scored = rules.map((rule) => ({ rule, score: rule.keywords.reduce((score, keyword) => score + (text.includes(keyword.toLowerCase()) ? 1 : 0), 0) })).filter(({ score }) => score > 0).sort((a,b) => b.score - a.score);
  const match = scored[0]?.rule;
  if (!match) return {category:'General',goal_type:'Goal',metric:'measurable progress toward the stated outcome',evidence:['manual progress updates','goal milestones','completed sessions or actions'],integration:null,fallback:'Manual tracking remains the source of truth until a relevant evidence source is connected.',confidence:.55,needs_clarification:false,clarification_reasons:[]};
  const faith = match.goal_type === 'Bible Reading';
  const confidence = Math.min(.98, .65 + scored[0].score * .08 + (scored[1] && scored[0].score > scored[1].score ? .06 : 0));
  return {category:match.category,goal_type:match.goal_type,metric:match.metric,evidence:match.evidence,integration:match.integration,fallback:'Manual tracking remains fully usable if the suggested integration is not connected.',confidence,needs_clarification:faith,clarification_reasons:faith ? (match.clarificationReasons || []) : []};
}
