import { useState } from 'react';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/lib/supabase';

export const VOW_TERMS_VERSION = 'v1.1';

export function TermsAcceptance({ userId, onAccepted }: { userId: string; onAccepted: () => void; onReadLegal: () => void }) {
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function openTerms() {
    await Browser.open({ url: 'https://vowglobal.lovable.app/terms-and-services' });
  }

  async function handleContinue() {
    if (!accepted || saving) return;
    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('vow_terms_acceptances').insert({
      user_id: userId,
      terms_version: VOW_TERMS_VERSION,
      accepted_at: new Date().toISOString(),
    });
    if (insertError && insertError.code !== '23505') {
      setError('We could not record your acceptance. Please try again.');
      setSaving(false);
      return;
    }
    setSaving(false);
    onAccepted();
  }

  return <div className="min-h-screen bg-vow-bg flex items-center justify-center px-6 py-12">
    <div className="w-full max-w-xl">
      <div className="text-center mb-10">
        <div className="text-6xl font-black tracking-[-0.08em] text-vow-ink mb-5" aria-hidden="true">&gt;</div>
        <p className="vow-label mb-2">Before you continue</p>
        <h1 className="vow-heading text-3xl md:text-4xl text-vow-ink">Review VOW's terms and policies.</h1>
      </div>
      <div className="border border-vow-border p-6 md:p-8">
        <p className="text-sm text-vow-muted leading-relaxed">VOW's Terms, Privacy Policy and related legal documents explain how the service works, your responsibilities, AI-generated content, Premium subscriptions, connected services, location and other important conditions of use. The Copyright & DMCA Policy explains how copyright reports are handled.</p>
        <div className="flex flex-wrap gap-3 mt-5">
          <button type="button" onClick={openTerms} className="vow-btn-ghost">Read Terms & Privacy</button>
        </div>
        <label className="flex items-start gap-3 mt-7 cursor-pointer">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-current" />
          <span className="text-sm text-vow-ink leading-relaxed">I have read and agree to VOW's Terms and Privacy Policy and acknowledge the related legal documents.</span>
        </label>
        {error && <p role="alert" className="vow-error mt-5"><span>{error}</span></p>}
        <button type="button" onClick={handleContinue} disabled={!accepted || saving} className="vow-btn-primary w-full mt-6 disabled:opacity-40">{saving ? 'Recording acceptance…' : 'Accept and continue'}</button>
        <p className="text-[11px] text-vow-muted leading-relaxed mt-4">Your acceptance is recorded against your VOW account with the current terms version and timestamp.</p>
      </div>
    </div>
  </div>;
}
