-- Keep the dashboard's weekly-review usage counter aligned with successful review usage.
-- Review regeneration updates the current review; it does not consume another free review.
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
BEGIN
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT plan, status INTO v_plan, v_status
  FROM public.vow_get_effective_entitlement()
  LIMIT 1;

  SELECT count(*)::integer INTO v_active_goals
  FROM public.goals WHERE user_id = v_user_id AND status = 'active';

  SELECT count(*)::integer INTO v_planning_used
  FROM public.vow_ai_usage_events
  WHERE user_id = v_user_id
    AND mode IN ('goal-clarify', 'goal-plan')
    AND outcome = 'success'
    AND created_at >= date_trunc('month', now());

  SELECT count(*)::integer INTO v_adaptive_used
  FROM public.vow_ai_usage_events
  WHERE user_id = v_user_id
    AND mode = 'chat'
    AND outcome = 'success'
    AND created_at >= date_trunc('month', now());

  SELECT count(*)::integer INTO v_review_used
  FROM public.vow_ai_usage_events
  WHERE user_id = v_user_id
    AND mode = 'review'
    AND outcome = 'success'
    AND created_at >= date_trunc('month', now());

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
    'period_start', date_trunc('month', now())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.vow_get_entitlement_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vow_get_entitlement_snapshot() TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
