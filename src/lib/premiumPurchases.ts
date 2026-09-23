import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { supabase } from './supabase';
import {
  VOW_PREMIUM_MONTHLY,
  VOW_PREMIUM_MONTHLY_BASE_PLAN,
  VOW_PREMIUM_YEARLY,
  VOW_PREMIUM_YEARLY_BASE_PLAN,
} from './premiumConfig';

async function accountToken(userId: string) {
  const bytes = new TextEncoder().encode(userId);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export { VOW_PREMIUM_MONTHLY, VOW_PREMIUM_YEARLY };

export async function getPremiumProducts() {
  if (!VOW_PREMIUM_MONTHLY || !VOW_PREMIUM_YEARLY) return { products: [] };
  return NativePurchases.getProducts({
    productIdentifiers: [VOW_PREMIUM_MONTHLY, VOW_PREMIUM_YEARLY],
    productType: PURCHASE_TYPE.SUBS,
  });
}

export async function purchasePremium(
  productId: typeof VOW_PREMIUM_MONTHLY | typeof VOW_PREMIUM_YEARLY,
) {
  if (!productId) throw new Error('PREMIUM_NOT_CONFIGURED');
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('UNAUTHORIZED');

  const appAccountToken = await accountToken(user.id);
  const planIdentifier =
    productId === VOW_PREMIUM_MONTHLY
      ? VOW_PREMIUM_MONTHLY_BASE_PLAN
      : VOW_PREMIUM_YEARLY_BASE_PLAN;
  if (!planIdentifier) throw new Error('PREMIUM_NOT_CONFIGURED');

  const transaction = await NativePurchases.purchaseProduct({
    productIdentifier: productId,
    planIdentifier,
    productType: PURCHASE_TYPE.SUBS,
    appAccountToken,
    autoAcknowledgePurchases: false,
  });

  if (!transaction.purchaseToken) throw new Error('PURCHASE_TOKEN_MISSING');

  const billingPeriod = productId === VOW_PREMIUM_MONTHLY ? 'monthly' : 'yearly';
  const { data, error: verifyError } = await supabase.functions.invoke(
    'vow-google-play-verify',
    {
      body: {
        purchaseToken: transaction.purchaseToken,
        productId,
        billingPeriod,
      },
    },
  );

  if (verifyError || !data?.ok) {
    throw new Error(data?.error ?? verifyError?.message ?? 'PURCHASE_VERIFICATION_FAILED');
  }

  // Backend verification and acknowledgement are authoritative on Android.
  return data;
}

export async function restorePremium() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('UNAUTHORIZED');

  const appAccountToken = await accountToken(user.id);
  await NativePurchases.restorePurchases();

  const { purchases } = await NativePurchases.getPurchases({
    productType: PURCHASE_TYPE.SUBS,
    appAccountToken,
    onlyCurrentEntitlements: true,
  });

  const purchase = purchases.find(
    (item) =>
      item.purchaseToken &&
      (item.productIdentifier === VOW_PREMIUM_MONTHLY ||
        item.productIdentifier === VOW_PREMIUM_YEARLY),
  );

  if (!purchase?.purchaseToken) return { ok: true, restored: false };

  const billingPeriod =
    purchase.productIdentifier === VOW_PREMIUM_MONTHLY ? 'monthly' : 'yearly';

  const { data, error: verifyError } = await supabase.functions.invoke(
    'vow-google-play-verify',
    {
      body: {
        purchaseToken: purchase.purchaseToken,
        productId: purchase.productIdentifier,
        billingPeriod,
      },
    },
  );

  if (verifyError || !data?.ok) {
    throw new Error(data?.error ?? verifyError?.message ?? 'PURCHASE_VERIFICATION_FAILED');
  }

  return { ...data, restored: true };
}

export async function openPremiumManagement() {
  await NativePurchases.manageSubscriptions();
}
