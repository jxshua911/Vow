-- Subscription and payment state is server-authoritative.
-- Clients may read only their own entitlement/subscription rows through RLS;
-- only trusted server-side functions may mutate subscription or payment state.
BEGIN;

REVOKE ALL ON TABLE public.vow_user_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.vow_user_entitlements TO authenticated;

REVOKE ALL ON TABLE public.vow_subscription_records FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.vow_subscription_records TO authenticated;

REVOKE ALL ON TABLE public.vow_payment_events FROM PUBLIC, anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
