import { Browser } from '@capacitor/browser';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export const VOW_TERMS_VERSION = 'v1.1';

const LEGAL_URLS = {
  terms: 'https://vowglobalwebsite.lovable.app/#/terms',
  privacy: 'https://vowglobalwebsite.lovable.app/#/privacy',
} as const;

async function openLegal(url: string) {
  try { await Browser.open({ url }); }
  catch { window.open(url, '_blank', 'noopener,noreferrer'); }
}

export function TermsAcceptance({ userId, onAccepted, onReadLegal }: { userId: string; onAccepted: () => void; onReadLegal: () => void }) {
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleContinue() {
    if (!accepted || saving) return;
    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('vow_terms_acceptances').insert({
      user_id: userId, terms_version: VOW_TERMS_VERSION, accepted_at: new Date().toISOString(),
    });
    if (insertError && insertError.code !== '23505') {
      setError('We could not record your acceptance. Please try again.');
      setSaving(false);
      return;
    }
    setSaving(false);
    onAccepted();
  }

  return <div className="min-h-screen bg-vow-bg flex items-center justify-center px-5 py-8 sm:px-6 sm:py-12">
    <div className="w-full max-w-xl">
      <div className="text-center mb-7 sm:mb-10">
        <div className="text-6xl font-black tracking-[-0.08em] text-vow-ink mb-4" aria-hidden="true">VOW</div>
        <p className="vow-label mb-2">Before you continue</p>
        <h1 className="vow-heading text-2xl sm:text-3xl md:text-4xl text-vow-ink">Review VOW's terms and policies.</h1>
      </div>
      <div className="border border-vow-border p-5 sm:p-6 md:p-8">
        <p className="text-sm text-vow-muted leading-relaxed">VOW's Terms, Privacy Policy and related legal documents explain how the service works, your responsibilities, AI-generated content, Premium subscriptions, connected services, location and other important conditions of use.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-5">
          <button type="button" onClick={() => void openLegal(LEGAL_URLS.terms)} className="vow-btn-ghost w-full min-h-11 justify-center">Read Terms / EULA</button>
          <button type="button" onClick={() => void openLegal(LEGAL_URLS.privacy)} className="vow-btn-ghost w-full min-h-11 justify-center">Read Privacy Policy</button>
        </div>
        <button type="button" onClick={onReadLegal} className="w-full text-center text-xs text-vow-muted underline underline-offset-4 mt-4 min-h-10">View all legal documents in VOW</button>
        <label className="flex items-start gap-3 mt-6 cursor-pointer">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-current" />
          <span className="text-sm text-vow-ink leading-relaxed">I have read and agree to VOW's Terms and Privacy Policy and acknowledge the related legal documents.</span>
        </label>
        {error && <p role="alert" className="vow-error mt-5"><span>{error}</span></p>}
        <button type="button" onClick={handleContinue} disabled={!accepted || saving} className="vow-btn-primary w-full mt-5 min-h-11 disabled:opacity-40">{saving ? 'Recording acceptance…' : 'Accept and continue'}</button>
        <p className="text-[11px] text-vow-muted leading-relaxed mt-4">Your acceptance is recorded against your VOW account with the current terms version and timestamp.</p>
      </div>
    </div>
  </div>;
}
