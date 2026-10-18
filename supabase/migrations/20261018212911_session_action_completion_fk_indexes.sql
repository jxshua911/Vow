-- Index the independent foreign keys for efficient deletes and ownership lookups.
CREATE INDEX IF NOT EXISTS idx_session_action_completions_action_id
  ON public.session_action_completions(action_id);
CREATE INDEX IF NOT EXISTS idx_session_action_completions_user_id
  ON public.session_action_completions(user_id);
