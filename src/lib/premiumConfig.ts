const required = (name: string, value: string | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`PREMIUM_CONFIG_MISSING:${name}`);
  return trimmed;
};

export const VOW_PREMIUM_MONTHLY = required(
  'VITE_GOOGLE_PLAY_PREMIUM_MONTHLY_PRODUCT_ID',
  import.meta.env.VITE_GOOGLE_PLAY_PREMIUM_MONTHLY_PRODUCT_ID,
);

export const VOW_PREMIUM_YEARLY = required(
  'VITE_GOOGLE_PLAY_PREMIUM_YEARLY_PRODUCT_ID',
  import.meta.env.VITE_GOOGLE_PLAY_PREMIUM_YEARLY_PRODUCT_ID,
);

export const VOW_PREMIUM_MONTHLY_BASE_PLAN = required(
  'VITE_GOOGLE_PLAY_PREMIUM_MONTHLY_BASE_PLAN_ID',
  import.meta.env.VITE_GOOGLE_PLAY_PREMIUM_MONTHLY_BASE_PLAN_ID,
);

export const VOW_PREMIUM_YEARLY_BASE_PLAN = required(
  'VITE_GOOGLE_PLAY_PREMIUM_YEARLY_BASE_PLAN_ID',
  import.meta.env.VITE_GOOGLE_PLAY_PREMIUM_YEARLY_BASE_PLAN_ID,
);
