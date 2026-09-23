import { useState } from 'react';
import { ArrowLeft } from '@/lib/ui-icons';
import { PageHeader } from './AppShell';

type Policy = 'eula' | 'privacy' | 'copyright';

const CONTACT = {
  owner: 'Joshua Nathan Kasanga',
  address: '29 Upendo Street',
  legalEmail: 'vowglobalapp@gmail.com',
  supportEmail: '99joshuanathan@gmail.com',
};

const eulaSections = [
  ['1. Acceptance of these Terms', 'By creating an account, installing, accessing, or using VOW, you agree to these End User License Agreement and Terms of Use. If you do not agree, do not use VOW.'],
  ['2. Eligibility and Accounts', 'You may use VOW only where you are legally permitted to enter into these Terms. If you are under the age of legal majority in your jurisdiction, use VOW with the involvement and permission of a parent or legal guardian where required by applicable law. You are responsible for accurate account information and for protecting your credentials.'],
  ['3. The VOW Service', 'VOW is a planning, productivity, accountability, and goal-execution tool. Features may include goal clarification, domain-aware planning, AI-assisted recommendations, tasks, progress tracking, reviews, calendar connections, and Premium features. VOW does not guarantee that you will achieve a particular goal or result.'],
  ['4. Artificial Intelligence', 'VOW uses artificial intelligence to generate certain plans, recommendations, explanations, and other content. AI output can be inaccurate, incomplete, outdated, or unsuitable for your circumstances. You are responsible for reviewing AI-generated information before relying on it. VOW is not a substitute for medical, mental-health, legal, financial, educational, engineering, or other professional advice.'],
  ['5. Your Content and Goals', 'You retain ownership of content you submit to VOW, subject to the rights necessary to operate the Service. You grant VOW a limited, non-exclusive licence to host, process, reproduce, transmit, and otherwise use your content as reasonably necessary to provide, maintain, secure, improve, and operate VOW, subject to applicable law and the VOW Privacy Policy. You must have the rights necessary to submit content you provide.'],
  ['6. Acceptable Use', 'You must not use VOW to violate applicable law or another person’s rights; distribute malware; bypass security or usage controls; access another person’s account; manipulate subscription or entitlement status; reverse engineer the Service except where applicable law permits it; abuse automated systems; impersonate another person; or otherwise interfere with VOW or another user’s access.'],
  ['7. Intellectual Property', 'VOW, including its software, interface, branding, logos, methodologies, databases, documentation, and original materials, is owned by or licensed to VOW and protected by applicable intellectual-property laws. Except as expressly permitted, you may not copy, distribute, modify, sell, sublicense, reverse engineer, or commercially exploit VOW’s proprietary materials.'],
  ['8. Third-Party Services', 'VOW may rely on third-party services for authentication, cloud infrastructure, artificial intelligence, calendars, payments, subscriptions, and app distribution. Third-party services may have separate terms and privacy policies. VOW does not guarantee the availability or continued operation of third-party integrations.'],
  ['9. VOW Premium and Payments', 'VOW Premium features may require a paid subscription. Prices, billing, renewal, cancellation, and refunds are subject to the purchase terms shown at checkout and the rules of the applicable payment or app-distribution provider, including Google Play or Stripe where offered. Subscription entitlement may be verified server-side. Fraudulent attempts to obtain or manipulate Premium access are prohibited.'],
  ['10. Refunds', 'Purchases made through Google Play may be subject to Google Play’s applicable refund rules and procedures. Nothing in these Terms limits mandatory consumer rights or other rights that cannot legally be excluded.'],
  ['11. Calendar and Connected Services', 'When you connect a supported service, you authorise VOW to access the information and scopes necessary to provide the feature you request. You may revoke permissions through the relevant service or device settings where supported.'],
  ['12. Security and Availability', 'VOW uses reasonable technical and organisational safeguards intended to protect the Service. No online service can guarantee absolute security. VOW may experience outages or changes caused by maintenance, upgrades, security events, network problems, third-party failures, legal requirements, or other circumstances beyond its reasonable control.'],
  ['13. Copyright and Reports', 'VOW respects intellectual-property rights. Copyright owners may submit notices under the VOW Copyright and DMCA Policy. Users may also report inappropriate or offensive AI-generated content through reporting functionality made available in VOW where applicable.'],
  ['14. Suspension and Termination', 'You may stop using VOW at any time. VOW may suspend or terminate access where reasonably necessary because of a material breach, fraud or abuse, security risk, legal requirement, platform requirement, or need to protect VOW, its users, or third parties.'],
  ['15. Disclaimer', 'To the maximum extent permitted by applicable law, VOW is provided on an “as is” and “as available” basis. We do not guarantee uninterrupted availability, error-free operation, accuracy of AI output, suitability of every recommendation, or achievement of a particular outcome. Nothing in these Terms excludes liability that cannot lawfully be excluded.'],
  ['16. Limitation of Liability', 'To the maximum extent permitted by applicable law, VOW and its owners, officers, employees, contractors, and service providers will not be liable for indirect, incidental, consequential, special, exemplary, or punitive damages arising from use of the Service. Where liability cannot legally be excluded, it will be limited to the maximum extent permitted by applicable law.'],
  ['17. Indemnification', 'To the extent permitted by applicable law, you agree to defend, indemnify, and hold harmless VOW and its owners, officers, employees, contractors, and service providers from claims arising from your unlawful use of VOW, your violation of these Terms, infringement of another person’s rights, or content you submit to VOW.'],
  ['18. Changes to the Service or Terms', 'VOW may change features, integrations, or these Terms as the product develops or where required for security, legal, operational, or technical reasons. Material changes may be communicated through VOW or another reasonable method.'],
  ['19. Governing Law and Jurisdiction', 'These Terms are governed by and interpreted in accordance with the laws of the United Republic of Tanzania, without regard to its conflict-of-laws principles, except to the extent mandatory laws applicable to a user cannot lawfully be excluded. Subject to applicable mandatory law, disputes arising from or relating to these Terms or the Service shall be submitted to the competent courts of the United Republic of Tanzania.'],
  ['20. Contact', 'VOW is owned by Joshua Nathan Kasanga. Legal and copyright correspondence: vowglobalapp@gmail.com. General product support: 99joshuanathan@gmail.com. Mailing address: 29 Upendo Street.'],
] as const;

