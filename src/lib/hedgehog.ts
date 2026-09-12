import type { GoalContext } from './goalContext';

export interface HedgehogCandidate {
  id: string;
  name: string;
  score: number;
  supported_evidence: string[];
  reason: string;
}

export interface HedgehogIntegrationDefinition {
  id: string;
  name: string;
  evidence: string[];
  recommendedGoalKeywords: string[];
}

function matchesKeyword(text: string, keyword: string) {
  const value = keyword.trim().toLowerCase();
  if (!value) return false;
  if (value.includes(' ')) return text.includes(value);
  return new RegExp(`(^|[^a-z0-9])${value.replace(/[^a-z0-9]/g, '')}([^a-z0-9]|$)`, 'i').test(text);
}

export function rankHedgehogIntegrations(context: GoalContext, catalog: HedgehogIntegrationDefinition[]): HedgehogCandidate[] {
  const text = [
    context.goal.title,
    context.goal.outcome,
    context.goal.why_it_matters || '',
    context.armadillo.category,
    context.armadillo.goal_type,
    context.armadillo.evidence.join(' '),
    context.preferences.join(' '),
    context.constraints.join(' '),
  ].join(' ').toLowerCase();

  return catalog
    .map((integration) => {
      const keywordHits = integration.recommendedGoalKeywords.filter((keyword) => matchesKeyword(text, keyword));
      const evidenceHits = integration.evidence.filter((item) =>
        context.armadillo.evidence.some((required) => required.toLowerCase() === item.toLowerCase()) ||
        context.armadillo.metric.toLowerCase().includes(item.toLowerCase()),
      );
      const score = keywordHits.length * 2 + evidenceHits.length;
      return {
        id: integration.id,
        name: integration.name,
        score,
        supported_evidence: evidenceHits.length ? evidenceHits : integration.evidence.slice(0, 3),
        reason: score > 0 ? `${integration.name} can support ${context.armadillo.metric}.` : '',
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
