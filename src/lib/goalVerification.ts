import { supabase } from './supabase';

export type VerificationSource =
  | 'self_report'
  | 'google_calendar'
  | 'strava'
  | 'health_connect'
  | 'focus_session'
  | 'journal';

export interface GoalEvidence {
  id: string;
  goal_id: string;
  source: VerificationSource;
  evidence_type: string;
  evidence: Record<string, unknown>;
  confidence: number;
  observed_at: string;
  created_at: string;
}

export async function recordGoalEvidence(input: {
  goalId: string;
  source: VerificationSource;
  evidenceType: string;
  evidence?: Record<string, unknown>;
  confidence?: number;
  observedAt?: string;
}) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('goal_evidence')
    .insert({
      user_id: user.user.id,
      goal_id: input.goalId,
      source: input.source,
      evidence_type: input.evidenceType,
      evidence: input.evidence ?? {},
      confidence: Math.max(0, Math.min(1, input.confidence ?? 0)),
      observed_at: input.observedAt ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as GoalEvidence;
}

export async function getGoalEvidence(goalId: string) {
  const { data, error } = await supabase
    .from('goal_evidence')
    .select('*')
    .eq('goal_id', goalId)
    .order('observed_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as GoalEvidence[];
}

export function calculateVerificationConfidence(evidence: GoalEvidence[]) {
  if (!evidence.length) return { score: 0, level: 'none' as const };

  const strongestBySource = new Map<VerificationSource, GoalEvidence>();
  for (const item of evidence) {
    const existing = strongestBySource.get(item.source);
    if (!existing || item.confidence > existing.confidence) {
      strongestBySource.set(item.source, item);
    }
  }

  const values = [...strongestBySource.values()].map((item) => item.confidence);
  const score = Math.min(1, values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length));

  if (score >= 0.8) return { score, level: 'high' as const };
  if (score >= 0.5) return { score, level: 'medium' as const };
  return { score, level: 'low' as const };
}
