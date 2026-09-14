create or replace function public.reject_degraded_goal_plan() returns trigger language plpgsql as $$
declare
  steps jsonb;
  step jsonb;
  body text;
  original text;
  token text;
  meaningful_hit boolean := false;
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
    for token in select regexp_split_to_table(original,'[^a-z0-9+#.-]+') loop
      if length(token) >= 4 and token not in ('want','learn','how','what','with','from','into','this','that','make','become','need','goal','please','help') and position(token in body) > 0 then
        meaningful_hit := true;
        exit;
      end if;
    end loop;
    if length(regexp_replace(original,'[^a-z0-9]','','g')) >= 4 and not meaningful_hit then
      raise exception 'PLAN_QUALITY_REJECTED: goal semantics are not preserved in the plan';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reject_degraded_goal_plan on public.goals;
create trigger trg_reject_degraded_goal_plan
before insert or update of status, plan_json, outcome, title on public.goals
for each row execute function public.reject_degraded_goal_plan();
