-- Count persisted weekly reviews for the dashboard's free-review allowance.
-- AI telemetry is not authoritative for this counter: legacy successful reviews may
-- predate usage-event logging, and regenerating a saved review does not consume another review.
BEGIN;

CREATE OR REPLACE FUNCTION public.vow_get_entitlement_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_plan text := 'free';
  v_status text := 'inactive';
  v_active_goals integer := 0;
  v_planning_used integer := 0;
  v_adaptive_used integer := 0;
  v_review_used integer := 0;
  v_period date := date_trunc('month', now())::date;
BEGIN
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT plan, status INTO v_plan, v_status
  FROM public.vow_get_effective_entitlement()
  LIMIT 1;

  SELECT count(*)::integer INTO v_active_goals
  FROM public.goals
  WHERE user_id = v_user_id AND status = 'active';

  SELECT count(*)::integer INTO v_planning_used
  FROM public.vow_entitlement_usage
  WHERE user_id = v_user_id AND feature = 'planning_action' AND period_start = v_period;

  SELECT v_planning_used + count(*)::integer INTO v_planning_used
  FROM public.vow_entitlement_reservations
  WHERE user_id = v_user_id AND feature = 'planning_action' AND period_start = v_period
    AND status = 'reserved' AND expires_at > now();

  SELECT count(*)::integer INTO v_adaptive_used
  FROM public.vow_entitlement_usage
  WHERE user_id = v_user_id AND feature = 'adaptive_replan' AND period_start = v_period;

  SELECT v_adaptive_used + count(*)::integer INTO v_adaptive_used
  FROM public.vow_entitlement_reservations
  WHERE user_id = v_user_id AND feature = 'adaptive_replan' AND period_start = v_period
    AND status = 'reserved' AND expires_at > now();

  SELECT count(*)::integer INTO v_review_used
  FROM public.reviews
  WHERE user_id = v_user_id AND created_at >= date_trunc('month', now());

  RETURN jsonb_build_object(
    'plan', CASE WHEN v_status = 'active' AND v_plan = 'premium' THEN 'premium' ELSE 'free' END,
    'active_goals', v_active_goals,
    'active_goal_limit', CASE WHEN v_status = 'active' AND v_plan = 'premium' THEN NULL ELSE 1 END,
    'planning_used', v_planning_used,
    'planning_limit', CASE WHEN v_status = 'active' AND v_plan = 'premium' THEN NULL ELSE 3 END,
    'adaptive_replans_used', v_adaptive_used,
    'adaptive_replans_limit', CASE WHEN v_status = 'active' AND v_plan = 'premium' THEN NULL ELSE 1 END,
    'advanced_reviews_used', v_review_used,
    'advanced_reviews_limit', CASE WHEN v_status = 'active' AND v_plan = 'premium' THEN NULL ELSE 1 END,
    'period_start', v_period
  );
END;
$$;

REVOKE ALL ON FUNCTION public.vow_get_entitlement_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vow_get_entitlement_snapshot() TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
