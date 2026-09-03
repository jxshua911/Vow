-- Reconcile goals_duration_check with the live GoalPlanner duration model.
-- Safe to run against the current live schema: the existing constraint is
-- dropped if present and recreated with the canonical allowed values.

ALTER TABLE public.goals
  DROP CONSTRAINT IF EXISTS goals_duration_check;

ALTER TABLE public.goals
  ADD CONSTRAINT goals_duration_check
  CHECK (
    (duration IS NULL)
    OR (
      duration = ANY (
        ARRAY[
          '1w'::text,
          '2w'::text,
          '4w'::text,
          '8w'::text,
          '12w'::text,
          '26w'::text,
          '52w'::text,
          '1m'::text,
          '2m'::text
        ]
      )
    )
  );
