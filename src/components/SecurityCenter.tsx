import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageHeader } from './AppShell';

export function SecurityCenterPage() {
  const { session } = useAuth();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function request(type: 'export' | 'delete') {
    if (!session || busy) return;
    setBusy(true); setMessage('');
    const { error } = await supabase.from('data_requests').insert({ user_id: session.user.id, request_type: type, status: 'requested' });
    if (error) setMessage('VOW could not record that request. Please try again.');
    else setMessage(type === 'export' ? 'Export request recorded. Your data will remain private to your account.' : 'Deletion request recorded. Account deletion requires the secure account workflow to complete.');
    setBusy(false);
  }

  return <div className="min-w-0">
    <PageHeader title="Security & privacy" subtitle="Manage the information VOW stores and the safety controls around your account." />
    {message && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3 mb-6">{message}</p>}
    <div className="border border-vow-border divide-y divide-vow-border">
      <section className="p-5"><p className="text-sm text-vow-ink">Private content</p><p className="text-xs text-vow-muted mt-1 leading-relaxed">Your goals and journal entries are private. VOW safety systems may analyse submitted content to keep the service safe, but the owner moderation surface stores safety metadata rather than your goal or journal wording.</p></section>
      <section className="p-5"><div className="flex items-start justify-between gap-5"><div><p className="text-sm text-vow-ink">Export my data</p><p className="text-xs text-vow-muted mt-1">Create a request for a copy of the data associated with this account.</p></div><button type="button" disabled={busy} onClick={() => request('export')} className="vow-btn-soft shrink-0">Request export</button></div></section>
      <section className="p-5"><div className="flex items-start justify-between gap-5"><div><p className="text-sm text-vow-ink">Delete my account</p><p className="text-xs text-vow-muted mt-1">Request account deletion. VOW will not silently delete an account from a normal client-side button.</p></div><button type="button" disabled={busy} onClick={() => request('delete')} className="vow-btn-soft shrink-0">Request deletion</button></div></section>
      <section className="p-5"><p className="text-sm text-vow-ink">Safety review</p><p className="text-xs text-vow-muted mt-1 leading-relaxed">If automated safety checks produce a restriction, VOW should provide a clear status and review path rather than exposing private journal or goal text to an owner.</p></section>
    </div>
  </div>;
}
