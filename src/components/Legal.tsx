import { ArrowLeft } from 'lucide-react';
import { PageHeader } from './AppShell';

const sections = [
  ['1. Service', 'VOW is a personal planning, accountability and evidence-organising tool. It is provided for general informational and productivity purposes and is not a substitute for professional medical, mental-health, financial, legal, educational or other professional advice.'],
  ['2. Connected services', 'When you connect a third-party service, you authorise VOW to access only the data and scopes that service permits. Third-party services remain governed by their own terms and privacy policies. VOW does not guarantee the availability, accuracy, completeness or continued operation of any third-party integration.'],
  ['3. Evidence and verification', 'VOW may classify information as self-reported, supporting evidence or verified evidence. Verification is an automated interpretation of available data and is not a guarantee that a real-world event occurred. You remain responsible for reviewing important records and decisions.'],
  ['4. Privacy', 'VOW should collect and process only information reasonably necessary to provide the features you request. Sensitive journal content should remain private to your account. Connected-service data should be scoped to the permissions you grant and should not be sold or used for unrelated advertising.'],
  ['5. Security', 'VOW will use reasonable technical and organisational safeguards, including authenticated access controls and least-privilege access where practical. No internet service can guarantee absolute security, and you should use a strong account password and protect access to your device.'],
  ['6. Your responsibility', 'You are responsible for the accuracy of information you enter, the permissions you grant, and your use of recommendations or evidence produced by VOW. Do not use VOW as the sole basis for a decision where professional or emergency assistance is required.'],
  ['7. Disclaimer and limitation of liability', 'To the maximum extent permitted by applicable law, VOW and its developers provide the service without warranties of uninterrupted availability, accuracy, fitness for a particular purpose or error-free operation. Nothing in these terms excludes liability that cannot lawfully be excluded or limited.'],
  ['8. Changes and termination', 'Features, integrations and these policies may change as VOW develops. We may suspend or discontinue features when necessary for security, legal, operational or technical reasons. Where practical, material policy changes should be communicated before they take effect.'],
  ['9. Governing law', 'The governing law, dispute-resolution process and any mandatory consumer protections will be determined by the jurisdiction applicable to the service and its users. Nothing here is intended to remove rights that cannot legally be waived.'],
] as const;

export function LegalPage({ onBack }: { onBack?: () => void }) {
  return (
    <div className="min-h-screen bg-vow-bg">
      <div className="sticky top-0 z-30 bg-vow-bg/95 backdrop-blur border-b border-vow-border" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-3 flex items-center gap-3">
          <button onClick={onBack} className="shrink-0 min-h-11 min-w-11 border border-vow-border flex items-center justify-center text-vow-muted hover:text-vow-ink hover:border-vow-ink transition-colors" aria-label="Back to profile"><ArrowLeft className="w-4 h-4" /></button>
          <div className="min-w-0"><p className="text-sm font-medium text-vow-ink">Terms & Policies</p><p className="text-[10px] text-vow-muted">VOW · Product policies</p></div>
        </div>
      </div>
      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-8 md:py-12">
        <PageHeader title="Terms & Policies" subtitle="The rules, responsibilities and privacy principles governing VOW." />
        <div className="max-w-3xl">
          <div className="border border-vow-border p-5 mb-8 flex items-start gap-4 bg-white/30">
            <div className="w-10 h-10 border border-vow-border flex items-center justify-center shrink-0"><span className="text-sm font-semibold text-vow-ink" aria-hidden="true">✓</span></div>
            <div><p className="text-sm font-medium text-vow-ink">A clear, readable policy</p><p className="text-xs text-vow-muted mt-1 leading-relaxed">These policies explain how VOW works, what connected services mean, and what responsibility remains with you.</p></div>
          </div>
          <div className="border-t border-vow-border">
            {sections.map(([title, body]) => <section key={title} className="py-6 border-b border-vow-border"><h2 className="text-sm font-medium text-vow-ink mb-2">{title}</h2><p className="text-sm leading-7 text-vow-muted">{body}</p></section>)}
          </div>
          <p className="pt-6 text-xs leading-relaxed text-vow-muted">Last updated: 27 August 2026. This page is a product-level terms framework, not a substitute for review by a qualified lawyer before public release.</p>
        </div>
      </main>
    </div>
  );
}
