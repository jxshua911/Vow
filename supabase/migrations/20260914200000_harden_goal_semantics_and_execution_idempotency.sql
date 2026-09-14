-- Break-test hardening: preserve enough of the user's intent to be recognisable,
-- respect explicit/no timeframe semantics, and prevent duplicate lock materialisation.

CREATE UNIQUE INDEX IF NOT EXISTS ux_sessions_goal_schedule_title
  ON public.sessions(goal_id, scheduled_at, title);

CREATE UNIQUE INDEX IF NOT EXISTS ux_goal_plan_items_version_schedule_task
  ON public.goal_plan_items(goal_id, plan_version, scheduled_at, task);

CREATE OR REPLACE FUNCTION public.reject_degraded_goal_plan()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
declare
  steps jsonb;
  step jsonb;
  body text;
  original text;
  token text;
  meaningful_count integer := 0;
  meaningful_total integer := 0;
  compact_original text;
  compact_body text;
  deadline_text text;
  horizon_text text;
begin
  if new.status in ('active','locked') and new.plan_json is not null and jsonb_typeof(new.plan_json)='object' then
    steps := new.plan_json->'steps';
    if jsonb_typeof(steps) <> 'array' or jsonb_array_length(steps) < 2 then
      raise exception 'PLAN_QUALITY_REJECTED: plan must contain at least two executable steps';
    end if;

    for step in select value from jsonb_array_elements(steps) loop
      if nullif(trim(step->>'title'),'') is null
         or nullif(trim(step->>'purpose'),'') is null
         or nullif(trim(step->>'target'),'') is null
         or nullif(trim(step->>'evidence'),'') is null
         or lower(trim(step->>'title')) ~ '^(step[[:space:]]*[0-9]+|milestone)$'
         or lower(trim(step->>'target')) in ('complete the action.','complete the action','complete the next action required for this goal.')
         or lower(trim(step->>'evidence')) = 'record what was completed.' then
        raise exception 'PLAN_QUALITY_REJECTED: placeholder or incomplete step';
      end if;
    end loop;

    body := lower(new.plan_json::text);
    original := lower(coalesce(new.outcome,new.title,''));
    compact_original := regexp_replace(original,'[^a-z0-9]+','','g');
    compact_body := regexp_replace(body,'[^a-z0-9]+','','g');

    -- Exact preservation is ideal. Otherwise require at least half of the
    -- meaningful goal tokens (and at least two when two or more exist). A
    -- single generic word such as "learn" must never make a generic plan valid.
    if length(compact_original) >= 4 and position(compact_original in compact_body) = 0 then
      for token in select regexp_split_to_table(original,'[^a-z0-9+#.-]+') loop
        if length(token) >= 4 and token not in ('want','learn','how','what','with','from','into','this','that','make','become','need','goal','please','help','would','like','the','and','for') then
          meaningful_total := meaningful_total + 1;
          if position(token in body) > 0 then meaningful_count := meaningful_count + 1; end if;
        end if;
      end loop;
      if meaningful_total > 0 and meaningful_count < greatest(2, ceil(meaningful_total::numeric / 2.0)::integer) then
        raise exception 'PLAN_QUALITY_REJECTED: insufficient goal semantics preserved (% of % meaningful tokens)', meaningful_count, meaningful_total;
      end if;
    end if;

    horizon_text := lower(trim(coalesce(new.plan_json->>'horizon','')));
    deadline_text := lower(trim(coalesce(new.plan_json->>'deadline','')));

    if new.duration is not null then
      if horizon_text = '' or horizon_text = 'as needed' then
        raise exception 'PLAN_QUALITY_REJECTED: explicit goal timeframe was lost';
      end if;
    elsif deadline_text <> '' and deadline_text <> 'none' then
      raise exception 'PLAN_QUALITY_REJECTED: plan invented a deadline for a goal without one';
    end if;
  end if;
  return new;
end;
$function$;

-- Existing trg_reject_degraded_goal_plan already invokes this function, so
-- replacing the function hardens the live trigger without adding a duplicate.
