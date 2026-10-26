-- Close current production ownership gaps in child-row and storage policies.
-- Do not add a blanket unique active-goal index: Premium users may have multiple active goals.
BEGIN;

-- Enforce the Free active-goal limit inside the same transaction as goal state changes.
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
  -- Trusted server-side jobs may materialize plans without an end-user JWT.
  -- Authenticated client writes must always bind ownership to auth.uid().
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Goal ownership must match the authenticated user';
  END IF;

  transitioning := NEW.status IN ('active', 'locked')
    AND (
      TG_OP = 'INSERT'
      OR (
        OLD.status IS DISTINCT FROM NEW.status
        AND OLD.status NOT IN ('active', 'locked')
      )
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

-- sessions: a user may only attach a session to their own goal and its milestone.
DROP POLICY IF EXISTS insert_own_sessions ON public.sessions;
CREATE POLICY insert_own_sessions
ON public.sessions FOR INSERT TO authenticated
WITH CHECK (
  (select auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.goals g
    WHERE g.id = sessions.goal_id AND g.user_id = (select auth.uid())
  )
  AND (
    sessions.milestone_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.milestones m
      WHERE m.id = sessions.milestone_id AND m.goal_id = sessions.goal_id
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
    WHERE g.id = sessions.goal_id AND g.user_id = (select auth.uid())
  )
  AND (
    sessions.milestone_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.milestones m
      WHERE m.id = sessions.milestone_id AND m.goal_id = sessions.goal_id
    )
  )
);

-- Remove legacy permissive policies; PostgreSQL combines permissive policies with OR.
DROP POLICY IF EXISTS "Users can create their goal resources" ON public.goal_resources;
DROP POLICY IF EXISTS "Users can update their goal resources" ON public.goal_resources;

-- journal_entries: linked goals must belong to the same user.
DROP POLICY IF EXISTS insert_own_journal ON public.journal_entries;
CREATE POLICY insert_own_journal
ON public.journal_entries FOR INSERT TO authenticated
WITH CHECK (
  (select auth.uid()) = user_id
  AND (
    linked_goal_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = journal_entries.linked_goal_id AND g.user_id = (select auth.uid())
    )
  )
);

DROP POLICY IF EXISTS update_own_journal ON public.journal_entries;
DROP POLICY IF EXISTS "Users can update their own journal entries" ON public.journal_entries;
CREATE POLICY update_own_journal
ON public.journal_entries FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK (
  (select auth.uid()) = user_id
  AND (
    linked_goal_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = journal_entries.linked_goal_id AND g.user_id = (select auth.uid())
    )
  )
);

-- Clarification and plan rows must remain attached to goals owned by the caller.
DROP POLICY IF EXISTS update_own_goal_clarifications ON public.goal_clarification_answers;
CREATE POLICY update_own_goal_clarifications
ON public.goal_clarification_answers FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK (
  (select auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.goals g
    WHERE g.id = goal_clarification_answers.goal_id AND g.user_id = (select auth.uid())
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
    WHERE g.id = goal_plan_items.goal_id AND g.user_id = (select auth.uid())
  )
);

-- Remove older storage policies that checked only the first path segment.
-- The remaining policies require both user-id and goal-id path ownership.
DROP POLICY IF EXISTS "Users can upload goal resources" ON storage.objects;
DROP POLICY IF EXISTS "Users can read goal resources" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete goal resources" ON storage.objects;

DROP POLICY IF EXISTS "VOW users can read goal resources" ON storage.objects;
CREATE POLICY "VOW users can read goal resources"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'goal-resources'
  AND split_part(name, '/', 1) = (select auth.uid())::text
  AND EXISTS (
    SELECT 1 FROM public.goals g
    WHERE g.id::text = split_part(name, '/', 2) AND g.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS "VOW users can delete goal resources" ON storage.objects;
CREATE POLICY "VOW users can delete goal resources"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'goal-resources'
  AND split_part(name, '/', 1) = (select auth.uid())::text
  AND EXISTS (
    SELECT 1 FROM public.goals g
    WHERE g.id::text = split_part(name, '/', 2) AND g.user_id = (select auth.uid())
  )
);

COMMIT;

NOTIFY pgrst, 'reload schema';
