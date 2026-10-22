-- Subscription and payment state is server-authoritative.
-- Clients may read only their own entitlement/subscription rows through RLS;
-- only trusted server-side functions may mutate subscription or payment state.
BEGIN;

-- The original entitlement table allowed only Stripe, but verified purchases
-- also flow through the canonical RPC for Google Play and future providers.
-- Keep the provider set aligned with the server-only subscription record API.
ALTER TABLE public.vow_user_entitlements
  DROP CONSTRAINT IF EXISTS vow_user_entitlements_provider_check;
ALTER TABLE public.vow_user_entitlements
  ADD CONSTRAINT vow_user_entitlements_provider_check
  CHECK (provider IS NULL OR provider IN ('google_play', 'apple', 'stripe', 'manual'));

-- Production historically constrained payment events to Stripe only, while
-- the canonical subscription RPC also records Google Play, Apple, and manual
-- subscription lifecycle events. Keep the audit ledger aligned with the RPC.
ALTER TABLE public.vow_payment_events
  DROP CONSTRAINT IF EXISTS vow_payment_events_provider_check;
ALTER TABLE public.vow_payment_events
  ADD CONSTRAINT vow_payment_events_provider_check
  CHECK (provider IN ('google_play', 'apple', 'stripe', 'manual'));

-- The canonical RPC and current webhook use this conflict target. Keep the
-- existing single-column unique constraint for compatibility with old callers
-- until every deployed webhook has been upgraded.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.vow_payment_events'::regclass
      AND conname = 'vow_payment_events_provider_provider_event_id_key'
  ) THEN
    ALTER TABLE public.vow_payment_events
      ADD CONSTRAINT vow_payment_events_provider_provider_event_id_key
      UNIQUE (provider, provider_event_id);
  END IF;
END
$migration$;

REVOKE ALL ON TABLE public.vow_user_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.vow_user_entitlements TO authenticated;

REVOKE ALL ON TABLE public.vow_subscription_records FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.vow_subscription_records TO authenticated;

REVOKE ALL ON TABLE public.vow_payment_events FROM PUBLIC, anon, authenticated;

-- Payment events are a server-side audit ledger, not a client-facing API.
DROP POLICY IF EXISTS "Users can read their own payment events" ON public.vow_payment_events;

COMMIT;

NOTIFY pgrst, 'reload schema';
