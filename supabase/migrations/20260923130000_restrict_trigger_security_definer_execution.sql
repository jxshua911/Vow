-- Restrict trigger-only SECURITY DEFINER functions to their execution context.
-- These functions are invoked by database triggers, not directly by clients.
revoke execute on function public.materialize_plan_execution_from_active_goal() from authenticated, anon;
revoke execute on function public.require_canonical_plan_for_execution() from authenticated, anon;
