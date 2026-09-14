import { GENERAL_SPECIALIST_FLOW, SPECIALIST_FLOWS } from './specialistRegistry';
import type { SpecialistFlow } from './specialistRegistry';
import { specialistFromSemanticSignal } from './semanticDomainSignals';

export type { SpecialistFlow } from './specialistRegistry';
export { GENERAL_SPECIALIST_FLOW, SPECIALIST_FLOWS } from './specialistRegistry';

function keywordRegex(keyword: string): RegExp {
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const usesWordBoundary = /^[A-Za-z0-9_]+$/.test(escaped);
  return usesWordBoundary
    ? new RegExp(`\\b${escaped}\\b`, 'i')
    : new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, 'i');
}

function keywordMatches(text: string, keyword: string): boolean {
  return keywordRegex(keyword).test(text);
}

export function specialistFor(input:{title?:string|null;category?:string|null;goal_type?:string|null}):SpecialistFlow{
  const text=[input.title,input.category,input.goal_type].filter(Boolean).join(' ').toLowerCase();

  // First preserve explicit/specific sub-skill intent. A concrete technique such
  // as "flying spin kick" must not collapse into the generic Skill Acquisition flow.
  const semantic=specialistFromSemanticSignal(text,SPECIALIST_FLOWS);
  if (semantic) return semantic;

  // Then use the existing broad specialist registry for ordinary domain matches.
  const keywordMatch=SPECIALIST_FLOWS.find(flow=>flow.keywords.some(keyword=>keywordMatches(text,keyword)));
  if (keywordMatch) return keywordMatch;

  return SPECIALIST_FLOWS.find(flow=>flow.goal_types.some(k=>k.toLowerCase()===(input.goal_type||'').toLowerCase()))
    ||GENERAL_SPECIALIST_FLOW;
}
