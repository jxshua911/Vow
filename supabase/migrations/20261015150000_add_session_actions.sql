-- VOW 1.8.0: persistent, schedulable session actions.
-- Actions form a tree so a step can be expanded into smaller steps.
-- A NULL scheduled_at inherits the parent action/session schedule.
CREATE TABLE IF NOT EXISTS session_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_action_id uuid REFERENCES session_actions(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  instructions text,
  sort_order integer NOT NULL DEFAULT 0,
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  sets integer CHECK (sets IS NULL OR sets > 0),
  reps text,
  rest_seconds integer CHECK (rest_seconds IS NULL OR rest_seconds >= 0),
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'skipped')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_actions_parent_not_self CHECK (parent_action_id IS NULL OR parent_action_id <> id)
);

ALTER TABLE session_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_session_actions" ON session_actions;
CREATE POLICY "select_own_session_actions" ON session_actions FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_actions.session_id
        AND s.user_id = auth.uid()
        AND s.goal_id = session_actions.goal_id
    )
  );

DROP POLICY IF EXISTS "insert_own_session_actions" ON session_actions;
CREATE POLICY "insert_own_session_actions" ON session_actions FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_actions.session_id
        AND s.user_id = auth.uid()
        AND s.goal_id = session_actions.goal_id
    )
  );

DROP POLICY IF EXISTS "update_own_session_actions" ON session_actions;
CREATE POLICY "update_own_session_actions" ON session_actions FOR UPDATE
  TO authenticated USING (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_actions.session_id AND s.user_id = auth.uid()
    )
  ) WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_actions.session_id
        AND s.user_id = auth.uid()
        AND s.goal_id = session_actions.goal_id
    )
  );

DROP POLICY IF EXISTS "delete_own_session_actions" ON session_actions;
CREATE POLICY "delete_own_session_actions" ON session_actions FOR DELETE
  TO authenticated USING (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_actions.session_id AND s.user_id = auth.uid()
    )
  );


CREATE INDEX IF NOT EXISTS idx_session_actions_session_order
  ON session_actions(session_id, parent_action_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_session_actions_goal_id
  ON session_actions(goal_id);
CREATE INDEX IF NOT EXISTS idx_session_actions_scheduled_at
  ON session_actions(scheduled_at) WHERE scheduled_at IS NOT NULL;

