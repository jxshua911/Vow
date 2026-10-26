import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PageHeader } from './AppShell';
import { getEntitlementSnapshot, refreshEntitlementSnapshot, type EntitlementSnapshot } from '@/lib/entitlements';
import { getPremiumProducts, openPremiumManagement, purchasePremium, restorePremium } from '@/lib/premiumPurchases';
import { VOW_PREMIUM_MONTHLY } from '@/lib/premiumConfig';
import { userFacingError } from '@/lib/userFacingError';
import { supabase } from '@/lib/supabase';



const premiumBenefits = [
  'Unlimited active goals',
  'Unlimited planning actions',
  'Unlimited adaptive plan rebuilding',
  'Deeper AI coaching and planning',
  'Goal-specific planning methodology',
  'Advanced weekly review insights',
  'Full plan history',
];

export function UpgradePage() {
  const [usage, setUsage] = useState<EntitlementSnapshot | null>(null);
  const [restoreState, setRestoreState] = useState('');
  const [manageState, setManageState] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [purchaseState, setPurchaseState] = useState('');
  const [products, setProducts] = useState<Array<{ identifier: string; price: number; priceString: string }>>([]);
  const monthlyProduct = products.find((product) => product.identifier === VOW_PREMIUM_MONTHLY);
  // Approved launch pricing; Google Play's localized catalogue price takes over when available.
  const isPremium = usage?.plan === 'premium';
  const selectedProduct = monthlyProduct;

  useEffect(() => {
    let active = true;
    const refreshUsage = () => {
      void getEntitlementSnapshot().then((snapshot) => {
        if (active) setUsage(snapshot);
      });
    };
    refreshUsage();
    const onEntitlementChanged = (event: Event) => {
      const snapshot = (event as CustomEvent<EntitlementSnapshot | null>).detail;
      if (snapshot) setUsage(snapshot);
      else refreshUsage();
    };
    window.addEventListener('vow:entitlement-changed', onEntitlementChanged);
    window.addEventListener('focus', refreshUsage);
    window.addEventListener('online', refreshUsage);
    void getPremiumProducts().then((result) => {
      if (!active) return;
      setProducts((result.products || []).map((product) => ({
        identifier: product.identifier,
        price: Number(product.price || 0),
        priceString: product.priceString || '',
      })));
    }).catch(() => { if (active) setProducts([]); });
    return () => {
      active = false;
      window.removeEventListener('vow:entitlement-changed', onEntitlementChanged);
      window.removeEventListener('focus', refreshUsage);
      window.removeEventListener('online', refreshUsage);
    };
  }, []);

  async function handleRestore() {
    setRestoreState('');
    if (!Capacitor.isNativePlatform()) {
      setRestoreState('Google Play restore is available in VOW for Android. Premium access already linked to your VOW account is checked automatically.');
      return;
    }
    try {
      const result = await restorePremium();
      if (!result.restored) {
        setRestoreState('No Google Play purchase was found.');
        return;
      }
      const snapshot = await refreshEntitlementSnapshot();
      setUsage(snapshot);
      setRestoreState(snapshot?.plan === 'premium'
        ? 'Your Google Play Premium purchase has been restored.'
        : 'Google Play verified the purchase, but VOW has not confirmed Premium access yet. Your account has not been charged again; refresh your account status or contact support before trying another purchase.');
    } catch (err) {
      setRestoreState(userFacingError(err, 'We could not restore your Premium purchase. Please try again.'));
    }
  }

  async function handlePurchase() {
    setPurchaseState('');
    if (!Capacitor.isNativePlatform()) {
      try {
        const { data, error } = await supabase.functions.invoke('vow-create-checkout', {
          body: { billing: 'monthly' },
        });
        if (error) throw error;
        if (typeof data?.url !== 'string') throw new Error('Stripe checkout did not return a secure payment URL.');
        const checkoutUrl = new URL(data.url);
        if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.stripe.com') {
          throw new Error('Stripe returned an unexpected checkout address.');
        }
        window.location.assign(checkoutUrl.toString());
      } catch (err) {
        setPurchaseState(userFacingError(err, 'We could not start secure checkout. Please try again.'));
      }
      return;
    }
    try {
      await purchasePremium(VOW_PREMIUM_MONTHLY);
      const snapshot = await refreshEntitlementSnapshot();
      setUsage(snapshot);
      setPurchaseState(snapshot?.plan === 'premium'
        ? 'Premium is now active.'
        : 'The purchase was verified, but VOW has not confirmed Premium access yet. Your account has not been charged again; refresh your account status or contact support before trying another purchase.');
    } catch (err) {
      setPurchaseState(userFacingError(err, 'We could not complete the Premium purchase. Please try again.'));
    }
  }

  async function handleManage() {
    setManageState('');
    if (!Capacitor.isNativePlatform()) {
      setManageState('Manage or cancel your subscription through the store where you purchased it. Google Play subscription management is available in VOW for Android. Removing VOW does not cancel a subscription.');
      return;
    }
    try {
      await openPremiumManagement();
    } catch (err) {
      setManageState(userFacingError(err, 'We could not open Google Play subscription management.'));
    }
  }

  if (!usage) {
    return <div>
      <PageHeader title="VOW Premium" subtitle="Checking your account status…" />
      <section className="border border-vow-border bg-vow-bg rounded-2xl p-6 md:p-8" role="status">
        <p className="text-sm text-vow-muted">Confirming your Premium entitlement…</p>
      </section>
    </div>;
  }

  if (isPremium) {
    return <div>
      <PageHeader title="VOW Premium" subtitle="Your full planning experience is ready." />
      <section className="border border-vow-border bg-vow-bg rounded-2xl p-6 md:p-8 mb-6 animate-in fade-in duration-500">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 shrink-0 rounded-full border border-vow-border flex items-center justify-center text-2xl" aria-hidden="true">✓</div>
          <div>
            <p className="vow-label mb-2">Congratulations!</p>
            <h2 className="vow-heading text-2xl md:text-3xl text-vow-ink mb-3">Welcome to VOW Premium.</h2>
            <p className="text-sm text-vow-muted leading-relaxed">Your Premium access is active. You’re all set to plan bigger, adapt as life changes, and keep making progress without the free-plan limits.</p>
            <p className="inline-flex items-center gap-2 mt-4 border border-vow-border rounded-full px-3 py-1.5 text-xs text-vow-ink"><span aria-hidden="true">✦</span> Premium · Active</p>
          </div>
        </div>
      </section>
      <section className="border border-vow-border bg-vow-bg rounded-2xl p-5 md:p-6 mb-6">
        <h2 className="vow-heading text-xl text-vow-ink mb-4">Your Premium benefits</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {premiumBenefits.map((benefit) => <div key={benefit} className="flex items-start gap-2 text-sm text-vow-ink"><span aria-hidden="true">✓</span><span>{benefit}</span></div>)}
        </div>
      </section>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('vow:navigate', { detail: 'dashboard' }))} className="vow-btn-primary">Go to your dashboard →</button>
        <button type="button" onClick={() => void handleManage()} className="vow-btn-soft">Manage subscription</button>
        <button type="button" onClick={() => void handleRestore()} className="vow-btn-ghost">Restore purchase</button>
      </div>
      <p className="text-xs text-vow-muted mt-3">To cancel a Google Play subscription, open subscription management and cancel it there. Removing VOW from your device does not cancel a subscription.</p>
      <p className="text-xs text-vow-muted mt-2">Restore checks purchases made through Google Play. Premium granted directly to your VOW account can be active here without appearing in Play Store subscriptions.</p>
      {manageState && <p role="status" className="text-xs text-vow-muted mt-3">{manageState}</p>}
      {restoreState && <p role="status" className="text-xs text-vow-muted mt-3">{restoreState}</p>}
    </div>;
  }

  return <div>
    <PageHeader title="VOW" subtitle="More planning power, deeper guidance and room to keep meaningful goals moving." />

    <section className="border border-vow-border bg-vow-bg rounded-2xl p-6 md:p-8 mb-8">
      <p className="vow-label mb-3">Pricing</p>
      <div className="grid grid-cols-1 gap-4 mb-6">
        <div className="relative border border-vow-ink rounded-xl p-5 pt-8">
          <p className="text-sm font-medium text-vow-ink mb-4">Premium</p>
          <div className="text-3xl font-medium text-vow-ink mb-1">{monthlyProduct?.priceString || '$4.99'}</div>
          <p className="text-xs text-vow-muted mb-5">per month</p>
          <div className="space-y-2.5">{premiumBenefits.map((benefit) => <div key={benefit} className="flex items-start gap-2 text-sm text-vow-muted"><span aria-hidden="true" className="text-vow-ink">✓</span><span>{benefit}</span></div>)}</div>
        </div>
      </div>
      {!isPremium && <div className="mt-5 border border-vow-border rounded-xl p-5">
        <p className="text-sm font-medium text-vow-ink">Premium checkout</p>
        {Capacitor.isNativePlatform()
          ? <><p className="text-xs text-vow-muted mt-1">Pricing is loaded from Google Play. Your subscription renews automatically for the monthly billing period unless you cancel in Google Play.</p><button type="button" onClick={() => void handlePurchase()} disabled={!selectedProduct} className="vow-btn-primary w-full mt-4 disabled:opacity-45">{selectedProduct ? `Continue with ${selectedProduct.priceString}` : 'Waiting for Google Play pricing…'}</button></>
          : <><p className="text-xs text-vow-muted mt-1">Continue to Stripe’s secure checkout to start your monthly Premium subscription.</p><button type="button" onClick={() => void handlePurchase()} className="vow-btn-primary w-full mt-4">Continue to secure Stripe checkout</button></>}
      </div>}
      {isPremium && <div className="mt-5 border border-vow-border rounded-xl p-5">
        <p className="text-sm font-medium text-vow-ink">Premium is active</p>
        <p className="text-xs text-vow-muted mt-1">Manage or cancel your subscription through Google Play.</p>
        <button type="button" onClick={() => setConfirmCancel(true)} className="vow-btn-ghost mt-4">Manage or cancel subscription</button>
      </div>}
      <div className="flex flex-col sm:flex-row gap-3 mt-4">
        <button type="button" onClick={handleRestore} className="vow-btn-soft">Restore purchase</button>
      </div>
      {restoreState && <p role="status" className="text-xs text-vow-muted mt-3">{restoreState}</p>}
      {purchaseState && <p role="status" className="text-xs text-vow-muted mt-3">{purchaseState}</p>}
      {manageState && <p role="alert" className="text-xs text-vow-muted mt-3">{manageState}</p>}
    </section>

    <section className="border-t border-vow-border pt-7"><p className="text-xs uppercase tracking-[0.18em] text-vow-muted mb-3">Built for real goals</p><p className="text-sm text-vow-muted leading-relaxed max-w-2xl">Run a 10K. Make ravioli. Learn Spanish. Build a robot. Pass your exams. Launch an app. VOW is about the planning intelligence underneath the goal — not the category itself.</p></section>

    {confirmCancel && <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-premium-title">
      <div className="bg-vow-bg border border-vow-border p-6 max-w-sm w-full rounded-xl">
        <h2 id="cancel-premium-title" className="vow-heading text-xl text-vow-ink mb-2">Are you sure you want to cancel Premium?</h2>
        <p className="text-sm text-vow-muted leading-relaxed mb-6">Google Play will handle the cancellation. You can keep your Premium access for the current billing period, subject to Google Play's subscription rules.</p>
        <div className="flex gap-3"><button type="button" onClick={() => setConfirmCancel(false)} className="vow-btn-ghost flex-1">Keep Premium</button><button type="button" onClick={() => { setConfirmCancel(false); void handleManage(); }} className="vow-btn-primary flex-1">Continue to Google Play</button></div>
      </div>
    </div>}
  </div>;
}
