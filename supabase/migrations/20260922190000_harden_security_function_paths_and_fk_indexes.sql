-- VOW security/performance hardening
-- Applied to production on 2026-09-22.
-- Keep this migration aligned with the live database.

BEGIN;

ALTER FUNCTION public.inherit_goal_plan_trace() SET search_path = pg_catalog, public;
ALTER FUNCTION public.ensure_goal_plan_trace() SET search_path = pg_catalog, public;
ALTER FUNCTION public.keep_goal_plan_metadata_consistent() SET search_path = pg_catalog, public;
ALTER FUNCTION public.preserve_original_session_schedule() SET search_path = pg_catalog, public;
ALTER FUNCTION public.set_vow_entitlement_updated_at() SET search_path = pg_catalog, public;
ALTER FUNCTION public.preserve_original_goal_on_activation() SET search_path = pg_catalog, public;
ALTER FUNCTION public.reject_degraded_goal_plan() SET search_path = pg_catalog, public;

REVOKE EXECUTE ON FUNCTION public.materialize_plan_execution_from_active_goal() FROM anon;
REVOKE EXECUTE ON FUNCTION public.require_canonical_plan_for_execution() FROM anon;

CREATE INDEX IF NOT EXISTS idx_data_requests_user_id ON public.data_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_dependencies_depends_on_goal_id ON public.goal_dependencies(depends_on_goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal_id ON public.goal_milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_reminders_goal_id ON public.goal_reminders(goal_id);
CREATE INDEX IF NOT EXISTS idx_moderation_appeals_moderation_event_id ON public.moderation_appeals(moderation_event_id);
CREATE INDEX IF NOT EXISTS idx_moderation_appeals_user_id ON public.moderation_appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_adjustments_user_id ON public.plan_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_vow_ai_request_leases_user_id ON public.vow_ai_request_leases(user_id);
CREATE INDEX IF NOT EXISTS idx_vow_payment_events_user_id ON public.vow_payment_events(user_id);

COMMIT;