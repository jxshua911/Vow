import { Browser } from '@capacitor/browser';
import { ArrowLeft } from '@/lib/ui-icons';
import { PageHeader } from './AppShell';

const LEGAL_URLS = {
  terms: 'https://vowglobal.lovable.app/terms',
  privacy: 'https://vowglobal.lovable.app/privacy-policy',
  copyright: 'https://vowglobal.lovable.app/copyright',
} as const;

export function LegalPage({ onBack }: { onBack?: () => void }) {
  async function open(url: string) {
    await Browser.open({ url });
  }

  return (
    <div className="min-h-screen bg-vow-bg">
      <header className="sticky top-0 z-30 border-b border-vow-border bg-vow-bg/95 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-3xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-4">
          <button onClick={onBack} className="shrink-0 w-10 h-10 border border-vow-border flex items-center justify-center text-vow-muted hover:text-vow-ink hover:border-vow-ink transition-colors" aria-label="Back">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium text-vow-ink truncate">Legal</p>
            <p className="text-[10px] text-vow-muted">VOW · Terms & policies</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-10 md:py-14">
        <PageHeader title="Terms & Policies" subtitle="VOW's current legal documents are maintained on the official VOW website." />

        <section className="mt-8 border border-vow-border divide-y divide-vow-border">
          <button type="button" onClick={() => open(LEGAL_URLS.terms)} className="w-full text-left px-5 py-6 sm:px-7 sm:py-7 hover:bg-vow-surface/50 transition-colors">
            <p className="text-xs text-vow-muted">01</p>
            <h2 className="mt-2 text-base font-medium text-vow-ink">Terms / EULA</h2>
            <p className="mt-2 text-sm leading-6 text-vow-muted">Open the current VOW Terms of Use and End User Licence Agreement.</p>
          </button>
          <button type="button" onClick={() => open(LEGAL_URLS.privacy)} className="w-full text-left px-5 py-6 sm:px-7 sm:py-7 hover:bg-vow-surface/50 transition-colors">
            <p className="text-xs text-vow-muted">02</p>
            <h2 className="mt-2 text-base font-medium text-vow-ink">Privacy Policy</h2>
            <p className="mt-2 text-sm leading-6 text-vow-muted">Open the current VOW Privacy Policy, including data, integrations, location and deletion information.</p>
          </button>
          <button type="button" onClick={() => open(LEGAL_URLS.copyright)} className="w-full text-left px-5 py-6 sm:px-7 sm:py-7 hover:bg-vow-surface/50 transition-colors">
            <p className="text-xs text-vow-muted">03</p>
            <h2 className="mt-2 text-base font-medium text-vow-ink">Copyright / DMCA</h2>
            <p className="mt-2 text-sm leading-6 text-vow-muted">Open the current VOW copyright and infringement reporting policy.</p>
          </button>
        </section>

        <p className="mt-6 text-[11px] leading-5 text-vow-muted">
          VOW is owned by Joshua Nathan Kasanga. The public website is the source of truth for the current legal documents.
        </p>
      </main>
    </div>
  );
}
