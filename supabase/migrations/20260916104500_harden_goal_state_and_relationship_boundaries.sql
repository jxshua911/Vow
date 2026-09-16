-- Harden goal activation and child-object ownership at the database boundary.

-- A free account must never be able to hold more than one active/locked goal,
-- regardless of whether activation happens through INSERT, UPDATE, RPC, or a race.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.goals
    WHERE status IN ('active', 'locked')
    GROUP BY user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create active-goal uniqueness constraint: duplicate active/locked goals exist';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS goals_one_active_or_locked_per_user_idx
  ON public.goals(user_id)
  WHERE status IN ('active', 'locked');

CREATE OR REPLACE FUNCTION public.vow_guard_goal_entitlement_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result jsonb;
  transitioning boolean := false;
BEGIN
  transitioning := NEW.status IN ('active', 'locked')
    AND (
      TG_OP = 'INSERT'
      OR OLD.status IS DISTINCT FROM NEW.status
         AND OLD.status NOT IN ('active', 'locked')
    );

  IF transitioning THEN
    result := public.vow_consume_entitlement(
      'create_goal',
      jsonb_build_object('source', TG_OP, 'status', NEW.status)
    );

    IF coalesce((result->>'allowed')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'VOW_GOAL_ENTITLEMENT_REQUIRED'
        USING DETAIL = coalesce(result->>'reason', 'active_goal_limit');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vow_goal_entitlement_transition_guard ON public.goals;
CREATE TRIGGER vow_goal_entitlement_transition_guard
BEFORE INSERT OR UPDATE OF status ON public.goals
FOR EACH ROW
EXECUTE FUNCTION public.vow_guard_goal_entitlement_transition();

-- Child records must point to goals owned by the same authenticated user.
DROP POLICY IF EXISTS insert_own_sessions ON public.sessions;
CREATE POLICY insert_own_sessions
ON public.sessions FOR INSERT TO authenticated
WITH CHECK (
  (select auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.goals g
    WHERE g.id = sessions.goal_id
      AND g.user_id = (select auth.uid())
  )
  AND (
    sessions.milestone_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.milestones m
      WHERE m.id = sessions.milestone_id
        AND m.goal_id = sessions.goal_id
    )
  )
);

DROP POLICY IF EXISTS update_own_sessions ON public.sessions;
CREATE POLICY update_own_sessions
ON public.sessions FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK (
  (select auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.goals g
    WHERE g.id = sessions.goal_id
      AND g.user_id = (select auth.uid())
  )
  AND (
    sessions.milestone_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.milestones m
      WHERE m.id = sessions.milestone_id
        AND m.goal_id = sessions.goal_id
    )
  )
);

DROP POLICY IF EXISTS "Users can create their goal resources" ON public.goal_resources;
CREATE POLICY "Users can create their goal resources"
ON public.goal_resources FOR INSERT TO authenticated
WITH CHECK (
  (select auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.goals g
    WHERE g.id = goal_resources.goal_id
      AND g.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update their goal resources" ON public.goal_resources;
CREATE POLICY "Users can update their goal resources"
ON public.goal_resources FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK (
  (select auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.goals g
    WHERE g.id = goal_resources.goal_id
      AND g.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS insert_own_journal ON public.journal_entries;
CREATE POLICY insert_own_journal
ON public.journal_entries FOR INSERT TO authenticated
WITH CHECK (
  (select auth.uid()) = user_id
  AND (
    linked_goal_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = journal_entries.linked_goal_id
        AND g.user_id = (select auth.uid())
    )
  )
);

DROP POLICY IF EXISTS update_own_journal ON public.journal_entries;
CREATE POLICY update_own_journal
ON public.journal_entries FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK (
  (select auth.uid()) = user_id
  AND (
    linked_goal_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = journal_entries.linked_goal_id
        AND g.user_id = (select auth.uid())
    )
  )
);

DROP POLICY IF EXISTS insert_own_commitments ON public.commitment_log;
CREATE POLICY insert_own_commitments
ON public.commitment_log FOR INSERT TO authenticated
WITH CHECK (
  (select auth.uid()) = user_id
  AND (
    goal_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = commitment_log.goal_id
        AND g.user_id = (select auth.uid())
    )
  )
);

DROP POLICY IF EXISTS update_own_goal_clarifications ON public.goal_clarification_answers;
CREATE POLICY update_own_goal_clarifications
ON public.goal_clarification_answers FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK (
  (select auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.goals g
    WHERE g.id = goal_clarification_answers.goal_id
      AND g.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS update_own_goal_plan_items ON public.goal_plan_items;
CREATE POLICY update_own_goal_plan_items
ON public.goal_plan_items FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK (
  (select auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.goals g
    WHERE g.id = goal_plan_items.goal_id
      AND g.user_id = (select auth.uid())
  )
);

-- Remove unnecessary remote execution of trigger-only SECURITY DEFINER functions.
REVOKE EXECUTE ON FUNCTION public.materialize_plan_execution_from_active_goal() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.require_canonical_plan_for_execution() FROM PUBLIC, anon, authenticated;

-- Pin known SECURITY DEFINER helper search paths.
ALTER FUNCTION public.inherit_goal_plan_trace() SET search_path = public, pg_temp;
ALTER FUNCTION public.ensure_goal_plan_trace() SET search_path = public, pg_temp;
ALTER FUNCTION public.keep_goal_plan_metadata_consistent() SET search_path = public, pg_temp;
ALTER FUNCTION public.preserve_original_session_schedule() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_vow_entitlement_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.preserve_original_goal_on_activation() SET search_path = public, pg_temp;
ALTER FUNCTION public.reject_degraded_goal_plan() SET search_path = public, pg_temp;

NOTIFY pgrst, 'reload schema';
