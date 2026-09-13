import { SPECIALIST_FLOWS } from './specialistRegistry';

export type { SpecialistFlow } from './specialistRegistry';
export { SPECIALIST_FLOWS } from './specialistRegistry';

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

export function specialistFor(input:{title?:string|null;category?:string|null;goal_type?:string|null}):SpecialistFlow|null{
 const text=[input.title,input.category,input.goal_type].filter(Boolean).join(' ').toLowerCase();
 return SPECIALIST_FLOWS.find(flow=>flow.keywords.some(keyword=>keywordMatches(text,keyword)))
   ||SPECIALIST_FLOWS.find(flow=>flow.goal_types.some(k=>k.toLowerCase()===(input.goal_type||'').toLowerCase()))
   ||null;
}
