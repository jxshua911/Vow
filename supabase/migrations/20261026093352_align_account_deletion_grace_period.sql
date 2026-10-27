-- The current VOW account lifecycle is handled by the authenticated
-- vow-account-delete Edge Function plus vow_restore_or_purge_account on login.
-- Retire the old 14-day request-table RPC path so it cannot create a second,
-- conflicting deletion schedule. The functions remain in place for auditability
-- but are no longer callable through the exposed API by client roles.
BEGIN;

REVOKE ALL ON FUNCTION public.vow_request_account_deletion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vow_cancel_account_deletion() FROM PUBLIC, anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
