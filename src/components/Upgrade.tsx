import { useEffect, useState } from 'react';
import { Check, CreditCard, Loader2, Sparkles } from 'lucide-react';
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
      const { data, error } = await supabase.functions.invoke('vow-create-checkout', { body: {} });
      if (error) throw error;
      if (!data?.url) throw new Error(data?.error || 'Checkout is not configured yet.');
      window.location.assign(data.url);
    } catch (error) {
      console.error('[VOW] Checkout failed:', error);
      setMessage(error instanceof Error ? error.message : 'Checkout is not ready yet.');
      setLoading(false);
    }
  }

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
        <button onClick={startCheckout} disabled={loading} className="w-full vow-btn-primary justify-center disabled:opacity-60 disabled:cursor-not-allowed">{loading ? <><Loader2 className="w-4 h-4 animate-spin" />Opening secure checkout…</> : 'Continue to secure checkout'}</button>
        <p className="text-center text-xs text-vow-muted">Google Pay and major cards such as Visa and Mastercard will be available through the secure checkout when enabled for the account.</p>
        {message && <p className="text-center text-xs text-vow-muted" role="status">{message}</p>}
      </div>}
    </section>

    <div className="text-xs text-vow-muted leading-relaxed">VOW does not collect card details on this page. Checkout is handled by the payment provider.</div>
  </div>;
}
