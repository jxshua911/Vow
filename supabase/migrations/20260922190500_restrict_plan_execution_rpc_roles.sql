-- Restrict server-side plan execution RPCs to authenticated users.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.materialize_plan_execution_from_active_goal() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.require_canonical_plan_for_execution() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.materialize_plan_execution_from_active_goal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.require_canonical_plan_for_execution() TO authenticated;
COMMIT;