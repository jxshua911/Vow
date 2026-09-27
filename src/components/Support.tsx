import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowLeft } from '@/lib/ui-icons';
import { PageHeader } from './AppShell';

type Props = { onBack: () => void };

export function SupportPage({ onBack }: Props) {
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

    const { error } = await supabase.functions.invoke('vow-website-chat', {
      body: { action: 'contact', name, email, subject: reason, message: text, source: 'vow-app-support' },
    });

    if (error) {
      console.error('[VOW] Support submission failed:', error);
      setStatus('error');
      return;
    }
    form.reset();
    setMessage('');
    setStatus('success');
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-6 flex items-center gap-2 text-sm text-vow-muted hover:text-vow-ink">
        <ArrowLeft className="h-4 w-4" /> Back to profile
      </button>
      <PageHeader title="Support" subtitle="Report an issue, ask a question, or send feedback." />
      <section className="border border-vow-border p-5 md:p-7">
        {status === 'success' && <div role="status" className="mb-6 border-l-2 border-vow-ink bg-vow-surface/60 px-4 py-3 text-sm leading-6">Your support request was sent. We’ll get back to you.</div>}
        {status === 'error' && <div role="alert" className="mb-6 border-l-2 border-vow-ink bg-vow-surface/60 px-4 py-3 text-sm leading-6">We couldn’t send that right now. Please try again or email vowglobalapp@gmail.com.</div>}
        <form onSubmit={submit} className="space-y-5">
          <label className="block"><span className="vow-label">Name</span><input required name="name" autoComplete="name" className="vow-input mt-2" placeholder="Your name" /></label>
          <label className="block"><span className="vow-label">Email</span><input required type="email" name="email" autoComplete="email" className="vow-input mt-2" placeholder="you@example.com" /></label>
          <label className="block"><span className="vow-label">Issue type</span><select value={reason} onChange={(event) => setReason(event.target.value)} name="reason" className="vow-input mt-2"><option>Bug or technical issue</option><option>Account / login</option><option>Subscription / Premium</option><option>Privacy request</option><option>Account deletion</option><option>Feedback</option><option>Other</option></select></label>
          <label className="block"><span className="vow-label">Message</span><textarea required minLength={10} name="message" value={message} onChange={(event) => setMessage(event.target.value)} rows={8} className="vow-input mt-2 resize-y leading-6" placeholder="Tell us what happened and what you need help with." /></label>
          <button type="submit" disabled={status === 'sending'} className="vow-btn-primary disabled:opacity-50">{status === 'sending' ? 'Sending…' : 'Send support request'}</button>
        </form>
        <div className="mt-8 border-t border-vow-border pt-5"><p className="text-xs text-vow-muted">Prefer email?</p><a href="mailto:vowglobalapp@gmail.com" className="mt-1 inline-block text-sm text-vow-ink underline underline-offset-4">vowglobalapp@gmail.com</a></div>
      </section>
    </div>
  );
}
