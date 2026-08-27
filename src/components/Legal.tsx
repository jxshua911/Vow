import { PageHeader } from './AppShell';

export function LegalPage({ onBack }: { onBack?: () => void }) {
  return (
    <div className="min-h-0">
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-vow-bg/95 backdrop-blur border-b border-vow-border flex items-center justify-between gap-4">
        <button onClick={onBack} className="shrink-0 min-h-11 px-3 border border-vow-border text-sm text-vow-muted hover:text-vow-ink hover:border-vow-ink transition-colors" aria-label="Back to profile">← Back</button>
        <p className="text-xs text-vow-muted truncate">Terms & Policies</p>
      </div>
      <div className="pt-6 pb-10">
        <PageHeader title="Terms & Policies" subtitle="The rules, responsibilities and privacy principles governing VOW." />
        <div className="max-w-2xl space-y-8 text-sm leading-relaxed text-vow-muted">
          <section><h2 className="text-vow-ink font-medium mb-2">1. Service</h2><p>VOW is a personal planning, accountability and evidence-organising tool. It is provided for general informational and productivity purposes and is not a substitute for professional medical, mental-health, financial, legal, educational or other professional advice.</p></section>
          <section><h2 className="text-vow-ink font-medium mb-2">2. Connected services</h2><p>When you connect a third-party service, you authorise VOW to access only the data and scopes that service permits. Third-party services remain governed by their own terms and privacy policies. VOW does not guarantee the availability, accuracy, completeness or continued operation of any third-party integration.</p></section>
          <section><h2 className="text-vow-ink font-medium mb-2">3. Evidence and verification</h2><p>VOW may classify information as self-reported, supporting evidence or verified evidence. Verification is an automated interpretation of available data and is not a guarantee that a real-world event occurred. You remain responsible for reviewing important records and decisions.</p></section>
          <section><h2 className="text-vow-ink font-medium mb-2">4. Privacy</h2><p>VOW should collect and process only information reasonably necessary to provide the features you request. Sensitive journal content should remain private to your account. Connected-service data should be scoped to the permissions you grant and should not be sold or used for unrelated advertising.</p></section>
          <section><h2 className="text-vow-ink font-medium mb-2">5. Security</h2><p>VOW will use reasonable technical and organisational safeguards, including authenticated access controls and least-privilege access where practical. No internet service can guarantee absolute security, and you should use a strong account password and protect access to your device.</p></section>
          <section><h2 className="text-vow-ink font-medium mb-2">6. Your responsibility</h2><p>You are responsible for the accuracy of information you enter, the permissions you grant, and your use of recommendations or evidence produced by VOW. Do not use VOW as the sole basis for a decision where professional or emergency assistance is required.</p></section>
          <section><h2 className="text-vow-ink font-medium mb-2">7. Disclaimer and limitation of liability</h2><p>To the maximum extent permitted by applicable law, VOW and its developers provide the service without warranties of uninterrupted availability, accuracy, fitness for a particular purpose or error-free operation. To the maximum extent permitted by law, VOW and its developers will not be liable for indirect, incidental, special, consequential or punitive losses arising from use of the service or third-party integrations. Nothing in these terms excludes liability that cannot lawfully be excluded or limited.</p></section>
          <section><h2 className="text-vow-ink font-medium mb-2">8. Changes and termination</h2><p>Features, integrations and these policies may change as VOW develops. We may suspend or discontinue features when necessary for security, legal, operational or technical reasons. Where practical, material policy changes should be communicated before they take effect.</p></section>
          <section><h2 className="text-vow-ink font-medium mb-2">9. Governing law</h2><p>The governing law, dispute-resolution process and any mandatory consumer protections will be determined by the jurisdiction applicable to the service and its users. Nothing here is intended to remove rights that cannot legally be waived.</p></section>
          <p className="border-t border-vow-border pt-5 text-xs">Last updated: 27 August 2026. This page is a product-level terms framework, not a substitute for review by a qualified lawyer before public release.</p>
        </div>
      </div>
    </div>
  );
}
