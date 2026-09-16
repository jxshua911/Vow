-- VOW adversarial hardening: prevent authenticated users from attaching
-- child records to another user's top-level goal.

-- goal_resources: user_id alone is insufficient; goal_id must be owned by caller.
DROP POLICY IF EXISTS "Users can create their goal resources" ON public.goal_resources;
DROP POLICY IF EXISTS "Users can update their goal resources" ON public.goal_resources;
CREATE POLICY "Users can create their goal resources"
  ON public.goal_resources FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_resources.goal_id
        AND g.user_id = (select auth.uid())
    )
  );
CREATE POLICY "Users can update their goal resources"
  ON public.goal_resources FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_resources.goal_id
        AND g.user_id = (select auth.uid())
    )
  );

-- sessions: require both session ownership and goal ownership. When a
-- milestone is supplied, it must also belong to the same goal.
DROP POLICY IF EXISTS "insert_own_sessions" ON public.sessions;
DROP POLICY IF EXISTS "update_own_sessions" ON public.sessions;
CREATE POLICY "insert_own_sessions"
  ON public.sessions FOR INSERT
  TO authenticated
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
CREATE POLICY "update_own_sessions"
  ON public.sessions FOR UPDATE
  TO authenticated
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

-- journal_entries: linked_goal_id is optional, but if supplied it must be
-- owned by the same user as the journal entry.
DROP POLICY IF EXISTS "insert_own_journal" ON public.journal_entries;
DROP POLICY IF EXISTS "update_own_journal" ON public.journal_entries;
CREATE POLICY "insert_own_journal"
  ON public.journal_entries FOR INSERT
  TO authenticated
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
CREATE POLICY "update_own_journal"
  ON public.journal_entries FOR UPDATE
  TO authenticated
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

-- commitment_log: the referenced goal must belong to the same user.
DROP POLICY IF EXISTS "insert_own_commitments" ON public.commitment_log;
CREATE POLICY "insert_own_commitments"
  ON public.commitment_log FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = commitment_log.goal_id
        AND g.user_id = (select auth.uid())
    )
  );

-- reviews: keep the owner check and require any generated review snapshot to
-- be created by its authenticated owner. The entitlement trigger remains the
-- authoritative premium gate.
DROP POLICY IF EXISTS "insert_own_reviews" ON public.reviews;
DROP POLICY IF EXISTS "update_own_reviews" ON public.reviews;
CREATE POLICY "insert_own_reviews"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "update_own_reviews"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

NOTIFY pgrst, 'reload schema';
