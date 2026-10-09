const errorMap: Record<string, string> = {
  UNAUTHORIZED: 'Please sign in again to continue.',
  PURCHASE_TOKEN_MISSING: 'Google Play did not return a purchase token. Your purchase was not confirmed.',
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
  SUBSCRIPTION_RECORD_WRITE_FAILED: 'Your purchase was verified, but VOW could not finish updating Premium. Please try again.',
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
  return fallback;
}
