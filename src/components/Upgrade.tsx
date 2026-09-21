import { useEffect, useState } from 'react';
import { PageHeader } from './AppShell';
import { getEntitlementSnapshot, type EntitlementSnapshot } from '@/lib/entitlements';
import { openPremiumManagement, restorePremium } from '@/lib/premiumPurchases';
import { userFacingError } from '@/lib/userFacingError';

type Billing = 'monthly' | 'yearly';

const premiumBenefits = [
  'Unlimited active goals',
  'Unlimited planning actions',
  'Unlimited adaptive plan rebuilding',
  'Deeper AI coaching, planning and analysis',
  'Full goal-specific planning methodology',
  'Advanced weekly review insights',
  'Full plan history and long-term context',
];

const freeBenefits = [
  '1 active goal',
  'Personalised plan with milestones',
  'Scheduled sessions and progress tracking',
  '3 planning actions/month',
  '1 adaptive replan/month',
  '1 advanced weekly review/month',
  'Access to recently cached VOW content',
];

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return <div className="border border-vow-border rounded-xl p-4"><div className="flex justify-between gap-4 text-xs mb-2"><span className="text-vow-muted">{label}</span><span className="text-vow-ink">{used}/{limit}</span></div><div className="h-1.5 bg-vow-surface overflow-hidden"><div className="h-full bg-vow-ink transition-all" style={{ width: `${pct}%` }} /></div></div>;
}

