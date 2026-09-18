import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { supabase } from './supabase';

export const VOW_PREMIUM_MONTHLY = 'com.vow.app.premium.monthly';
export const VOW_PREMIUM_YEARLY = 'com.vow.app.premium.yearly';

async function accountToken(userId: string) {
  const bytes = new TextEncoder().encode(userId);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getPremiumProducts() {
  return NativePurchases.getProducts({
    productIdentifiers: [VOW_PREMIUM_MONTHLY, VOW_PREMIUM_YEARLY],
    productType: PURCHASE_TYPE.SUBS,
  });
}

export async function purchasePremium(
  productId: typeof VOW_PREMIUM_MONTHLY | typeof VOW_PREMIUM_YEARLY,
) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('UNAUTHORIZED');

  const appAccountToken = await accountToken(user.id);
  const planIdentifier =
    productId === VOW_PREMIUM_MONTHLY ? 'monthly' : 'yearly';

  const transaction = await NativePurchases.purchaseProduct({
    productIdentifier: productId,
    planIdentifier,
    productType: PURCHASE_TYPE.SUBS,
    appAccountToken,
    autoAcknowledgePurchases: false,
  });

  if (!transaction.purchaseToken) throw new Error('PURCHASE_TOKEN_MISSING');

  const { data, error: verifyError } = await supabase.functions.invoke(
    'vow-google-play-verify',
    {
      body: {
        purchaseToken: transaction.purchaseToken,
        productId,
        billingPeriod: productId === VOW_PREMIUM_MONTHLY ? 'monthly' : 'yearly',
      },
    },
  );

  if (verifyError || !data?.ok) {
    throw new Error(data?.error ?? verifyError?.message ?? 'PURCHASE_VERIFICATION_FAILED');
  }

  await NativePurchases.acknowledgePurchase({
    purchaseToken: transaction.purchaseToken,
  });

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
