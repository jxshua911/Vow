-- Ensure activating a draft always populates required goal execution context.
-- Preserve the original outcome only when activation changes it, and only add
-- the completion definition when the generated plan supplies one.
CREATE OR REPLACE FUNCTION public.preserve_original_goal_on_activation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF OLD.status = 'draft' AND NEW.status = 'active' THEN
    NEW.goal_context_json := COALESCE(NEW.goal_context_json, '{}'::jsonb);

    IF NEW.outcome IS DISTINCT FROM OLD.outcome THEN
      NEW.outcome := OLD.outcome;
      NEW.goal_context_json := jsonb_set(
        NEW.goal_context_json,
        '{original_goal}',
        to_jsonb(OLD.outcome),
        true
      );
    END IF;

    IF NULLIF(NEW.plan_json->>'completion_definition', '') IS NOT NULL THEN
      NEW.goal_context_json := jsonb_set(
        NEW.goal_context_json,
        '{planner_completion_definition}',
        to_jsonb(NEW.plan_json->>'completion_definition'),
        true
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
