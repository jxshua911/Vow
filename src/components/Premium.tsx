import { PageHeader } from './AppShell';

const premiumFeatures = [
  'Enhanced VOW planning and personalisation',
  'Deeper progress and review insights',
  'Priority access to future premium capabilities',
];

export function PremiumPage() {
  return (
    <div className="min-w-0">
      <PageHeader
        title="VOW Premium"
        subtitle="A deeper layer of VOW for people who want more from their commitments."
      />

      <div className="max-w-2xl space-y-6">
        <section className="border border-vow-border p-6 md:p-8">
          <div className="flex items-start justify-between gap-6 mb-8">
            <div>
              <p className="vow-label mb-2">Premium</p>
              <h2 className="vow-heading text-2xl text-vow-ink">Built for the next level.</h2>
              <p className="text-sm text-vow-muted leading-relaxed mt-3 max-w-lg">
                VOW Premium is being prepared. This screen is already part of the app, but subscriptions and payments are not active yet.
              </p>
            </div>
            <div className="shrink-0 w-11 h-11 border border-vow-border flex items-center justify-center text-vow-ink" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                <path d="m12 3 2.7 5.47L21 9.39l-4.5 4.39 1.06 6.2L12 17.06 6.44 20l1.06-6.22L3 9.4l6.3-.92L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className="border-t border-vow-border pt-6 space-y-4">
            {premiumFeatures.map((feature) => (
              <div key={feature} className="flex items-start gap-3 text-sm text-vow-ink">
                <span className="mt-0.5 text-vow-ink" aria-hidden="true">✓</span>
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-vow-border mt-8 pt-6">
            <button type="button" disabled className="vow-btn-primary w-full opacity-50 cursor-not-allowed" aria-disabled="true">
              Premium coming soon
            </button>
            <p className="text-[11px] text-vow-muted text-center mt-3">
              No payment is taken from this screen.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
