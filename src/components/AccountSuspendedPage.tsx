type AccountSuspendedPageProps = {
  onBack: () => void;
};

export function AccountSuspendedPage({ onBack }: AccountSuspendedPageProps) {
  return (
    <section
      role="alert"
      aria-live="polite"
      aria-labelledby="account-suspended-title"
      className="overflow-hidden rounded-2xl border border-vow-border bg-vow-surface shadow-sm"
    >
      <div className="h-1.5 w-full bg-vow-success" />
      <div className="space-y-5 p-6 sm:p-7">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full border border-vow-border bg-vow-bg text-xl font-semibold text-vow-ink"
          aria-hidden="true"
        >
          !
        </div>
        <div className="space-y-2">
          <p className="vow-label">Account access</p>
          <h1 id="account-suspended-title" className="vow-heading text-2xl text-vow-ink">
            Account suspended
          </h1>
          <p className="text-sm leading-6 text-vow-muted">
            This account is currently restricted from signing in to VOW. You do not need to keep retrying sign-in.
          </p>
        </div>
        <div className="border-l-2 border-vow-success bg-vow-bg/60 p-3">
          <p className="text-sm font-medium text-vow-ink">What you can do</p>
          <p className="mt-1 text-xs leading-5 text-vow-muted">
            If you believe this restriction is a mistake, contact VOW support and request a review. Signing in again will not remove the restriction.
          </p>
        </div>
        <a
          href="mailto:support@vowglobal.online?subject=VOW%20account%20suspension%20review"
          className="block w-full rounded-lg bg-vow-ink px-4 py-3 text-center text-sm font-medium text-vow-bg transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Contact support for a review
        </a>
        <button
          type="button"
          onClick={onBack}
          className="w-full rounded-lg border border-vow-border px-4 py-3 text-sm font-medium text-vow-ink transition-colors hover:bg-vow-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Try a different account
        </button>
        <p className="text-center text-xs leading-5 text-vow-muted">
          If you return to sign-in, choose a different account. This restriction remains in place for the suspended account.
        </p>
      </div>
    </section>
  );
}
