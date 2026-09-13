import { useEffect, useState } from 'react';
import { Check, CreditCard, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { PageHeader } from './AppShell';

const benefits = [
  'Unlimited active goals',
  'Deep first-class planning for every kind of goal',
  'Adaptive re-planning as new evidence appears',
  'Deeper goal resources and supporting knowledge',
  'Advanced weekly review insights',
];

export function UpgradePage() {
  const { session } = useAuth();
  const [activePlan, setActivePlan] = useState<'free' | 'premium'>('free');

  useEffect(() => {
    if (!session) return;
    supabase.from('vow_user_entitlements').select('plan,status').eq('user_id', session.user.id).maybeSingle().then(({ data }) => {
      if (data?.plan === 'premium' && ['active', 'trialing'].includes(data.status)) setActivePlan('premium');
    });
  }, [session]);

  return <div>
    <PageHeader title="VOW Premium" subtitle="More depth. More capability. The same first-class standard for every goal." />

    <section className="border border-vow-border bg-vow-bg rounded-2xl p-6 md:p-8 mb-8">
      <div className="flex items-start justify-between gap-4 mb-7">
        <div>
          <div className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-vow-muted mb-3"><Sparkles className="w-3.5 h-3.5" />Premium</div>
          <h2 className="vow-heading text-2xl text-vow-ink">Unlock the full VOW system.</h2>
          <p className="text-sm text-vow-muted mt-2 max-w-xl">Premium never changes which goals are considered important. Running, travel, cooking, study, business, hobbies and everything else receive the same first-class methodology. Premium adds more depth across the board.</p>
        </div>
        <div className="hidden sm:flex items-center justify-center w-12 h-12 border border-vow-border rounded-full text-vow-ink"><CreditCard className="w-5 h-5" /></div>
      </div>

      <div className="space-y-3 mb-8">
        {benefits.map((benefit) => <div key={benefit} className="flex items-start gap-3 text-sm text-vow-ink"><Check className="w-4 h-4 mt-0.5 shrink-0" /><span>{benefit}</span></div>)}
      </div>

      {activePlan === 'premium' ? <div className="border border-vow-border rounded-xl px-4 py-3 text-sm text-vow-ink">Premium is active on this account.</div> : <div className="space-y-3">
        <button disabled className="w-full vow-btn-primary justify-center opacity-60 cursor-not-allowed">Continue to secure checkout</button>
        <p className="text-center text-xs text-vow-muted">Google Pay and major cards such as Visa and Mastercard will be available through the secure checkout.</p>
      </div>}
    </section>

    <div className="text-xs text-vow-muted leading-relaxed">Payment processing is being wired into the production checkout separately. No card details are collected by this page.</div>
  </div>;
}
