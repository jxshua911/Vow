const env = (name: string) => {
  const value = import.meta.env[name] as string | undefined;
  return value?.trim() || '';
};

// These identifiers are public Google Play catalogue values, not secrets.
// Web builds may omit them; Premium purchase operations remain unavailable until
// the native build is configured with the real Play Console product/base-plan IDs.
export const VOW_PREMIUM_MONTHLY = env('VITE_GOOGLE_PLAY_PREMIUM_MONTHLY_PRODUCT_ID');
export const VOW_PREMIUM_YEARLY = env('VITE_GOOGLE_PLAY_PREMIUM_YEARLY_PRODUCT_ID');
export const VOW_PREMIUM_MONTHLY_BASE_PLAN = env('VITE_GOOGLE_PLAY_PREMIUM_MONTHLY_BASE_PLAN_ID');
export const VOW_PREMIUM_YEARLY_BASE_PLAN = env('VITE_GOOGLE_PLAY_PREMIUM_YEARLY_BASE_PLAN_ID');

export function premiumCatalogueConfigured(): boolean {
  return Boolean(
    VOW_PREMIUM_MONTHLY &&
    VOW_PREMIUM_YEARLY &&
    VOW_PREMIUM_MONTHLY_BASE_PLAN &&
    VOW_PREMIUM_YEARLY_BASE_PLAN,
  );
}
