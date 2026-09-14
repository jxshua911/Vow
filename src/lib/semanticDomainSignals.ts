import type { SpecialistFlow } from './specialistRegistry';

// Semantic routing is deliberately broader than the specialist keyword list.
// A concrete sub-skill must retain its domain instead of falling into generic
// Skill Acquisition merely because the exact phrase is new to VOW.
type Signal = { flowId?: string; domain?: string; goalType?: string; patterns: RegExp[] };

const synthetic = (id: string, domain: string, goalType: string): SpecialistFlow => ({
  id,
  domain,
  goal_types: [goalType],
  keywords: [],
  required_inputs: [],
  questions: [],
  evidence: ['completed practice', 'demonstrated understanding', 'recorded progress', 'real-world application'],
  completion: 'the stated capability or learning outcome is demonstrated to the required standard',
  planning_lens: 'domain-aware progression, deliberate practice, evidence and feedback',
});

const SYNTHETIC_FLOWS: Record<string, SpecialistFlow> = {
  aviation: synthetic('aviation', 'Aviation', 'Aviation Learning'),
  military: synthetic('military', 'Military & Defence Studies', 'Military Studies'),
  science: synthetic('science', 'Science', 'Science Learning'),
  medicine: synthetic('medicine', 'Health & Medicine Education', 'Health Education'),
  law: synthetic('law', 'Law', 'Legal Studies'),
  finance: synthetic('finance', 'Finance', 'Financial Learning'),
  business: synthetic('business', 'Business', 'Business Learning'),
  publicSpeaking: synthetic('public-speaking', 'Communication', 'Public Speaking'),
  writing: synthetic('writing', 'Writing', 'Writing'),
  photography: synthetic('photography', 'Photography', 'Photography'),
  art: synthetic('art', 'Visual Arts', 'Art'),
  acting: synthetic('acting', 'Performing Arts', 'Acting'),
  psychology: synthetic('psychology', 'Psychology', 'Psychology Learning'),
  geography: synthetic('geography', 'Geography', 'Geography Learning'),
  astronomy: synthetic('astronomy', 'Astronomy', 'Astronomy Learning'),
  nature: synthetic('nature', 'Nature & Outdoors', 'Nature Learning'),
};

