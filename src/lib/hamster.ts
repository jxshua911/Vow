export const HAMSTER_MODES = ['one_time','project','recurring','mastery','performance','event','adaptive'] as const;
export type HamsterMode = typeof HAMSTER_MODES[number];

export type DomainFlow = {
  id: string;
  domains: string[];
  goal_types: string[];
  discovery: string[];
  evidence: string[];
  planning_principles: string[];
  completion_signal: string;
};

export type HamsterWorkflow = {
  mode: HamsterMode;
  name: string;
  purpose: string;
  requires_horizon: boolean;
  requires_cadence: boolean;
  requires_deadline: boolean;
  output_shape: string;
  questions: string[];
  rules: string[];
};

export const DOMAIN_FLOWS: DomainFlow[] = [
  { id: 'sports', domains: ['Sports'], goal_types: ['Running','Cycling','Swimming','Football','Basketball','Tennis','Golf','Surfing','Dance'], discovery: ['current ability and recent evidence','specific performance outcome','available equipment, venue and constraints','injury/recovery or safety context when relevant'], evidence: ['sessions','performance metrics','skill execution','competition or benchmark results'], planning_principles: ['progress only from observed capacity','alternate loading and recovery where relevant','make drills specific to the sport and position or event'], completion_signal: 'the stated performance or participation outcome is achieved and evidenced' },
  { id: 'education', domains: ['Education','Learning'], goal_types: ['Academic Study','Learning Skills'], discovery: ['current knowledge or diagnostic baseline','exact syllabus, skill or assessment target','assessment date or outcome requirements','learning preferences and available materials'], evidence: ['diagnostic results','retrieval performance','practice accuracy','completed assessments'], planning_principles: ['diagnose before prescribing','use retrieval and deliberate practice','target the highest-value knowledge gaps first'], completion_signal: 'the required competency or assessment outcome is demonstrated' },
  { id: 'languages', domains: ['Languages'], goal_types: ['Language Learning'], discovery: ['current proficiency','target use case','speaking/listening/reading/writing priority','language environment and opportunities to practise'], evidence: ['vocabulary recall','comprehension','spoken or written samples','real-world use'], planning_principles: ['balance input and output','increase difficulty from demonstrated competence','use the target language in realistic contexts'], completion_signal: 'the stated communication capability can be demonstrated' },
  { id: 'technology', domains: ['Technology/Projects'], goal_types: ['Programming','GitHub Contributions','Engineering'], discovery: ['current stack or technical level','concrete deliverable or capability','constraints and available tooling','acceptance criteria or tests'], evidence: ['working code','tests','commits','prototype iterations','shipped deliverables'], planning_principles: ['work from acceptance criteria','slice deliverables into verifiable increments','research technical unknowns before locking implementation'], completion_signal: 'the defined technical outcome works against its acceptance criteria' },
  { id: 'creative', domains: ['Creative Skills'], goal_types: ['Drawing','Painting','Photography','Writing','Music','Crochet','Knitting'], discovery: ['current ability','desired style or finished outcome','tools/materials','reference artists or preferred methods'], evidence: ['practice attempts','finished pieces','technique checkpoints','feedback'], planning_principles: ['teach the exact medium or craft','alternate focused technique work with complete pieces','use critique and iteration as evidence'], completion_signal: 'the defined creative outcome is completed or the target capability is demonstrated' },
  { id: 'practical', domains: ['Practical Skills'], goal_types: ['Cooking','Woodworking'], discovery: ['desired object/dish or skill','experience level','tools, materials and workspace','quantity, style and constraints'], evidence: ['completed makes','measurements','technique execution','quality checks'], planning_principles: ['sequence prerequisite techniques','adapt to actual equipment','make the final task resemble the stated outcome'], completion_signal: 'the intended practical outcome is successfully completed' },
  { id: 'communication', domains: ['Communication'], goal_types: ['Public Speaking','Teamwork','Listening','Negotiation'], discovery: ['specific communication situation','current behaviour or baseline','audience or relationship context','desired change and feedback source'], evidence: ['rehearsals','recordings','feedback','real conversations or outcomes'], planning_principles: ['use the real communication context','practise observable behaviours','increase stakes only after reliable execution'], completion_signal: 'the target behaviour is demonstrated in the relevant context' },
  { id: 'finance', domains: ['Finance'], goal_types: ['Saving'], discovery: ['target and baseline','income/expense context','time constraints','risk tolerance and non-negotiables'], evidence: ['manual balances','saving milestones','budget adherence','transaction summaries when connected'], planning_principles: ['separate controllable actions from market uncertainty','protect essential needs','review actual behaviour rather than planned intentions'], completion_signal: 'the defined financial target or behaviour is achieved' },
  { id: 'wellbeing', domains: ['Mindfulness','Wellbeing'], goal_types: ['Meditation','Stress Management','Sleep Routine'], discovery: ['current pattern','desired outcome','environment and constraints','signs that the intervention is helping or not'], evidence: ['sessions','self-reports','routine adherence','pattern changes'], planning_principles: ['use sustainable routines','change one important variable at a time','adapt from observed response'], completion_signal: 'the defined wellbeing outcome or routine is established and evidenced' },
  { id: 'reading', domains: ['Reading'], goal_types: ['Reading'], discovery: ['purpose for reading','subject or genre','current reading pace','desired comprehension or completion outcome'], evidence: ['pages','chapters','books','reading sessions','comprehension notes'], planning_principles: ['match material to purpose','protect comprehension','adjust pace from actual retention'], completion_signal: 'the defined reading outcome is completed with the intended comprehension' },
  { id: 'career', domains: ['Career/Projects'], goal_types: ['Project','Career Development'], discovery: ['specific opportunity or deliverable','current position','requirements','network/resources and constraints'], evidence: ['applications','interviews','deliverables','portfolio changes','milestones'], planning_principles: ['optimise for the target opportunity','sequence dependencies','prioritise evidence-producing actions'], completion_signal: 'the stated career outcome is achieved or its acceptance criteria are met' },
  { id: 'travel', domains: ['Travel'], goal_types: ['Travel Planning'], discovery: ['destination and dates if known','purpose and must-haves','budget/logistics','documents and constraints'], evidence: ['confirmed bookings','itinerary completeness','pre-departure checklist'], planning_principles: ['resolve hard constraints first','order bookings by dependency','make the final checklist executable'], completion_signal: 'the trip is fully prepared to the stated standard' },
  { id: 'faith', domains: ['Faith'], goal_types: ['Bible Reading'], discovery: ['spiritual focus','existing familiarity','preferred tradition or translation when relevant','realistic rhythm and reflection preference'], evidence: ['reading sessions','reflections','notes','practice or application'], planning_principles: ['centre the stated spiritual aim','match depth to familiarity','allow reflection and adaptation rather than completion-only tracking'], completion_signal: 'the agreed reading/reflection outcome is completed and meaningfully engaged with' },
];

