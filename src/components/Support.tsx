import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft } from '@/lib/ui-icons';

type Props = { onBack: () => void; onLegal: () => void };

export function SupportPage({ onBack, onLegal }: Props) {
  const [reason, setReason] = useState('Bug or technical issue');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const name = String(data.get('name') || '').trim();
    const text = String(data.get('message') || '').trim();
    if (!email || !name || text.length < 10) return;
    setStatus('sending');

    try {
      const { error } = await supabase.functions.invoke('vow-website-chat', {
        body: { action: 'contact', name, email, subject: reason, message: text, source: 'vow-app-support' },
      });
      if (error) throw error;
      form.reset();
      setMessage('');
      setStatus('success');
    } catch (error) {
      console.error('[VOW] Support submission failed:', error);
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen bg-vow-bg">
      <header className="border-b border-vow-border bg-vow-bg" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4 sm:px-8">
          <button type="button" onClick={onBack} className="flex h-11 shrink-0 items-center gap-2 border border-vow-border px-3 text-sm text-vow-muted transition-colors hover:border-vow-ink hover:text-vow-ink" aria-label="Back to profile">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <span className="text-sm font-medium text-vow-ink">Support</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-8">
        <h1 className="vow-heading text-xl text-vow-ink mb-1">How can we help?</h1>
        <p className="text-xs text-vow-muted mb-4">Report an issue, ask a question, or send feedback.</p>
        <section className="border border-vow-border p-4">
          {status === 'success' && <div role="status" className="mb-4 border-l-2 border-vow-ink bg-vow-surface/60 px-3 py-2 text-xs leading-5">Your support request was sent. We’ll get back to you.</div>}
          {status === 'error' && <div role="alert" className="mb-4 border-l-2 border-vow-ink bg-vow-surface/60 px-3 py-2 text-xs leading-5">We couldn’t send that right now. Please try again or email vowglobalapp@gmail.com.</div>}
          <form onSubmit={submit} className="space-y-3">
            <label className="block"><span className="vow-label">Name</span><input required name="name" autoComplete="name" className="vow-input mt-2" placeholder="Your name" /></label>
            <label className="block"><span className="vow-label">Email</span><input required type="email" name="email" autoComplete="email" className="vow-input mt-2" placeholder="you@example.com" /></label>
            <label className="block"><span className="vow-label">Issue type</span><select value={reason} onChange={(event) => setReason(event.target.value)} name="reason" className="vow-input mt-2"><option>Bug or technical issue</option><option>Account / login</option><option>Subscription / Premium</option><option>Privacy request</option><option>Account deletion</option><option>Feedback</option><option>Other</option></select></label>
            <label className="block"><span className="vow-label">Message</span><textarea required minLength={10} name="message" value={message} onChange={(event) => setMessage(event.target.value)} rows={3} className="vow-input mt-1 resize-y leading-5" placeholder="Tell us what happened and what you need help with." /></label>
            <button type="submit" disabled={status === 'sending'} className="vow-btn-primary disabled:opacity-50">{status === 'sending' ? 'Sending…' : 'Send support request'}</button>
          </form>
          <div className="mt-4 border-t border-vow-border pt-3">
            <p className="text-xs text-vow-muted">Prefer email?</p>
            <a href="mailto:vowglobalapp@gmail.com" className="mt-1 inline-block text-sm text-vow-ink underline underline-offset-4">vowglobalapp@gmail.com</a>
          </div>
        </section>
        <button type="button" onClick={onLegal} className="mt-3 w-full border border-vow-border p-3 text-left text-sm text-vow-muted transition-colors hover:border-vow-ink hover:text-vow-ink">
          <span className="block font-medium text-vow-ink">Terms, Privacy &amp; Copyright</span>
          <span className="mt-1 block text-xs">Open the EULA, privacy policy, and copyright information.</span>
        </button>
      </main>
    </div>
  );
}
