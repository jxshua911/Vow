-- Feed Raven's observed progress into Weekly Review without changing the immutable session history.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS raven_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.raven_review_context(p_user_id uuid, p_week_start date, p_week_end date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_committed int := 0;
  current_completed int := 0;
  previous_committed int := 0;
  previous_completed int := 0;
  current_pct int := 0;
  previous_pct int := 0;
  delta int := 0;
BEGIN
  SELECT count(*)::int,
         count(*) FILTER (WHERE status = 'completed')::int
    INTO current_committed, current_completed
    FROM sessions
   WHERE user_id = p_user_id
     AND scheduled_at >= p_week_start::timestamptz
     AND scheduled_at < (p_week_end + 1)::timestamptz;

  SELECT count(*)::int,
         count(*) FILTER (WHERE status = 'completed')::int
    INTO previous_committed, previous_completed
    FROM sessions
   WHERE user_id = p_user_id
     AND scheduled_at >= (p_week_start - 7)::timestamptz
     AND scheduled_at < p_week_start::timestamptz;

  IF current_committed > 0 THEN current_pct := round(current_completed::numeric / current_committed * 100); END IF;
  IF previous_committed > 0 THEN previous_pct := round(previous_completed::numeric / previous_committed * 100); END IF;
  delta := current_pct - previous_pct;

  RETURN jsonb_build_object(
    'week_start', p_week_start,
    'week_end', p_week_end,
    'completion_pct', current_pct,
    'completed', current_completed,
    'committed', current_committed,
    'previous_completion_pct', CASE WHEN previous_committed > 0 THEN previous_pct ELSE NULL END,
    'score_delta', CASE WHEN previous_committed > 0 THEN delta ELSE NULL END,
    'trend', CASE WHEN previous_committed = 0 THEN 'new' WHEN delta > 2 THEN 'up' WHEN delta < -2 THEN 'down' ELSE 'steady' END,
    'signal', CASE WHEN previous_committed = 0 THEN 'Raven is establishing a baseline.' WHEN delta >= 15 THEN 'Raven noticed a strong bounce back.' WHEN delta <= -15 THEN 'Raven noticed a meaningful consistency drop.' WHEN delta > 2 THEN 'Raven noticed improving consistency.' WHEN delta < -2 THEN 'Raven noticed a small consistency drop.' ELSE 'Raven noticed steady consistency.' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_raven_to_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  raven jsonb;
  trend text;
  description text;
BEGIN
  raven := public.raven_review_context(NEW.user_id, NEW.week_start, NEW.week_end);
  NEW.raven_snapshot := raven;
  trend := raven->>'trend';
  description := raven->>'signal';

  NEW.patterns := coalesce(NEW.patterns, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'type', 'raven_signal',
    'description', description,
    'evidence', jsonb_build_array(format('Raven consistency score for this week: %s%%.', raven->>'completion_pct')),
    'hypothesis', CASE WHEN trend = 'down' THEN 'Something may have disrupted the usual routine.' ELSE 'The observed execution pattern is useful evidence for next week.' END,
    'proposed_adjustment', CASE WHEN trend = 'down' THEN 'Understand what changed before increasing commitments.' ELSE 'Use the observed pattern to keep the next commitment realistic.' END
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_attach_raven ON reviews;
CREATE TRIGGER reviews_attach_raven
BEFORE INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION public.attach_raven_to_review();