export const HAMSTER_WORKFLOWS: Record<HamsterMode, HamsterWorkflow> = {
  one_time: {
    mode: 'one_time', name: 'One-time', purpose: 'Turn a single outcome into the clearest possible execution sequence.', requires_horizon: false, requires_cadence: false, requires_deadline: false,
    output_shape: 'ordered_steps',
    questions: ['What exactly must be finished or achieved?', 'What materials, tools, access or prerequisites do you already have?', 'What constraints could change the order or method?'],
    rules: ['Do not invent a weekly programme.', 'Prefer an ordered checklist or procedure.', 'Only schedule time when the user explicitly wants scheduling.', 'Stop when the stated outcome is complete.'],
  },
  project: {
    mode: 'project', name: 'Project', purpose: 'Move a multi-step deliverable from definition to completion.', requires_horizon: true, requires_cadence: false, requires_deadline: false,
    output_shape: 'milestones_and_tasks',
    questions: ['What is the finished deliverable and how will we know it is done?', 'What dependencies, resources or collaborators exist?', 'What is fixed and what can change?'],
    rules: ['Sequence dependencies before downstream work.', 'Use milestones tied to deliverables.', 'Re-plan when scope or dependencies change.', 'Avoid forcing recurring habits onto project work.'],
  },
  recurring: {
    mode: 'recurring', name: 'Recurring', purpose: 'Build a repeatable behaviour, routine or cadence that continues over time.', requires_horizon: true, requires_cadence: true, requires_deadline: false,
    output_shape: 'cadence_and_adaptation',
    questions: ['What should repeat and why?', 'What cadence feels realistic?', 'What evidence will show the routine is working?'],
    rules: ['Cadence is part of the goal.', 'Optimise for sustainability before volume.', 'Adapt frequency from observed adherence.', 'Do not declare completion merely because a week ended.'],
  },
  mastery: {
    mode: 'mastery', name: 'Mastery', purpose: 'Develop a capability through deliberate practice until a competency standard is met.', requires_horizon: true, requires_cadence: true, requires_deadline: false,
    output_shape: 'skill_levels_and_practice',
    questions: ['What can you do already?', 'What specific capability should mastery mean?', 'How will we test competence rather than just effort?'],
    rules: ['Start from a baseline.', 'Progress difficulty from demonstrated competence.', 'Test transfer, not just repetition.', 'Slow down or change the method when evidence says the skill is not consolidating.'],
  },
  performance: {
    mode: 'performance', name: 'Performance', purpose: 'Reach a measurable performance target from an observed baseline.', requires_horizon: true, requires_cadence: true, requires_deadline: false,
    output_shape: 'training_blocks_and_benchmarks',
    questions: ['What is the exact target?', 'What is your current verified baseline?', 'What constraints affect training, recovery or testing?'],
    rules: ['Train the limiting factors that the evidence identifies.', 'Use checkpoints and benchmark tests.', 'Adjust load when performance or recovery changes.', 'The target is the north star; the weekly structure is replaceable.'],
  },
  event: {
    mode: 'event', name: 'Event', purpose: 'Prepare for a fixed event or date by working backwards from its requirements.', requires_horizon: true, requires_cadence: true, requires_deadline: true,
    output_shape: 'countdown_plan',
    questions: ['What event and date are fixed?', 'What must be true by event day?', 'What preparation, logistics and contingencies matter?'],
    rules: ['Work backwards from the event.', 'Resolve hard dependencies early.', 'Use tapering or final readiness only when the domain calls for it.', 'Protect event-day requirements from unnecessary plan churn.'],
  },
  adaptive: {
    mode: 'adaptive', name: 'Adaptive', purpose: 'Let the plan rotate continuously as new evidence changes what should happen next.', requires_horizon: false, requires_cadence: false, requires_deadline: false,
    output_shape: 'rolling_next_best_action',
    questions: ['What evidence will tell us what to do next?', 'What can change between attempts?', 'What signals should trigger a harder, easier or different approach?'],
    rules: ['Never assume the original plan remains correct.', 'Every meaningful execution produces learning.', 'Use the newest evidence to select the next best action.', 'Preserve the goal while allowing the route to change.'],
  },
};

