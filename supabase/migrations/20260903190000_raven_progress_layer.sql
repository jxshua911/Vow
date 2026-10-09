-- VOW — Raven progress layer
-- Raven observes execution over time. It does not alter the underlying session history.

CREATE TABLE IF NOT EXISTS raven_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  award_key text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, award_key)
);

ALTER TABLE raven_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_raven_awards" ON raven_awards;
CREATE POLICY "select_own_raven_awards" ON raven_awards
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_raven_awards" ON raven_awards;
CREATE POLICY "insert_own_raven_awards" ON raven_awards
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_raven_awards_user_earned
  ON raven_awards(user_id, earned_at DESC);

CREATE TABLE IF NOT EXISTS raven_weekly_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  score int NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  completion_pct numeric(5,2) NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

ALTER TABLE raven_weekly_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_raven_snapshots" ON raven_weekly_snapshots;
CREATE POLICY "select_own_raven_snapshots" ON raven_weekly_snapshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_raven_snapshots" ON raven_weekly_snapshots;
CREATE POLICY "insert_own_raven_snapshots" ON raven_weekly_snapshots
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_raven_snapshots" ON raven_weekly_snapshots;
CREATE POLICY "update_own_raven_snapshots" ON raven_weekly_snapshots
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_raven_snapshots_user_week
  ON raven_weekly_snapshots(user_id, week_start DESC);