export function UpgradePage() {
  const [billing, setBilling] = useState<Billing>('monthly');
  const [usage, setUsage] = useState<EntitlementSnapshot | null>(null);
  const [restoreState, setRestoreState] = useState('');
  const [manageState, setManageState] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const isYearly = billing === 'yearly';
  const isPremium = usage?.plan === 'premium';

  useEffect(() => { getEntitlementSnapshot().then(setUsage); }, []);

  async function handleRestore() {
    setRestoreState('');
    try {
      const result = await restorePremium();
      setRestoreState(result.restored ? 'Your Premium purchase has been restored.' : 'No active VOW Premium purchase was found.');
      if (result.restored) setUsage(await getEntitlementSnapshot());
    } catch (err) {
      setRestoreState(userFacingError(err, 'We could not restore your Premium purchase. Please try again.'));
    }
  }

  async function handleManage() {
    setManageState('');
    try {
      await openPremiumManagement();
    } catch (err) {
      setManageState(userFacingError(err, 'We could not open Google Play subscription management.'));
    }
  }

  return <div>
    <PageHeader title="VOW Premium" subtitle="More planning power, deeper guidance and room to keep meaningful goals moving." />

    <section className="border border-vow-border bg-vow-bg rounded-2xl p-6 md:p-8 mb-8">
      <p className="vow-label mb-3">Premium</p>
      <h2 className="vow-heading text-3xl md:text-4xl text-vow-ink max-w-2xl leading-tight">Let VOW plan with you.</h2>
      <p className="text-sm md:text-base text-vow-muted mt-4 max-w-2xl leading-relaxed">Premium unlocks the deeper planning layer: more goals, stronger guidance and adaptive planning as your circumstances change.</p>
      <div className="grid sm:grid-cols-2 gap-3 mt-7">
        {premiumBenefits.map((benefit) => <div key={benefit} className="flex items-start gap-3 border border-vow-border rounded-xl p-4 text-sm text-vow-ink"><span aria-hidden="true" className="shrink-0">✓</span><span>{benefit}</span></div>)}
      </div>
    </section>

    {usage && usage.plan === 'free' && <section className="border border-vow-border bg-vow-bg rounded-2xl p-6 md:p-8 mb-8">
      <p className="vow-label mb-2">Your current usage</p>
      <h2 className="vow-heading text-2xl text-vow-ink mb-5">See what Premium changes.</h2>
      <div className="grid md:grid-cols-3 gap-3">
        <UsageBar label="Planning actions this month" used={usage.planning_used} limit={usage.planning_limit ?? 3} />
        <UsageBar label="Adaptive replans" used={usage.adaptive_replans_used} limit={usage.adaptive_replans_limit ?? 1} />
        <div className="border border-vow-border rounded-xl p-4"><div className="flex justify-between gap-4 text-xs"><span className="text-vow-muted">Active goals</span><span className="text-vow-ink">{usage.active_goals}/1</span></div><p className="text-xs text-vow-muted mt-2">Premium removes the one-goal ceiling.</p></div>
      </div>
    </section>}

    <section className="border border-vow-border bg-vow-bg rounded-2xl p-6 md:p-8 mb-8">
      <p className="vow-label mb-3">Pricing</p>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="border border-vow-border rounded-xl p-5">
          <p className="text-sm font-medium text-vow-ink mb-4">Free</p>
          <div className="text-3xl font-medium text-vow-ink mb-1">$0</div>
          <p className="text-xs text-vow-muted mb-5">Start planning</p>
          <div className="space-y-2.5">{freeBenefits.map((benefit) => <div key={benefit} className="flex items-start gap-2 text-sm text-vow-muted"><span aria-hidden="true" className="text-vow-ink">✓</span><span>{benefit}</span></div>)}</div>
        </div>
        <div className="border border-vow-ink rounded-xl p-5">
          <p className="text-sm font-medium text-vow-ink mb-4">Premium</p>
          <div className="text-3xl font-medium text-vow-ink mb-1">{isYearly ? '$71.99' : '$9.99'}</div>
          <p className="text-xs text-vow-muted mb-5">{isYearly ? 'per year · save 40%' : 'per month'}</p>
          <div className="space-y-2.5">{premiumBenefits.map((benefit) => <div key={benefit} className="flex items-start gap-2 text-sm text-vow-ink"><span aria-hidden="true">✓</span><span>{benefit}</span></div>)}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-1 border border-vow-border rounded-xl" role="group" aria-label="Billing interval">
        <button type="button" onClick={() => setBilling('monthly')} className={`rounded-lg px-4 py-3 text-sm transition-colors ${billing === 'monthly' ? 'bg-vow-ink text-vow-bg' : 'text-vow-muted hover:text-vow-ink'}`} aria-pressed={billing === 'monthly'}><span className="block font-medium">Monthly</span><span className="block text-xs mt-0.5">$9.99 / month</span></button>
        <button type="button" onClick={() => setBilling('yearly')} className={`rounded-lg px-4 py-3 text-sm transition-colors ${billing === 'yearly' ? 'bg-vow-ink text-vow-bg' : 'text-vow-muted hover:text-vow-ink'}`} aria-pressed={billing === 'yearly'}><span className="block font-medium">Yearly</span><span className="block text-xs mt-0.5">$71.99 / year · save 40%</span></button>
      </div>
      {!isPremium && <div className="mt-5 border border-vow-border rounded-xl p-5">
        <p className="text-sm font-medium text-vow-ink">14-day free trial</p>
        <p className="text-xs text-vow-muted mt-1">Try Premium for 14 days. Your selected plan renews at the displayed price after the trial unless you cancel through Google Play.</p>
        <button type="button" disabled className="w-full mt-4 rounded-xl border border-vow-border bg-vow-ink text-vow-bg px-4 py-3.5 opacity-45 cursor-not-allowed">Premium checkout will be available with the Android release.</button>
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
      {manageState && <p role="alert" className="text-xs text-vow-muted mt-3">{manageState}</p>}
    </section>

    <section className="border border-vow-border bg-vow-bg rounded-2xl p-6 md:p-8 mb-8">
      <p className="vow-label mb-2">Free vs Premium</p>
      <h2 className="vow-heading text-2xl text-vow-ink mb-5">What you get at each level.</h2>
      <div className="border border-vow-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_5rem_5rem] md:grid-cols-[1fr_8rem_8rem] bg-vow-surface/30 text-xs font-medium text-vow-ink">
          <div className="p-3">Feature</div><div className="p-3 text-center">Free</div><div className="p-3 text-center">Premium</div>
        </div>
        {[
          ['Active goals', '1 active', 'Unlimited'],
          ['AI planning actions', '3 / month', 'Unlimited'],
          ['Adaptive replanning', '1 / month', 'Unlimited'],
          ['Advanced weekly reviews', '1 / month', 'Unlimited'],
          ['Goal-specific methodology', 'Core', 'Full'],
          ['Scheduled sessions & tracking', '✓', '✓'],
          ['Journal & calendar', '✓', '✓'],
          ['Full plan history', 'Limited', '✓'],
          ['Deep AI analysis', '—', '✓'],
          ['Recently available saved content', 'Limited', 'Expanded'],
        ].map(([feature, free, premium]) => <div key={feature} className="grid grid-cols-[1fr_5rem_5rem] md:grid-cols-[1fr_8rem_8rem] border-t border-vow-border text-xs">
          <div className="p-3 text-vow-muted">{feature}</div><div className="p-3 text-center text-vow-ink">{free}</div><div className="p-3 text-center text-vow-ink">{premium}</div>
        </div>)}
      </div>
      <p className="text-xs text-vow-muted mt-4">VOW keeps your recent saved content available when you have a connection gap. AI planning, cloud updates and Google-connected features resume when you are back online.</p>
    </section>

    <section className="border-t border-vow-border pt-7"><p className="text-xs uppercase tracking-[0.18em] text-vow-muted mb-3">Built for real goals</p><p className="text-sm text-vow-muted leading-relaxed max-w-2xl">Run a 10K. Make ravioli. Learn Spanish. Build a robot. Pass your exams. Launch an app. VOW Premium is about the planning intelligence underneath the goal — not the category itself.</p></section>

    {confirmCancel && <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-premium-title">
      <div className="bg-vow-bg border border-vow-border p-6 max-w-sm w-full rounded-xl">
        <h2 id="cancel-premium-title" className="vow-heading text-xl text-vow-ink mb-2">Are you sure you want to cancel Premium?</h2>
        <p className="text-sm text-vow-muted leading-relaxed mb-6">Google Play will handle the cancellation. You can keep your Premium access for the current billing period, subject to Google Play's subscription rules.</p>
        <div className="flex gap-3"><button type="button" onClick={() => setConfirmCancel(false)} className="vow-btn-ghost flex-1">Keep Premium</button><button type="button" onClick={() => { setConfirmCancel(false); void handleManage(); }} className="vow-btn-primary flex-1">Continue to Google Play</button></div>
      </div>
    </div>}
  </div>;
}
