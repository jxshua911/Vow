import { useState } from 'react';
import { ArrowLeft } from '@/lib/ui-icons';
import { openExternalLink } from '@/lib/externalLinks';
import { PageHeader } from './AppShell';

const LEGAL_URLS = {
  terms: 'https://vowglobal.online/terms',
  privacy: 'https://vowglobal.online/privacy',
  copyright: 'https://vowglobal.online/copyright',
} as const;

export function LegalPage({ onBack }: { onBack: () => void }) {
  const [openError, setOpenError] = useState('');

  async function open(url: string) {
    setOpenError('');
    try {
      await openExternalLink(url);
    } catch (error) {
      console.error('[VOW] Legal document could not be opened:', error);
      setOpenError('We could not open that document. Please try again or open it from your browser.');
    }
  }

  return (
    <div className="min-h-screen bg-vow-bg">
      <header className="sticky top-0 z-30 border-b border-vow-border bg-vow-bg/95 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-8 h-16 flex items-center gap-4">
          <button type="button" onClick={onBack} className="shrink-0 w-11 h-11 border border-vow-border flex items-center justify-center text-vow-muted hover:text-vow-ink hover:border-vow-ink transition-colors" aria-label="Back"><ArrowLeft className="w-4 h-4" /></button>
          <div className="min-w-0"><p className="text-sm font-medium text-vow-ink truncate">Legal</p><p className="text-[10px] text-vow-muted">VOW · Terms & policies</p></div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-10 md:py-14">
        <PageHeader title="Terms & Policies" subtitle="VOW's current legal documents are maintained on the official VOW website." />
        {openError && <p role="alert" className="mb-5 border-l-2 border-vow-ink px-4 py-3 text-sm text-vow-ink">{openError}</p>}
        <section className="mt-6 sm:mt-8 border border-vow-border divide-y divide-vow-border">
          <button type="button" onClick={() => void open(LEGAL_URLS.terms)} className="w-full text-left px-4 py-5 sm:px-7 sm:py-7 hover:bg-vow-surface/50 transition-colors min-h-24"><p className="text-xs text-vow-muted">01</p><h2 className="mt-2 text-base font-medium text-vow-ink">Terms / EULA</h2><p className="mt-2 text-sm leading-6 text-vow-muted">Open the current VOW Terms of Use and End User Licence Agreement.</p></button>
          <button type="button" onClick={() => void open(LEGAL_URLS.privacy)} className="w-full text-left px-4 py-5 sm:px-7 sm:py-7 hover:bg-vow-surface/50 transition-colors min-h-24"><p className="text-xs text-vow-muted">02</p><h2 className="mt-2 text-base font-medium text-vow-ink">Privacy Policy</h2><p className="mt-2 text-sm leading-6 text-vow-muted">Open the current VOW Privacy Policy, including data, integrations, location and deletion information.</p></button>
          <button type="button" onClick={() => void open(LEGAL_URLS.copyright)} className="w-full text-left px-4 py-5 sm:px-7 sm:py-7 hover:bg-vow-surface/50 transition-colors min-h-24"><p className="text-xs text-vow-muted">03</p><h2 className="mt-2 text-base font-medium text-vow-ink">Copyright / DMCA</h2><p className="mt-2 text-sm leading-6 text-vow-muted">Open the current VOW copyright and infringement reporting policy.</p></button>
        </section>
        <p className="mt-5 text-[11px] leading-5 text-vow-muted">VOW is owned by Joshua Nathan Kasanga. The public website is the source of truth for the current legal documents.</p>
      </main>
    </div>
  );
}