const privacySections = [
  ['1. Information We Collect', 'VOW may collect account information such as your email address and display name; goals, plans, milestones, sessions, reviews, journal content, preferences and other content you choose to provide; usage and app events needed to operate and secure the Service; subscription and payment-status records; and information required for connected services such as Google Calendar or Strava when you choose to connect them.'],
  ['2. How We Use Information', 'We use information to authenticate you, create and execute goal plans, provide AI-assisted features, personalise the Service, schedule notifications and calendar events, provide Premium features, prevent abuse, diagnose failures, maintain security, comply with legal obligations, and respond to support or data requests.'],
  ['3. AI Processing', 'Goal and coaching inputs may be processed by VOW AI infrastructure and third-party AI providers to generate responses and plans. VOW is designed to send the information needed for the requested feature and to avoid unnecessary sensitive information. Do not submit information you do not want processed by the Service or its providers.'],
  ['4. Connected Services', 'If you connect Google Calendar or another supported integration, VOW processes the permissions and information necessary to provide the requested feature. OAuth credentials and tokens are stored server-side and are not included in account exports. Disconnecting an integration removes VOW’s stored connection data; account deletion also attempts to revoke supported external access.'],
  ['5. Payments', 'Payment details are handled by the applicable payment provider rather than stored as raw card information by VOW. VOW may receive subscription identifiers, payment status, transaction metadata and entitlement information needed to provide Premium and prevent fraud.'],
  ['6. Sharing', 'We may share information with service providers that help operate VOW, such as cloud infrastructure, AI, authentication, calendar, payment, analytics or app-distribution providers, only as reasonably necessary for the requested Service or lawful operations. We do not sell your personal information.'],
  ['7. Retention and Deletion', 'We retain information while it is needed to operate the Service or meet legal, security or accounting obligations. You can request an account export or delete your account from VOW where those features are available. Account deletion removes the user-owned application data VOW is designed to delete and also deletes the associated authentication account after the deletion process succeeds.'],
  ['8. Security', 'VOW uses authentication controls, database access policies, server-side entitlement checks, input limits, AI usage controls and other technical safeguards. No internet service can guarantee absolute security.'],
  ['9. Your Choices and Rights', 'Depending on your jurisdiction, you may have rights to access, correct, delete, restrict or otherwise control personal information. You can update supported profile preferences, disconnect integrations, request an export, or delete your account through available VOW controls. You may also contact VOW about privacy requests.'],
  ['10. Children and Young Users', 'VOW is not intended to bypass age requirements or parental-consent requirements that apply where you live. Where applicable law requires a parent or guardian to authorise use by a minor, that requirement applies.'],
  ['11. International Processing', 'VOW and its service providers may process information in countries other than your own. Where required, applicable safeguards and contractual or legal mechanisms will be used for international transfers.'],
  ['12. Contact', 'For privacy questions or data requests, contact vowglobalapp@gmail.com. General product support is available at 99joshuanathan@gmail.com.'],
  ['13. Updates', 'This Privacy Policy may be updated when VOW changes its data practices, integrations, security controls or legal obligations. The latest version and effective date will be made available through VOW and the public privacy-policy location used for app-store compliance.'],
] as const;

