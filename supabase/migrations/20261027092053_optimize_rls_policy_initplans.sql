-- Keep auth.uid() evaluation constant per statement for user-owned RLS policies.
-- This is a planner/performance improvement only; row ownership rules remain unchanged.
BEGIN;

DROP POLICY IF EXISTS "Users can read their own AI quality alerts" ON public.vow_ai_quality_alerts;
CREATE POLICY "Users can read their own AI quality alerts"
  ON public.vow_ai_quality_alerts
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can resolve their own AI quality alerts" ON public.vow_ai_quality_alerts;
CREATE POLICY "Users can resolve their own AI quality alerts"
  ON public.vow_ai_quality_alerts
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS support_select_own ON public.support_submissions;
CREATE POLICY support_select_own
  ON public.support_submissions
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

COMMIT;

NOTIFY pgrst, 'reload schema';
