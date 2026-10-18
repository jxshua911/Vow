-- Persist action semantics and per-set/task execution progress.
ALTER TABLE public.session_actions
  ADD COLUMN IF NOT EXISTS action_type text NOT NULL DEFAULT 'task';

ALTER TABLE public.session_actions
  DROP CONSTRAINT IF EXISTS session_actions_action_type_check;
ALTER TABLE public.session_actions
  ADD CONSTRAINT session_actions_action_type_check
  CHECK (action_type IN ('category', 'group', 'exercise', 'task', 'rest', 'break'));

UPDATE public.session_actions AS action
SET action_type = CASE
  WHEN action.title ~* '^(rest|break)([[:space:]:·-]|$)' THEN 'rest'
  WHEN EXISTS (
    SELECT 1 FROM public.session_actions AS child
    WHERE child.parent_action_id = action.id
      AND child.session_id = action.session_id
      AND child.user_id = action.user_id
  ) THEN 'category'
  WHEN action.sets IS NOT NULL OR action.reps IS NOT NULL THEN 'exercise'
  ELSE 'task'
END
WHERE action.action_type = 'task';

CREATE TABLE IF NOT EXISTS public.session_action_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  action_id uuid NOT NULL REFERENCES public.session_actions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  set_number integer NOT NULL DEFAULT 0 CHECK (set_number >= 0),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_action_completions_unique UNIQUE (session_id, action_id, set_number)
);

ALTER TABLE public.session_action_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_action_completions_select_own ON public.session_action_completions;
CREATE POLICY session_action_completions_select_own
  ON public.session_action_completions FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.session_actions action
      JOIN public.sessions session ON session.id = action.session_id
      WHERE action.id = session_action_completions.action_id
        AND action.session_id = session_action_completions.session_id
        AND action.user_id = (SELECT auth.uid())
        AND session.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS session_action_completions_insert_own ON public.session_action_completions;
CREATE POLICY session_action_completions_insert_own
  ON public.session_action_completions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.session_actions action
      JOIN public.sessions session ON session.id = action.session_id
      WHERE action.id = session_action_completions.action_id
        AND action.session_id = session_action_completions.session_id
        AND action.user_id = (SELECT auth.uid())
        AND session.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS session_action_completions_update_own ON public.session_action_completions;
CREATE POLICY session_action_completions_update_own
  ON public.session_action_completions FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.session_actions action
      JOIN public.sessions session ON session.id = action.session_id
      WHERE action.id = session_action_completions.action_id
        AND action.session_id = session_action_completions.session_id
        AND action.user_id = (SELECT auth.uid())
        AND session.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS session_action_completions_delete_own ON public.session_action_completions;
CREATE POLICY session_action_completions_delete_own
  ON public.session_action_completions FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_action_completions TO authenticated;

CREATE INDEX IF NOT EXISTS idx_session_action_completions_session_user
  ON public.session_action_completions(session_id, user_id);
