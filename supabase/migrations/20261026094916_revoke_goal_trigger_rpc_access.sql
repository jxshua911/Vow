-- Trigger functions are not public RPC endpoints. The trigger continues to invoke this function internally.
BEGIN;
REVOKE ALL ON FUNCTION public.vow_guard_goal_entitlement_transition() FROM PUBLIC, anon, authenticated, service_role;
COMMIT;
NOTIFY pgrst, 'reload schema';
