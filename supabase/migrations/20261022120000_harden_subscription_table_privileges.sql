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

REVOKE ALL ON TABLE public.vow_user_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.vow_user_entitlements TO authenticated;

REVOKE ALL ON TABLE public.vow_subscription_records FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.vow_subscription_records TO authenticated;

REVOKE ALL ON TABLE public.vow_payment_events FROM PUBLIC, anon, authenticated;

-- Payment events are a server-side audit ledger, not a client-facing API.
DROP POLICY IF EXISTS "Users can read their own payment events" ON public.vow_payment_events;

COMMIT;

NOTIFY pgrst, 'reload schema';
