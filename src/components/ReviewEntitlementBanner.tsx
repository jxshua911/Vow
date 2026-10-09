import { useEffect, useState } from 'react';
import { getEntitlementSnapshot, type EntitlementSnapshot } from '@/lib/entitlements';
import { UpgradePrompt } from './UpgradePrompt';

export function ReviewEntitlementBanner() {
  const [usage, setUsage] = useState<EntitlementSnapshot | null>(null);
  useEffect(() => { getEntitlementSnapshot().then(setUsage); }, []);
  if (!usage || usage.plan === 'premium' || usage.advanced_reviews_used < (usage.advanced_reviews_limit ?? 1)) return null;
  return <div className="mb-8"><UpgradePrompt result={{ allowed: false, reason: 'usage_limit', feature: 'advanced_review', used: usage.advanced_reviews_used, limit: usage.advanced_reviews_limit ?? 1 }} title="You’ve used this month’s free advanced review" compact /></div>;
}
