type AccountSuspendedPageProps = {
  onBack: () => void;
};

export function AccountSuspendedPage({ onBack }: AccountSuspendedPageProps) {
  return (
    <section
      role="alert"
      aria-live="polite"
      className="overflow-hidden rounded-2xl border border-vow-border bg-vow-surface"
    >
      <div className="h-1.5 w-full bg-vow-success" />
      <div className="space-y-5 p-6 sm:p-7">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-vow-border bg-vow-bg text-xl font-semibold text-vow-ink" aria-hidden="true">
          !
        </div>
        <div className="space-y-2">
          <p className="vow-label">Account access</p>
          <h1 className="vow-heading text-2xl text-vow-ink">Account suspended</h1>
          <p className="text-sm leading-6 text-vow-muted">
            Sign-in is currently unavailable for this account. If you think this action was a mistake, contact VOW support and ask for a review.
          </p>
        </div>
        <div className="border-l-2 border-vow-success bg-vow-bg/60 p-3">
          <p className="text-xs leading-5 text-vow-muted">
            Signing in again will not clear this account restriction. If you believe the decision is incorrect, email VOW support to request a review.
          </p>
        </div>
        <a href="mailto:support@vowglobal.online?subject=VOW%20account%20suspension%20review" className="block w-full rounded-lg border border-vow-border px-4 py-3 text-center text-sm font-medium text-vow-ink transition-colors hover:bg-vow-bg">Email VOW support</a>
        <button type="button" onClick={onBack} className="vow-btn-primary w-full justify-center">
          Back to sign in
        </button>
      </div>
    </section>
  );
}
