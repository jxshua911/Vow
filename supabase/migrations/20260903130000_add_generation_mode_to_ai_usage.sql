-- Record whether AI output came from Groq or the deterministic fallback.
-- Nullable keeps existing historical usage rows valid.

ALTER TABLE public.vow_ai_usage
  ADD COLUMN IF NOT EXISTS generation_mode text;

ALTER TABLE public.vow_ai_usage
  DROP CONSTRAINT IF EXISTS vow_ai_usage_generation_mode_check;

ALTER TABLE public.vow_ai_usage
  ADD CONSTRAINT vow_ai_usage_generation_mode_check
  CHECK (generation_mode IS NULL OR generation_mode IN ('groq','fallback'));
