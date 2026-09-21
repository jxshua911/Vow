import { supabase } from '@/lib/supabase';

export type EntitlementFeature =
  | 'create_goal'
  | 'planning_action'
  | 'adaptive_replan'
  | 'advanced_review'
  | 'deep_analysis'
  | 'full_methodology';

export type EntitlementSnapshot = {
  plan: 'free' | 'premium';
  active_goals: number;
  active_goal_limit: number | null;
  planning_used: number;
  planning_limit: number | null;
  adaptive_replans_used: number;
  adaptive_replans_limit: number | null;
  advanced_reviews_used: number;
  advanced_reviews_limit: number | null;
  period_start: string;
};

export type EntitlementResult = {
  allowed: boolean;
  reason?: string;
  feature?: string;
  used?: number;
  limit?: number;
};

export async function getEntitlementSnapshot(): Promise<EntitlementSnapshot | null> {
  const { data, error } = await supabase.rpc('vow_get_entitlement_snapshot');
  if (error) {
    console.error('[VOW] Failed to load entitlement snapshot:', error);
    return null;
  }
  return data as EntitlementSnapshot;
}

export async function consumeEntitlement(feature: EntitlementFeature, metadata: Record<string, unknown> = {}): Promise<EntitlementResult> {
  const { data, error } = await supabase.rpc('vow_consume_entitlement', {
    p_feature: feature,
    p_metadata: metadata,
  });
  if (error) throw new Error(error.message || 'Could not verify VOW entitlement.');
  return data as EntitlementResult;
}

export function entitlementMessage(result: EntitlementResult): string {
  if (result.reason === 'active_goal_limit') return 'You already have an active goal. Premium unlocks unlimited active goals.';
  if (result.feature === 'planning_action' || (result.reason === 'usage_limit' && result.feature === 'planning_action')) return 'You have used your 3 free planning actions this month. Premium unlocks unlimited planning.';
  if (result.feature === 'adaptive_replan' || (result.reason === 'usage_limit' && result.feature === 'adaptive_replan')) return 'You have used your free adaptive replan this month. Premium keeps VOW adapting your plan when life changes.';
  if (result.feature === 'advanced_review' || (result.reason === 'usage_limit' && result.feature === 'advanced_review')) return 'You have used your free advanced review this month. Premium unlocks ongoing weekly analysis.';
  if (result.reason === 'premium_required') return 'This is part of VOW Premium.';
  return 'Unlock the full VOW planning experience with Premium.';
}
