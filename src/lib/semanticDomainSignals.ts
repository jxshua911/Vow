import type { SpecialistFlow } from './specialistRegistry';

// Domain signals catch specific techniques, abbreviations and sub-skills that are
// semantically inside an existing specialist flow but are unlikely to match the
// broad domain keyword itself. Keep these deterministic and conservative: the
// goal is to preserve specificity, not to guess a whole plan from one word.
const SIGNALS: Array<{ flowId: string; patterns: RegExp[] }> = [
  {
    flowId: 'martial-arts',
    patterns: [
      /\b(?:mma|bjj|brazilian jiu[- ]?jitsu|jiu[- ]?jitsu|muay thai|mt|sambo|aikido|capoeira|krav maga|wrestling|savate|wushu|kung fu)\b/i,
      /\b(?:flying|spinning|turning|jumping|jump)\s+(?:spin(?:ning)?|roundhouse|back|front|side)\s+kick\b/i,
      /\b(?:spinning back kick|spinning hook kick|wheel kick|axe kick|hook kick|side kick|front kick|roundhouse kick|crescent kick|back kick|push kick|teep|sweep|takedown|throw|armbar|arm bar|triangle choke|rear naked choke|kimura|guillotine|omoplata)\b/i,
      /\b(?:kickboxing|kick boxing|striking|grappling|sparring|kata|kumite|randori|gi|no[- ]?gi)\b/i,
    ],
  },
  {
    flowId: 'football',
    patterns: [
      /\b(?:stepover|step[- ]over|roulette|elastico|rainbow flick|rabona|sombrero|nutmeg|scorpion kick|bicycle kick|overhead kick|knuckleball|outside[- ]of[- ]the[- ]foot|trivela|la croqueta)\b/i,
    ],
  },
  {
    flowId: 'basketball',
    patterns: [
      /\b(?:crossover|behind[- ]the[- ]back|between[- ]the[- ]legs|eurostep|stepback|step[- ]back|fadeaway|alley[- ]oop|dunk|layup|hook shot|jump shot)\b/i,
    ],
  },
  {
    flowId: 'tennis',
    patterns: [
      /\b(?:kick serve|slice serve|flat serve|topspin|drop shot|drop[- ]shot|lob|volley|half volley|tweener|serve[- ]and[- ]volley)\b/i,
    ],
  },
  {
    flowId: 'swimming',
    patterns: [
      /\b(?:flip turn|open turn|streamline|bilateral breathing|underwater dolphin kick|dolphin kick|pull buoy|kickboard)\b/i,
    ],
  },
  {
    flowId: 'programming',
    patterns: [
      /\b(?:api endpoint|rest api|graphql|react|next\.js|vite|typescript|javascript|python|java|c\+\+|rust|git|github actions|unit test|integration test|debug a bug|refactor code)\b/i,
    ],
  },
  {
    flowId: 'engineering',
    patterns: [
      /\b(?:arduino|raspberry pi|esp32|servo motor|stepper motor|breadboard|soldering|circuit|gear train|linkage|robot arm|pid controller|3d print|3d printing|tolerance|cad drawing)\b/i,
    ],
  },
  {
    flowId: '3d',
    patterns: [
      /\b(?:blender|fusion 360|solidworks|extrude|bevel|boolean|mesh|sculpting|uv unwrap|rigging|3d model|3d modelling|3d modeling|render a model)\b/i,
    ],
  },
  {
    flowId: 'music',
    patterns: [
      /\b(?:guitar|piano|keyboard|drums|violin|ukulele|bass guitar|chord progression|music theory|sight[- ]?reading|arpeggio|scale practice)\b/i,
    ],
  },
];

export function specialistFromSemanticSignal(text: string, flows: SpecialistFlow[]): SpecialistFlow | null {
  for (const signal of SIGNALS) {
    if (!signal.patterns.some(pattern => pattern.test(text))) continue;
    const flow = flows.find(candidate => candidate.id === signal.flowId);
    if (flow) return flow;
  }
  return null;
}