const ONE_TIME_PATTERNS = [ /\b(?:once|one[- ]time|just once|single time|one thing|make|cook|build|create|write|fix|prepare|set up|do)\b/i ];
const EVENT_PATTERNS = [ /\b(?:by|before|for)\s+(?:the\s+)?(?:event|exam|competition|race|match|wedding|trip|flight|deadline)\b/i, /\bon\s+\w+\s+\d{1,2}\b/i, /\bdeadline\b/i ];
const RECURRING_PATTERNS = [ /\b(?:daily|every day|weekly|every week|each week|every month|monthly|routine|habit|regularly)\b/i, /\b\d+\s*(?:times?|days?)\s+(?:a|per)\s+week\b/i ];
const PERFORMANCE_PATTERNS = [ /\b(?:under|sub)\s+\d+/i, /\b(?:faster|slower|higher|lower|stronger|longer|score|pace|time|weight)\b/i, /\b(?:PB|PR|personal best|personal record)\b/i ];
const MASTERY_PATTERNS = [ /\b(?:learn|master|become good|improve|develop|skill|competent|fluent|understand)\b/i ];
const PROJECT_PATTERNS = [ /\b(?:project|prototype|app|website|portfolio|launch|build out|deliverable|MVP)\b/i ];

export function findDomainFlow(category: string, goalType: string): DomainFlow | null {
  return DOMAIN_FLOWS.find(flow => flow.domains.some(x => x.toLowerCase() === category.toLowerCase()) || flow.goal_types.some(x => x.toLowerCase() === goalType.toLowerCase())) || null;
}

function matches(patterns: RegExp[], text: string) { return patterns.some(pattern => pattern.test(text)); }

export function inferHamsterMode(input: { title?: string | null; outcome?: string | null; why_it_matters?: string | null; category?: string | null; goal_type?: string | null; target?: string | null; time_target?: string | null }): HamsterMode {
  const text = [input.title, input.outcome, input.why_it_matters, input.target, input.time_target].filter(Boolean).join(' ');
  if (matches(EVENT_PATTERNS, text)) return 'event';
  if (matches(RECURRING_PATTERNS, text)) return 'recurring';
  if (matches(PERFORMANCE_PATTERNS, text)) return 'performance';
  if (matches(PROJECT_PATTERNS, text)) return 'project';
  if (matches(MASTERY_PATTERNS, text)) return 'mastery';
  if (matches(ONE_TIME_PATTERNS, text)) return 'one_time';
  return 'adaptive';
}

export function buildHamsterContext(input: Parameters<typeof inferHamsterMode>[0] & { answers?: Array<{ question?: string; answer?: string | null }>; planning_mode?: HamsterMode | null }) {
  const mode = input.planning_mode && HAMSTER_MODES.includes(input.planning_mode) ? input.planning_mode : inferHamsterMode(input);
  const workflow = HAMSTER_WORKFLOWS[mode];
  const domain = findDomainFlow(input.category || '', input.goal_type || '');
  const answered = (input.answers || []).filter(x => Boolean(x.answer?.trim()));
  return {
    mode,
    workflow,
    domain,
    answered_count: answered.length,
    personalisation_requirements: [...(domain?.discovery || []), ...workflow.questions],
    anti_generic_rules: [...workflow.rules, 'Use the exact domain flow. Never silently substitute a generic goal template.', 'If the domain is novel, ask domain-specific discovery questions before planning.'],
  };
}
