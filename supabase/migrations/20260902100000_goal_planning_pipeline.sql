-- VOW end-to-end goal planning pipeline
-- Stores clarification answers and a queryable, versioned day-by-day AI schedule.

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS plan_json jsonb,
  ADD COLUMN IF NOT EXISTS plan_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS planning_horizon_weeks integer,
  ADD COLUMN IF NOT EXISTS planning_timezone text;

CREATE TABLE IF NOT EXISTS goal_clarification_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text,
  question_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(goal_id, question_order)
);

ALTER TABLE goal_clarification_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_goal_clarifications" ON goal_clarification_answers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_goal_clarifications" ON goal_clarification_answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM goals WHERE goals.id = goal_id AND goals.user_id = auth.uid()));
CREATE POLICY "update_own_goal_clarifications" ON goal_clarification_answers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_goal_clarifications" ON goal_clarification_answers FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_goal_clarifications_goal ON goal_clarification_answers(goal_id, question_order);

CREATE TABLE IF NOT EXISTS goal_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_version integer NOT NULL DEFAULT 1,
  week_number integer NOT NULL CHECK (week_number > 0),
  day_of_week text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  task text NOT NULL,
  purpose text,
  target_metric text,
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','skipped','moved','cancelled')),
  external_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE goal_plan_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_goal_plan_items" ON goal_plan_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_goal_plan_items" ON goal_plan_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM goals WHERE goals.id = goal_id AND goals.user_id = auth.uid()));
CREATE POLICY "update_own_goal_plan_items" ON goal_plan_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_goal_plan_items" ON goal_plan_items FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_goal_plan_items_goal_week ON goal_plan_items(goal_id, plan_version, week_number);
CREATE INDEX IF NOT EXISTS idx_goal_plan_items_scheduled ON goal_plan_items(user_id, scheduled_at);

COMMENT ON TABLE goal_clarification_answers IS 'Goal-specific AI follow-up questions and user answers used to regenerate or adjust plans.';
COMMENT ON TABLE goal_plan_items IS 'Versioned, queryable day-by-day schedule generated from a goal and its clarification answers.';