const SIGNALS: Signal[] = [
  // Martial arts and combat sports.
  { flowId: 'martial-arts', patterns: [
    /\b(?:mma|bjj|brazilian jiu[- ]?jitsu|jiu[- ]?jitsu|muay thai|sambo|aikido|capoeira|krav maga|wrestling|savate|wushu|kung fu|kickboxing|striking|grappling|sparring|kata|kumite|randori)\b/i,
    /\b(?:flying|spinning|turning|jumping)\s+(?:spin(?:ning)?|roundhouse|back|front|side|hook)\s+kick\b/i,
    /\b(?:spinning back kick|spinning hook kick|wheel kick|axe kick|hook kick|side kick|front kick|roundhouse kick|crescent kick|back kick|push kick|teep|takedown|armbar|arm bar|triangle choke|rear naked choke|kimura|guillotine|omoplata)\b/i,
  ]},
  // Football / soccer techniques and tactics.
  { flowId: 'football', patterns: [ /\b(?:stepover|roulette|elastico|rainbow flick|rabona|sombrero|nutmeg|scorpion kick|bicycle kick|overhead kick|knuckleball|trivela|la croqueta|first touch|pressing trigger|inverted fullback|low block|counter press)\b/i ] },
  { flowId: 'basketball', patterns: [ /\b(?:crossover|behind[- ]the[- ]back|between[- ]the[- ]legs|eurostep|stepback|fadeaway|alley[- ]oop|dunk|layup|hook shot|jump shot|pick and roll|zone defence|zone defense)\b/i ] },
  { flowId: 'tennis', patterns: [ /\b(?:kick serve|slice serve|flat serve|topspin|drop shot|lob|volley|half volley|tweener|serve[- ]and[- ]volley|inside[- ]out forehand)\b/i ] },
  { flowId: 'swimming', patterns: [ /\b(?:flip turn|open turn|streamline|bilateral breathing|underwater dolphin kick|dolphin kick|pull buoy|kickboard|catch[- ]up drill)\b/i ] },
  { flowId: 'cycling', patterns: [ /\b(?:cadence|bike fit|cornering|descending|climbing technique|drafting|peloton|time trial|criterium|track stand|clipless|bikepacking)\b/i ] },
  { flowId: 'golf', patterns: [ /\b(?:putting|chipping|pitching|bunker shot|fade|draw|golf swing|club fitting|approach shot)\b/i ] },
  { flowId: 'dance', patterns: [ /\b(?:popping|locking|breaking|ballet|pirouette|plié|salsa|bachata|contemporary|choreography|footwork)\b/i ] },

  // Aviation: preserve the domain even when the exact aviation term is absent
  // from the registry. This is classification, not an instruction to perform a
  // flight operation.
  { domain: 'aviation', patterns: [ /\b(?:aviation|aircraft|airplane|aeroplane|pilot|flight training|flight school|cockpit|runway|taxiway|airspace|airport|aerodynamics|avionics|air traffic control|atc|metar|taf|ifr|vfr|crosswind landing|takeoff|take-off|landing|stall|navigation|instrument rating|private pilot|commercial pilot)\b/i ] },

  // Military is intentionally classified as a study domain. Operational or
  // weapons-related goals must still pass VOW's safety layer downstream.
  { domain: 'military', patterns: [ /\b(?:military history|military studies|defence studies|defense studies|military strategy|military logistics|military organisation|military organization|military ranks|military doctrine|geopolitics|war studies|armed forces|army history|naval history|air force history|nato|peacekeeping|international security)\b/i ] },

  // STEM sub-domains.
  { flowId: 'programming', patterns: [ /\b(?:api endpoint|rest api|graphql|react|next\.js|vite|typescript|javascript|python|java|c\+\+|rust|git|github actions|unit test|integration test|debugging|refactoring|sql query|database schema|authentication)\b/i ] },
  { flowId: 'engineering', patterns: [ /\b(?:arduino|raspberry pi|esp32|servo motor|stepper motor|breadboard|soldering|circuit|gear train|linkage|robot arm|pid controller|tolerance|kinematics|dynamics|control system|microcontroller|mechatronics)\b/i ] },
  { flowId: '3d', patterns: [ /\b(?:blender|fusion 360|solidworks|extrude|bevel|boolean|mesh|sculpting|uv unwrap|rigging|3d model|3d modelling|3d modeling|render a model|parametric modelling|parametric modeling)\b/i ] },
  { flowId: 'data', patterns: [ /\b(?:pandas|numpy|sql|statistics|regression|classification|machine learning|data science|data analysis|data visualisation|data visualization|dashboard|etl|power bi|tableau)\b/i ] },
  { domain: 'science', patterns: [ /\b(?:physics|chemistry|biology|biochemistry|thermodynamics|mechanics|electromagnetism|quantum mechanics|organic chemistry|genetics|cell biology|microbiology|spectroscopy|titration|laboratory|lab report)\b/i ] },
  { domain: 'medicine', patterns: [ /\b(?:anatomy|physiology|pathology|pharmacology|medical terminology|nursing theory|clinical science|public health|epidemiology)\b/i ] },
  { domain: 'astronomy', patterns: [ /\b(?:astronomy|astrophysics|constellation|telescope|exoplanet|galaxy|nebula|stellar|cosmology|orbital mechanics)\b/i ] },
  { domain: 'geography', patterns: [ /\b(?:geography|cartography|gis|geographic information|topography|climatology|population geography|physical geography|human geography)\b/i ] },

  // Education, languages and communication.
  { flowId: 'academic-study', patterns: [ /\b(?:calculus|algebra|trigonometry|geometry|probability|organic chemistry|electromagnetism|essay writing|exam revision|igcse|a level|gcse|study for|revise for)\b/i ] },
  { flowId: 'language', patterns: [ /\b(?:vocabulary|grammar|conjugation|subjunctive|pronunciation|accent|conversation practice|listening comprehension|language fluency|translation|jlpt|dele|delf|ielts)\b/i ] },
  { domain: 'publicSpeaking', patterns: [ /\b(?:public speaking|presentation skills|speech writing|debate|debating|toastmasters|interview skills|storytelling|communication skills)\b/i ] },
  { domain: 'writing', patterns: [ /\b(?:creative writing|fiction writing|poetry|screenwriting|copywriting|technical writing|blog writing|journalism|novel writing|short story)\b/i ] },
  { flowId: 'research', patterns: [ /\b(?:literature review|research question|qualitative research|quantitative research|academic research|research methodology|thesis|dissertation|citation|bibliography)\b/i ] },

  // Creative domains.
  { domain: 'photography', patterns: [ /\b(?:photography|portrait photography|street photography|landscape photography|composition|exposure triangle|shutter speed|aperture|iso|depth of field|photo editing)\b/i ] },
  { domain: 'art', patterns: [ /\b(?:drawing|painting|watercolour|watercolor|oil painting|acrylic|sketching|perspective drawing|figure drawing|digital art|illustration|colour theory|color theory)\b/i ] },
  { domain: 'acting', patterns: [ /\b(?:acting|theatre|theater|monologue|improvisation|improv|stage acting|screen acting|voice acting|audition)\b/i ] },
  { domain: 'nature', patterns: [ /\b(?:birdwatching|birding|botany|ornithology|entomology|tree identification|plant identification|wildlife|nature observation|ecology)\b/i ] },

  // Practical / trade skills.
  { flowId: 'cooking', patterns: [ /\b(?:knife skills|sauté|saute|braising|roasting|fermentation|emulsification|sauce making|mise en place|bread making)\b/i ] },
  { flowId: 'woodworking', patterns: [ /\b(?:dovetail|mortise and tenon|wood joinery|wood turning|cabinet making|carpentry|woodworking)\b/i ] },
  { flowId: 'sewing', patterns: [ /\b(?:pattern drafting|hemming|zipper|seam allowance|overlock|serging|sewing|tailoring|embroidery)\b/i ] },

  // Business / finance / law.
  { domain: 'finance', patterns: [ /\b(?:budgeting|personal finance|investing|investment|compound interest|stocks|bonds|portfolio|financial literacy|accounting|bookkeeping|cash flow|valuation)\b/i ] },
  { domain: 'business', patterns: [ /\b(?:entrepreneurship|startup|business plan|market research|marketing strategy|sales|product management|project management|operations|leadership|management)\b/i ] },
  { domain: 'law', patterns: [ /\b(?:law|legal studies|contract law|constitutional law|criminal law|tort law|case law|legal research|moot court)\b/i ] },
  { domain: 'psychology', patterns: [ /\b(?:psychology|cognitive psychology|social psychology|developmental psychology|behavioural science|behavioral science|psychological research)\b/i ] },
];

export function specialistFromSemanticSignal(text: string, flows: SpecialistFlow[]): SpecialistFlow | null {
  for (const signal of SIGNALS) {
    if (!signal.patterns.some(pattern => pattern.test(text))) continue;
    if (signal.flowId) {
      const flow = flows.find(candidate => candidate.id === signal.flowId);
      if (flow) return flow;
    }
    if (signal.domain) {
      const key = signal.domain === 'publicSpeaking' ? 'publicSpeaking' : signal.domain;
      return SYNTHETIC_FLOWS[key] || null;
    }
  }
  return null;
}