const copyrightSections = [
  ['1. VOW Respects Copyright', 'VOW respects the rights of copyright owners and expects users to respect copyright and other intellectual-property rights. This policy explains how copyright owners can report material they believe infringes their rights.'],
  ['2. Copyright Contact', 'Copyright and DMCA notices may currently be sent to vowglobalapp@gmail.com. VOW may establish a dedicated copyright mailbox in the future and will update this policy if the designated contact changes.'],
  ['3. What to Include in a Copyright Notice', 'A notice should identify the copyrighted work claimed to have been infringed; identify the material claimed to be infringing and provide information reasonably sufficient for VOW to locate it; provide the claimant’s name and contact information; include a good-faith statement that the use is not authorised by the copyright owner, its agent, or applicable law; include a statement that the information is accurate and, where applicable, that the claimant is authorised to act for the copyright owner; and include a physical or electronic signature.'],
  ['4. Review and Action', 'After receiving a sufficiently complete complaint, VOW may review the report, request additional information, notify an affected user where appropriate, remove or restrict access to material, or determine that no action is required. A complaint does not by itself establish that infringement occurred.'],
  ['5. Counter-Notifications', 'Where applicable, a user whose material has been removed or restricted may submit a counter-notification explaining why the removal was mistaken or the use is authorised. A counter-notification should identify the removed material, provide the required contact information and statements, and include a physical or electronic signature. VOW may restore material where appropriate and permitted by applicable law.'],
  ['6. Repeat Infringers', 'VOW may suspend or terminate accounts belonging to users who repeatedly infringe copyright or deliberately attempt to circumvent copyright enforcement.'],
  ['7. False or Abusive Notices', 'Copyright complaints must be submitted in good faith. Knowingly submitting materially false or misleading claims may have legal consequences. VOW may take appropriate action against abusive reporting.'],
  ['8. AI-Generated Material', 'VOW may generate content using artificial intelligence. The fact that content is AI-generated does not by itself establish copyright infringement. A complaint concerning AI-generated material should identify the specific copyrighted work allegedly infringed and explain the basis for the claim.'],
  ['9. Other Intellectual Property', 'This policy addresses copyright. Trademark, patent, privacy, publicity, or other rights concerns should be directed to vowglobalapp@gmail.com with enough information for VOW to understand the issue.'],
  ['10. Policy Updates', 'VOW may update this Copyright and DMCA Policy to reflect changes in the Service, applicable law, or platform requirements.'],
] as const;

export function LegalPage({ onBack }: { onBack?: () => void }) {
  const [policy, setPolicy] = useState<Policy>('eula');
  const sections = policy === 'eula' ? eulaSections : policy === 'privacy' ? privacySections : copyrightSections;

  return (
    <div className="min-h-screen bg-vow-bg">
      <header className="sticky top-0 z-30 border-b border-vow-border bg-vow-bg/95 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-3xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-4">
          <button onClick={onBack} className="shrink-0 w-10 h-10 border border-vow-border flex items-center justify-center text-vow-muted hover:text-vow-ink hover:border-vow-ink transition-colors" aria-label="Back to profile">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium text-vow-ink truncate">Legal</p>
            <p className="text-[10px] text-vow-muted">VOW V1.4 · Terms & policies</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-10 md:py-14">
        <PageHeader title="Terms & Policies" subtitle="The rules, responsibilities and copyright procedures governing VOW." />

        <div className="mt-8 grid grid-cols-3 border border-vow-border" role="tablist" aria-label="Legal documents">
          <button
            type="button"
            role="tab"
            aria-selected={policy === 'eula'}
            onClick={() => setPolicy('eula')}
            className={`px-4 py-3 text-sm border-r border-vow-border transition-colors ${policy === 'eula' ? 'bg-vow-surface text-vow-ink' : 'text-vow-muted hover:text-vow-ink'}`}
          >
            EULA & Terms
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={policy === 'privacy'}
            onClick={() => setPolicy('privacy')}
            className={`px-4 py-3 text-sm border-r border-vow-border transition-colors ${policy === 'privacy' ? 'bg-vow-surface text-vow-ink' : 'text-vow-muted hover:text-vow-ink'}`}
          >
            Privacy
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={policy === 'copyright'}
            onClick={() => setPolicy('copyright')}
            className={`px-4 py-3 text-sm transition-colors ${policy === 'copyright' ? 'bg-vow-surface text-vow-ink' : 'text-vow-muted hover:text-vow-ink'}`}
          >
            Copyright & DMCA
          </button>
        </div>

        <section className="mt-5 border border-vow-border bg-white/20">
          <div className="px-5 py-5 sm:px-7 border-b border-vow-border">
            <p className="text-xs text-vow-muted">VOW · Owned by {CONTACT.owner}</p>
            <p className="text-xs text-vow-muted mt-1">29 Upendo Street · United Republic of Tanzania</p>
            <p className="text-xs text-vow-muted mt-1">
              <a href={`mailto:${CONTACT.legalEmail}`} className="underline underline-offset-2 hover:text-vow-ink">{CONTACT.legalEmail}</a>
              {' · '}
              <a href={`mailto:${CONTACT.supportEmail}`} className="underline underline-offset-2 hover:text-vow-ink">{CONTACT.supportEmail}</a>
            </p>
          </div>

          <div className="divide-y divide-vow-border">
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
        </section>

        <p className="mt-6 text-[11px] leading-5 text-vow-muted">
          Effective date: VOW launch date to be added. Last updated: 23 September 2026. These documents are intended as VOW’s product terms and copyright procedure and should receive qualified legal review before public launch.
        </p>
      </main>
    </div>
  );
}
