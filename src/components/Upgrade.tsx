import { useEffect, useState } from 'react';
import { Check, CreditCard, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { PageHeader } from './AppShell';

const premiumBenefits = [
  'Unlimited active goals',
  'Adaptive re-planning when your circumstances or evidence change',
  'Deeper goal-specific planning across sport, study, skills, projects and everyday goals',
  'Deeper goal resources and supporting knowledge',
  'Advanced weekly review insights',
];

const freeBenefits = [
  'Start with one active goal',
  'Get a personalised plan with milestones',
  'Track your progress and scheduled sessions',
  'Experience VOW AI planning before upgrading',
];

type Billing = 'monthly' | 'yearly';

export function UpgradePage() {
  const { session } = useAuth();
  const [activePlan, setActivePlan] = useState<'free' | 'premium'>('free');
  const [billing, setBilling] = useState<Billing>('monthly');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!session) return;
    supabase.from('vow_user_entitlements').select('plan,status').eq('user_id', session.user.id).maybeSingle().then(({ data }) => {
      if (data?.plan === 'premium' && ['active', 'trialing'].includes(data.status)) setActivePlan('premium');
    });
  }, [session]);

  async function startCheckout() {
    if (!session || loading) return;
    setLoading(true);
    setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('vow-create-checkout', { body: { billing } });
      if (error) throw error;
      if (!data?.url) throw new Error(data?.error || 'Checkout is not configured yet.');
      window.location.assign(data.url);
    } catch (error) {
      console.error('[VOW] Checkout failed:', error);
      setMessage(error instanceof Error ? error.message : 'Checkout is not ready yet.');
      setLoading(false);
    }
  }

  const isYearly = billing === 'yearly';

  return <div>
    <PageHeader title="VOW Premium" subtitle="Most apps help you track what you’re doing. VOW helps you figure out what to do next." />

    <section className="border border-vow-border bg-vow-bg rounded-2xl p-6 md:p-8 mb-8">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-vow-muted mb-3"><Sparkles className="w-3.5 h-3.5" />Premium</div>
        <h2 className="vow-heading text-2xl md:text-3xl text-vow-ink">Don’t just track the goal. Know what to do next.</h2>
        <p className="text-sm text-vow-muted mt-3 max-w-2xl leading-relaxed">VOW is built to turn an outcome into a practical route — then keep adjusting that route as real life happens. Premium gives you more room to use that planning intelligence across your goals.</p>
      </div>

      <div className="border border-vow-border rounded-xl p-4 md:p-5 mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-vow-muted mb-3">See the difference</p>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium text-vow-ink mb-3">Free · Start planning</p>
            <div className="space-y-2.5">
              {freeBenefits.map((benefit) => <div key={benefit} className="flex items-start gap-2 text-sm text-vow-muted"><Check className="w-4 h-4 mt-0.5 shrink-0 text-vow-ink" /><span>{benefit}</span></div>)}
            </div>
          </div>
          <div className="md:border-l md:border-vow-border md:pl-6">
            <p className="text-sm font-medium text-vow-ink mb-3">Premium · Let VOW plan with you</p>
            <div className="space-y-2.5">
              {premiumBenefits.map((benefit) => <div key={benefit} className="flex items-start gap-2 text-sm text-vow-ink"><Check className="w-4 h-4 mt-0.5 shrink-0" /><span>{benefit}</span></div>)}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.18em] text-vow-muted mb-3">Start with a goal like</p>
        <div className="flex flex-wrap gap-2">
          {['Run a sub-25 5K', 'Train for a football trial', 'Complete a 100 km ride', 'Learn to swim 1,500 m', 'Pass my exams', 'Build a portfolio'].map((example) => (
            <span key={example} className="text-xs px-3 py-1.5 border border-vow-border text-vow-muted">{example}</span>
          ))}
        </div>
        <p className="text-xs text-vow-muted mt-3">The wedge is sport. The system is not. The same planning engine should work wherever there is a meaningful outcome to reach.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 p-1 border border-vow-border rounded-xl mb-7" role="group" aria-label="Billing interval">
        <button type="button" onClick={() => setBilling('monthly')} className={`rounded-lg px-4 py-3 text-sm transition-colors ${billing === 'monthly' ? 'bg-vow-ink text-vow-bg' : 'text-vow-muted hover:text-vow-ink'}`} aria-pressed={billing === 'monthly'}>
          <span className="block font-medium">Monthly</span>
          <span className={`block text-xs mt-0.5 ${billing === 'monthly' ? 'opacity-80' : 'text-vow-muted'}`}>$5 / month</span>
        </button>
        <button type="button" onClick={() => setBilling('yearly')} className={`relative rounded-lg px-4 py-3 text-sm transition-colors ${billing === 'yearly' ? 'bg-vow-ink text-vow-bg' : 'text-vow-muted hover:text-vow-ink'}`} aria-pressed={billing === 'yearly'}>
          <span className="block font-medium">Yearly</span>
          <span className={`block text-xs mt-0.5 ${billing === 'yearly' ? 'opacity-80' : 'text-vow-muted'}`}>$48 / year</span>
          <span className="absolute -top-2 right-2 rounded-full border border-vow-border bg-vow-bg px-2 py-0.5 text-[10px] tracking-wide text-vow-muted">Save 20%</span>
        </button>
      </div>

      {activePlan === 'premium' ? <div className="border border-vow-border rounded-xl px-4 py-3 text-sm text-vow-ink">Premium is active on this account.</div> : <div className="space-y-3">
        <button onClick={startCheckout} disabled={loading} className="w-full vow-btn-primary justify-center disabled:opacity-60 disabled:cursor-not-allowed">{loading ? <><Loader2 className="w-4 h-4 animate-spin" />Opening secure checkout…</> : `Continue with Premium ${isYearly ? 'Yearly' : 'Monthly'}`}</button>
        <p className="text-center text-xs text-vow-muted">Secure checkout supports major cards such as Visa and Mastercard, plus Google Pay when enabled and available for the customer.</p>
        {message && <p className="text-center text-xs text-vow-muted" role="status">{message}</p>}
      </div>}
    </section>

    <div className="text-xs text-vow-muted leading-relaxed">VOW does not collect card details on this page. Checkout is handled by the payment provider.</div>
  </div>;
}
