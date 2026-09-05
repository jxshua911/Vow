import { PageHeader } from './AppShell';

function Glyph({ children, className = '' }: { children: string; className?: string }) { return <span aria-hidden="true" className={`inline-flex items-center justify-center font-medium leading-none ${className}`}>{children}</span>; }

const sections = [
  ['1. Service and scope', 'VOW is a personal planning, accountability, progress-tracking and evidence-organising product. It provides general informational and productivity assistance only. VOW is not a medical, mental-health, financial, legal, educational, coaching or emergency service and its recommendations are not professional advice.'],
  ['2. Eligibility and accounts', 'You may use VOW only if you are legally permitted to do so in your jurisdiction and meet any applicable minimum-age requirements. Where parental or guardian consent is legally required, that consent must be obtained before use. You are responsible for keeping your account credentials secure and for activity carried out through your account.'],
  ['3. AI-generated plans and recommendations', 'VOW may use automated systems and AI to interpret goals, organise information, generate plans, suggest activities, summarise progress and provide recommendations. These outputs can be incomplete, outdated, unsuitable or wrong. You must review important recommendations before acting on them, especially where safety, health, money, education, travel or other significant consequences are involved.'],
  ['4. Health, fitness and safety', 'Fitness, nutrition, wellbeing and other physically demanding recommendations are general information only. VOW does not assess whether an activity is safe for your individual circumstances. Stop an activity if it feels unsafe and seek appropriate qualified or emergency assistance when needed. VOW must never be treated as a substitute for urgent or professional care.'],
  ['5. Evidence and verification', 'VOW may classify information as self-reported, supporting evidence or verified evidence. Verification is an automated interpretation of available data and does not guarantee that a real-world event occurred, that information is accurate, or that a source is trustworthy. You remain responsible for reviewing important records and decisions.'],
  ['6. Your content and privacy', 'You retain responsibility for information, journal entries, goals and other content you provide. VOW should collect and process information only as reasonably necessary to provide requested features. Private journal content should remain private to your account unless you explicitly choose to share it or disclosure is required by law. Do not submit information that you do not have the right to provide.'],
  ['7. Connected services and third parties', 'When you connect a third-party service, you authorise VOW to use the access and scopes that service permits for the requested feature. Third-party services remain governed by their own terms and privacy policies. VOW does not control third-party availability, security, accuracy, content or continued operation.'],
  ['8. Security and availability', 'VOW will use reasonable technical and organisational safeguards appropriate to the service, including authenticated access controls and least-privilege access where practical. No online service can guarantee absolute security or uninterrupted availability. You should protect your device, credentials and connected accounts.'],
  ['9. Acceptable use', 'You must not misuse VOW, attempt to bypass access controls, interfere with the service, probe or attack its infrastructure, impersonate another person, upload unlawful or malicious material, or use the service to facilitate harmful or unlawful activity. Features may be limited, suspended or removed when necessary for security, legal or operational reasons.'],
  ['10. Responsibility for decisions', 'You are responsible for the accuracy of information you enter, the permissions you grant, and decisions you make using VOW outputs. Do not rely on VOW as the sole basis for decisions where professional judgement, emergency assistance or independent verification is appropriate.'],
  ['11. Disclaimer and limitation of liability', 'To the maximum extent permitted by applicable law, VOW and its developers provide the service without warranties of uninterrupted availability, accuracy, completeness, fitness for a particular purpose or error-free operation. To the extent permitted by law, VOW is not liable for indirect, incidental, consequential or special losses arising from use of the service. Nothing in these terms excludes or limits liability that cannot lawfully be excluded or limited.'],
  ['12. Changes, suspension and termination', 'VOW may change, suspend or discontinue features, integrations or parts of the service for security, legal, operational or technical reasons. These terms may also be updated as the product develops. Where practical, material policy changes should be communicated before they take effect. Continued use after an effective update constitutes acceptance where legally permitted.'],
  ['13. Governing law', 'The governing law, dispute-resolution process and mandatory consumer protections applicable to VOW will depend on the jurisdiction governing the service and the user. Nothing in these terms is intended to remove rights or protections that cannot legally be waived.'],
  ['14. Contact and policy review', 'These product-level terms are intended to establish clear expectations for use of VOW. Before a public commercial launch, the operator should have the final terms, privacy notice, age requirements, data-processing disclosures and jurisdiction-specific provisions reviewed by a qualified lawyer.'],
] as const;

export function LegalPage({ onBack }: { onBack?: () => void }) {
  return (
    <div className="min-h-screen bg-vow-bg">
      <header className="sticky top-0 z-30 border-b border-vow-border bg-vow-bg/95 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-3xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-4">
          <button onClick={onBack} className="shrink-0 w-10 h-10 border border-vow-border flex items-center justify-center text-vow-muted hover:text-vow-ink hover:border-vow-ink transition-colors" aria-label="Back to profile">
            <Glyph>←</Glyph>
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium text-vow-ink truncate">Terms & Policies</p>
            <p className="text-[10px] text-vow-muted">VOW · Product policies</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-10 md:py-14">
        <PageHeader title="Terms & Policies" subtitle="The rules, responsibilities, safety boundaries and privacy principles governing VOW." />
        <div className="mt-8 border border-vow-border divide-y divide-vow-border bg-white/20">
          {sections.map(([title, body], index) => (
            <section key={title} className="px-5 py-6 sm:px-7 sm:py-7">
              <div className="flex gap-4">
                <span className="shrink-0 pt-0.5 text-[10px] font-mono text-vow-muted">{String(index + 1).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <h2 className="text-sm font-medium text-vow-ink mb-2">{title.replace(/^\d+\. /, '')}</h2>
                  <p className="text-sm leading-7 text-vow-muted">{body}</p>
                </div>
              </div>
            </section>
          ))}
        </div>
        <p className="mt-6 text-[11px] leading-5 text-vow-muted">Last updated: 5 September 2026. This is a product-level terms framework and should be reviewed by a qualified lawyer before public commercial release.</p>
      </main>
    </div>
  );
}
