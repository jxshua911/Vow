-- VOW: make weekly review confirmation idempotent and parent-bound.
-- Security goal: concurrent/replayed confirmations must not create duplicate
-- commitment records or session records, and a commitment may only reference
-- a goal owned by the authenticated user.

-- A user can have at most one review snapshot for a given week.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_user_week_unique
  ON public.reviews(user_id, week_start);

-- A commitment snapshot is a weekly immutable commitment. Prevent replayed
-- confirmations from creating another row for the same user/goal/week.
CREATE UNIQUE INDEX IF NOT EXISTS idx_commitment_log_user_goal_week_unique
  ON public.commitment_log(user_id, goal_id, week_start);

-- Add the missing relational ownership check to commitment insertion.
DROP POLICY IF EXISTS "insert_own_commitments" ON public.commitment_log;
CREATE POLICY "insert_own_commitments" ON public.commitment_log
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.goals g
      WHERE g.id = commitment_log.goal_id
        AND g.user_id = auth.uid()
    )
  );

-- Freeze the review's identity after creation. The review's owner/week cannot
-- be reassigned by a client update.
DROP POLICY IF EXISTS "update_own_reviews" ON public.reviews;
CREATE POLICY "update_own_reviews" ON public.reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND user_id = (SELECT r.user_id FROM public.reviews r WHERE r.id = reviews.id)
    AND week_start = (SELECT r.week_start FROM public.reviews r WHERE r.id = reviews.id)
    AND week_end = (SELECT r.week_end FROM public.reviews r WHERE r.id = reviews.id)
  );

-- Ensure confirmation timestamps cannot be forged back to NULL after a review
-- has been confirmed.
CREATE OR REPLACE FUNCTION public.prevent_review_identity_or_confirmed_regressions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.user_id IS DISTINCT FROM NEW.user_id
     OR OLD.week_start IS DISTINCT FROM NEW.week_start
     OR OLD.week_end IS DISTINCT FROM NEW.week_end THEN
    RAISE EXCEPTION 'Review identity cannot be changed';
  END IF;

  IF OLD.status = 'confirmed' AND NEW.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Confirmed review cannot be reverted';
  END IF;

  IF OLD.status = 'confirmed' AND NEW.confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Confirmed review must retain confirmed_at';
  END IF;

  IF NEW.status = 'confirmed' AND NEW.confirmed_at IS NULL THEN
    NEW.confirmed_at := COALESCE(OLD.confirmed_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_review_identity_or_confirmed_regressions
  ON public.reviews;
CREATE TRIGGER trg_prevent_review_identity_or_confirmed_regressions
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.prevent_review_identity_or_confirmed_regressions();

-- This is a database-internal trigger helper; clients must not invoke it.
REVOKE ALL ON FUNCTION public.prevent_review_identity_or_confirmed_regressions() FROM PUBLIC, anon, authenticated;

-- Keep the review insert path constrained to authenticated users only.
REVOKE ALL ON FUNCTION public.prevent_review_identity_or_confirmed_regressions() FROM PUBLIC;
