import { Check, Lock, Sparkles } from 'lucide-react';
import { PageHeader } from './AppShell';

type Billing = 'monthly' | 'yearly';

const premiumHighlights = [
  {
    title: 'Adaptive planning',
    description: 'Plans can be rebuilt when real life changes — missed sessions, new constraints, changing priorities or new evidence.',
  },
  {
    title: 'Unlimited goals',
    description: 'Use VOW across sport, study, skills, projects, travel, cooking and whatever meaningful outcome you want to reach.',
  },
  {
    title: 'Deeper AI planning',
    description: 'Go beyond a checklist. Get clearer next actions, reasoning, milestones and practical progression for your goal.',
  },
  {
    title: 'Goal-specific guidance',
    description: 'VOW adapts its planning approach to the kind of outcome you are working towards instead of treating every goal the same.',
  },
  {
    title: 'Smarter weekly reviews',
    description: 'See what is working, what is getting in the way and what your next week should look like.',
  },
  {
    title: 'More room to build',
    description: 'Keep multiple ambitions moving without reducing everything to one generic habit tracker.',
  },
];

const freeBenefits = [
  '1 active goal',
  'Personalised plan with milestones',
  'Scheduled sessions and progress tracking',
  'A real taste of VOW AI planning',
];

const premiumBenefits = [
  'Unlimited active goals',
  'Adaptive plan rebuilding',
  'Deeper AI coaching and planning',
  'Goal-specific planning methodology',
  'Advanced weekly review insights',
];

export function UpgradePage() {
  const [billing, setBilling] = React.useState<Billing>('monthly');

  const isYearly = billing === 'yearly';

  return <div>
    <PageHeader title="VOW Premium" subtitle="More than tracking. A planning system that keeps figuring out what to do next." />

    <section className="border border-vow-border bg-vow-bg rounded-2xl overflow-hidden mb-8">
      <div className="px-6 py-8 md:px-10 md:py-10 border-b border-vow-border">
        <div className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-vow-muted mb-4"><Sparkles className="w-3.5 h-3.5" />VOW Premium</div>
        <h2 className="vow-heading text-3xl md:text-5xl text-vow-ink max-w-3xl leading-tight">Let VOW plan with you.</h2>
        <p className="text-sm md:text-base text-vow-muted mt-4 max-w-2xl leading-relaxed">Premium unlocks the deeper planning layer: more goals, stronger guidance and the ability to keep adapting your plan as life happens.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3">
        {premiumHighlights.map((feature, index) => (
          <div key={feature.title} className={`p-6 md:p-7 ${index % 3 !== 2 ? 'lg:border-r' : ''} ${index < 3 ? 'lg:border-b' : ''} ${index % 2 === 0 ? 'md:border-r' : ''} border-vow-border`}>
            <div className="w-7 h-7 border border-vow-border rounded-full flex items-center justify-center mb-5 text-xs font-mono text-vow-muted">{String(index + 1).padStart(2, '0')}</div>
            <h3 className="text-sm font-medium text-vow-ink mb-2">{feature.title}</h3>
            <p className="text-sm text-vow-muted leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="border border-vow-border bg-vow-bg rounded-2xl p-6 md:p-8 mb-8">
      <div className="mb-7">
        <p className="text-xs uppercase tracking-[0.18em] text-vow-muted mb-2">Choose your plan</p>
        <h2 className="vow-heading text-2xl md:text-3xl text-vow-ink">Simple pricing. More planning power.</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="border border-vow-border rounded-xl p-5">
          <p className="text-sm font-medium text-vow-ink mb-4">Free</p>
          <div className="text-3xl font-medium text-vow-ink mb-1">$0</div>
          <p className="text-xs text-vow-muted mb-6">Start planning</p>
          <div className="space-y-2.5">
            {freeBenefits.map((benefit) => <div key={benefit} className="flex items-start gap-2 text-sm text-vow-muted"><Check className="w-4 h-4 mt-0.5 shrink-0 text-vow-ink" /><span>{benefit}</span></div>)}
          </div>
        </div>

        <div className="border border-vow-ink rounded-xl p-5 relative">
          <div className="absolute -top-3 right-4 rounded-full bg-vow-ink text-vow-bg px-3 py-1 text-[10px] tracking-[0.12em] uppercase">Premium</div>
          <p className="text-sm font-medium text-vow-ink mb-4">Premium</p>
          <div className="text-3xl font-medium text-vow-ink mb-1">{isYearly ? '$48' : '$5'}</div>
          <p className="text-xs text-vow-muted mb-6">{isYearly ? 'per year · save 20%' : 'per month'}</p>
          <div className="space-y-2.5">
            {premiumBenefits.map((benefit) => <div key={benefit} className="flex items-start gap-2 text-sm text-vow-ink"><Check className="w-4 h-4 mt-0.5 shrink-0" /><span>{benefit}</span></div>)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-1 border border-vow-border rounded-xl mb-4" role="group" aria-label="Billing interval">
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

      <div className="relative mt-5">
        <div className="absolute inset-0 z-10 bg-vow-bg/55 backdrop-blur-[1px] rounded-xl pointer-events-auto" aria-hidden="true" />
        <button type="button" disabled aria-disabled="true" className="w-full rounded-xl border border-vow-border bg-vow-ink text-vow-bg px-4 py-3.5 flex items-center justify-center gap-2 opacity-50 cursor-not-allowed">
          <Lock className="w-4 h-4" /> Premium checkout coming soon
        </button>
      </div>
      <p className="text-center text-xs text-vow-muted mt-3">Pricing is shown in USD. Payments are not enabled yet, so nobody can purchase Premium from this page.</p>
    </section>

    <section className="border-t border-vow-border pt-7">
      <p className="text-xs uppercase tracking-[0.18em] text-vow-muted mb-3">Built for real goals</p>
      <p className="text-sm text-vow-muted leading-relaxed max-w-2xl">Run a 10K. Make ravioli. Learn Spanish. Build a robot. Pass your exams. Launch an app. VOW Premium is about the planning intelligence underneath the goal — not the category itself.</p>
    </section>
  </div>;
}
