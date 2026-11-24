import { useState } from 'react';

type Props = {
  expiresAt: string | null;
  onRestore: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

export function AccountDeletionPendingPage({ expiresAt, onRestore, onSignOut }: Props) {
  const [restoring, setRestoring] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const expiryLabel = expiresAt && Number.isFinite(Date.parse(expiresAt))
    ? new Date(expiresAt).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })
    : 'the end of your 14-day grace period';

  async function restore() {
    if (restoring) return;
    setRestoring(true);
    setError('');
    try {
      await onRestore();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'VOW could not restore your account. Please try again.');
    } finally {
      setRestoring(false);
    }
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setError('');
    try {
      await onSignOut();
    } catch {
      setError('VOW could not sign you out. Please try again.');
      setSigningOut(false);
    }
  }

  return (
    <main className="min-h-screen bg-vow-bg px-5 py-12 text-vow-ink">
      <section className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center">
        <p className="vow-label mb-4">VOW · Account status</p>
        <h1 className="vow-heading text-3xl leading-tight">Your account is scheduled for deletion.</h1>
        <p className="mt-5 text-sm leading-relaxed text-vow-muted">
          Your VOW account is temporarily locked. Its data is scheduled for permanent deletion after the grace period, on:
        </p>
        <p className="mt-3 border border-vow-border px-4 py-3 text-sm font-medium">{expiryLabel}</p>
        <p className="mt-5 text-sm leading-relaxed text-vow-muted">
          If you want to keep your account, choose Restore my account. This explicitly cancels the deletion request. Otherwise, sign out and the scheduled deletion will continue.
        </p>
        {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-8 grid gap-3">
          <button type="button" onClick={() => void restore()} disabled={restoring || signingOut} className="vow-btn-primary justify-center disabled:opacity-50">
            {restoring ? 'Restoring account…' : 'Restore my account'}
          </button>
          <button type="button" onClick={() => void signOut()} disabled={restoring || signingOut} className="vow-btn-ghost justify-center disabled:opacity-50">
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </section>
    </main>
  );
}
