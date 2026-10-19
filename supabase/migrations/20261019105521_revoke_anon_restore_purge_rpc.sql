-- The account restore/purge RPC is user-scoped but SECURITY DEFINER.
-- Prevent anonymous callers from reaching the function; authenticated users
-- can still restore their own account during the grace period.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.vow_restore_or_purge_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vow_restore_or_purge_account() TO authenticated, service_role;
COMMIT;
