export type VowBuildTier = 'free' | 'premium';

export const VOW_BUILD_TIER: VowBuildTier = import.meta.env.VITE_VOW_BUILD_TIER === 'premium' ? 'premium' : 'free';
export const IS_PREMIUM_BUILD = VOW_BUILD_TIER === 'premium';
