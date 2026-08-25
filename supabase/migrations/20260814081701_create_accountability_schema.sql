/*
# VOW — Core Schema

## Purpose
Multi-user app. Each user owns their goals, milestones, sessions, journal
entries, and an immutable commitment log. Row-level security scopes every
table to the authenticated owner.

## New Tables
1. `user_settings` — per-user coaching preferences: notification frequency,
   coaching tone, preferred session times, timezone, pause context.
2. `goals` — outcome, deadline, status (draft/locked/active/completed/abandoned),
   why_it_matters (user's stated motivation), weekly commitment target.
3. `milestones` — ordered sub-goals belonging to a goal, each with a deadline.
4. `sessions` — scheduled time blocks tied to a milestone/goal, with status
   (scheduled/completed/skipped/moved) and moved_count (reschedule signal).
5. `journal_entries` — freeform text + timestamp + optional tag + optional
   goal link. Body stored as text; embeddings deferred to v2.
6. `commitment_log` — IMMUTABLE append-only record of what was locked in for
   a week vs. what actually happened. The ground truth the weekly review reads.
   Only INSERT allowed; no UPDATE or DELETE policies.
7. `reviews` — generated weekly review snapshots (committed vs done, patterns,
   AI coaching text). Stored so the user can revisit past reviews.

## Security
- RLS enabled on every table.
- Owner column defaults to `auth.uid()` on top-level tables.
- Child tables (milestones, sessions, commitment_log, reviews) scope through
  their parent goal's owner via EXISTS checks.
- commitment_log has NO update/delete policies — it is append-only by design.
- Journal entries are owner-scoped and never exposed to other users.

## Notes
- `commitment_log` immutability is enforced at the policy layer (no UPDATE/DELETE
  policies). A future migration could add a trigger for hard enforcement.
- `sessions.external_event_id` is a placeholder for calendar integration (v2).
- Embeddings column on journal_entries is nullable text for future vector use.
*/

-- ============================================================
-- user_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'UTC',
  preferred_session_times text,
  notification_frequency text NOT NULL DEFAULT 'weekly',
  coaching_tone text NOT NULL DEFAULT 'honest_encouraging',
  pause_context text,
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_settings" ON user_settings;
CREATE POLICY "select_own_settings" ON user_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_settings" ON user_settings;
CREATE POLICY "insert_own_settings" ON user_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_settings" ON user_settings;
CREATE POLICY "update_own_settings" ON user_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- goals
-- ============================================================
CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  outcome text NOT NULL,
  why_it_matters text,
  deadline date,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','locked','active','completed','abandoned')),
  weekly_commitment_target int NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_goals" ON goals;
CREATE POLICY "select_own_goals" ON goals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_goals" ON goals;
CREATE POLICY "insert_own_goals" ON goals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_goals" ON goals;
CREATE POLICY "update_own_goals" ON goals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_goals" ON goals;
CREATE POLICY "delete_own_goals" ON goals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);

-- ============================================================
-- milestones
-- ============================================================
CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  deadline date,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','skipped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_milestones" ON milestones;
CREATE POLICY "select_own_milestones" ON milestones FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM goals WHERE goals.id = milestones.goal_id AND goals.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_milestones" ON milestones;
CREATE POLICY "insert_own_milestones" ON milestones FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM goals WHERE goals.id = milestones.goal_id AND goals.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_milestones" ON milestones;
CREATE POLICY "update_own_milestones" ON milestones FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM goals WHERE goals.id = milestones.goal_id AND goals.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM goals WHERE goals.id = milestones.goal_id AND goals.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_milestones" ON milestones;
CREATE POLICY "delete_own_milestones" ON milestones FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM goals WHERE goals.id = milestones.goal_id AND goals.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_milestones_goal_id ON milestones(goal_id);

-- ============================================================
-- sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES milestones(id) ON DELETE SET NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','skipped','moved')),
  moved_count int NOT NULL DEFAULT 0,
  external_event_id text,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sessions" ON sessions;
CREATE POLICY "select_own_sessions" ON sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sessions" ON sessions;
CREATE POLICY "insert_own_sessions" ON sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_sessions" ON sessions;
CREATE POLICY "update_own_sessions" ON sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_sessions" ON sessions;
CREATE POLICY "delete_own_sessions" ON sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_goal_id ON sessions(goal_id);
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled_at ON sessions(scheduled_at);

-- ============================================================
-- journal_entries
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  tag text,
  linked_goal_id uuid REFERENCES goals(id) ON DELETE SET NULL,
  embedding text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_journal" ON journal_entries;
CREATE POLICY "select_own_journal" ON journal_entries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_journal" ON journal_entries;
CREATE POLICY "insert_own_journal" ON journal_entries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_journal" ON journal_entries;
CREATE POLICY "update_own_journal" ON journal_entries FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_journal" ON journal_entries;
CREATE POLICY "delete_own_journal" ON journal_entries FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_journal_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_created_at ON journal_entries(created_at);

-- ============================================================
-- commitment_log — IMMUTABLE, append-only
-- ============================================================
CREATE TABLE IF NOT EXISTS commitment_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  committed_sessions int NOT NULL,
  completed_sessions int NOT NULL DEFAULT 0,
  skipped_sessions int NOT NULL DEFAULT 0,
  moved_sessions int NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE commitment_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_commitments" ON commitment_log;
CREATE POLICY "select_own_commitments" ON commitment_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_commitments" ON commitment_log;
CREATE POLICY "insert_own_commitments" ON commitment_log FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Deliberately NO update or delete policies: this table is append-only.

CREATE INDEX IF NOT EXISTS idx_commitment_user_id ON commitment_log(user_id);
CREATE INDEX IF NOT EXISTS idx_commitment_week ON commitment_log(user_id, week_start);

-- ============================================================
-- reviews
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  completion_pct numeric(5,2) NOT NULL DEFAULT 0,
  committed_count int NOT NULL DEFAULT 0,
  completed_count int NOT NULL DEFAULT 0,
  missed_count int NOT NULL DEFAULT 0,
  moved_count int NOT NULL DEFAULT 0,
  biggest_win text,
  biggest_setback text,
  patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  coaching_text text NOT NULL DEFAULT '',
  proposed_commitments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','confirmed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reviews" ON reviews;
CREATE POLICY "select_own_reviews" ON reviews FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_reviews" ON reviews;
CREATE POLICY "insert_own_reviews" ON reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_reviews" ON reviews;
CREATE POLICY "update_own_reviews" ON reviews FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_reviews" ON reviews;
CREATE POLICY "delete_own_reviews" ON reviews FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_week ON reviews(user_id, week_start);