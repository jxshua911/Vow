const errorMap: Record<string, string> = {
  UNAUTHORIZED: 'Please sign in again to continue.',
  PURCHASE_TOKEN_MISSING: 'Google Play did not return a purchase token. Your purchase was not confirmed.',
  PLAY_STORE_UNAVAILABLE: 'Google Play Billing could not connect. This does not mean your VOW Premium access is missing; check that Google Play Store is available on this device and try again.',
  PLAY_STORE_RESTORE_FAILED: 'Google Play could not restore purchases right now. Your VOW account access has not been changed. Please try again later.',
  PURCHASE_VERIFICATION_FAILED: 'We could not verify the purchase with Google Play. Your Premium access has not been changed.',
  PURCHASE_ACCOUNT_MISMATCH: 'This purchase is linked to a different VOW account. Sign in with the account that originally made the purchase.',
  PURCHASE_ALREADY_LINKED: 'This purchase is already linked to another VOW account.',
  PREMIUM_CONFIG_MISSING: 'Premium purchases are temporarily unavailable. Please try again later.',
  AI_CONCURRENCY_LIMIT: 'VOW is already working on another AI request. Give it a moment, then try again.',
  AI_USER_DAILY_LIMIT: "You’ve reached today’s AI usage limit. Try again tomorrow.",
  AI_USER_MONTHLY_LIMIT: 'You’ve reached this month’s AI usage limit.',
  AI_GLOBAL_DAILY_BUDGET: 'AI planning is temporarily paused while VOW manages its daily capacity. Please try again later.',
  AI_GLOBAL_MONTHLY_BUDGET: 'AI planning is temporarily paused while VOW manages its monthly capacity. Please try again later.',
  AI_GUARDRAIL_CHECK_FAILED: 'VOW could not verify AI availability. Nothing was changed; please try again.',
  ENTITLEMENT_RESERVATION_FAILED: 'VOW could not verify your planning allowance. Nothing was charged; please try again.',
  ENTITLEMENT_FINALIZE_FAILED: 'VOW could not finish recording this plan. Please try again.',
  GOAL_CATEGORY_UNCLEAR: 'VOW needs a little more detail about this goal. Please try again with more context.',
  GENERIC_SESSION_TASK: 'VOW could not create a specific enough plan. Please try again.',
  INSUFFICIENT_MILESTONES: 'VOW could not create enough milestones for this plan. Please try again.',
  INSUFFICIENT_WEEKLY_SESSIONS: 'VOW could not create enough sessions for this plan. Please try again.',
  REPETITIVE_SCHEDULE: 'VOW could not create a varied enough schedule. Please try again.',
  SUBSCRIPTION_RECORD_WRITE_FAILED: 'Your purchase was verified, but VOW could not finish updating Premium. Please try again.',
  AUTH_REQUIRED: 'Your session has expired. Sign in again before saving this plan.',
  INVALID_GOAL: 'VOW could not validate this goal. Return to the draft and rebuild the plan.',
  INVALID_GOAL_STATUS: 'This draft has changed and cannot be activated as-is. Reopen the draft and try again.',
  GOAL_NOT_FOUND: 'VOW could not find this draft. Refresh your goals and try again.',
  PLAN_REQUIRED: 'The generated plan was not saved completely. Rebuild the plan before confirming it.',
  PLAN_DURATION_MISMATCH: 'The plan duration no longer matches your selection. Rebuild the plan and confirm again.',
  MILESTONE_COUNT_INVALID: 'VOW could not save the plan because it needs at least two clear milestones. Rebuild the plan.',
  PLAN_ITEM_COUNT_INVALID: 'VOW could not save the schedule. Rebuild the plan with sessions on your selected days.',
  EXECUTION_COUNT_MISMATCH: 'VOW could not save all scheduled sessions consistently. Rebuild the plan and try again.',
  MILESTONE_QUALITY_REJECTED: 'One or more milestones need a clearer description. Rebuild the plan and try again.',
  MILESTONE_WEEK_INVALID: 'A milestone falls outside the selected plan duration. Rebuild the plan and try again.',
  PLAN_ITEM_QUALITY_REJECTED: 'One or more sessions are missing a clear purpose or measurable target. Rebuild the plan and try again.',
  PLAN_ITEM_WEEK_INVALID: 'A scheduled session falls outside the selected plan duration. Rebuild the plan and try again.',
  PLAN_ITEM_SCHEDULE_INVALID: 'One or more sessions have an invalid day or time. Check your schedule and rebuild the plan.',
  PLAN_ITEM_DURATION_INVALID: 'A session duration is outside the supported range. Rebuild the plan with shorter sessions.',
  SESSION_QUALITY_REJECTED: 'One or more scheduled sessions are incomplete. Rebuild the plan and try again.',
  SESSION_DURATION_INVALID: 'A session duration is outside the supported range. Rebuild the plan with shorter sessions.',
};

export function userFacingError(error: unknown, fallback = 'Something went wrong. Please try again.') {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!raw) return fallback;
  const code = raw.split(':')[0];
  if (errorMap[code]) return errorMap[code];
  if (/network|fetch|failed to fetch|connection/i.test(raw)) return 'VOW could not connect right now. Check your connection and try again.';
  if (/invalid login credentials/i.test(raw)) return 'That email or password is incorrect.';
  if (/email.*not confirmed/i.test(raw)) return 'Please confirm your email address before signing in.';
  if (/user already registered/i.test(raw)) return 'An account with this email already exists. Try signing in instead.';
  if (/not available on your current plan|usage_limit|quota_exceeded/i.test(raw)) return `You have used your ${3} free planning actions this month. Premium unlocks unlimited planning.`;
  return fallback;
}
