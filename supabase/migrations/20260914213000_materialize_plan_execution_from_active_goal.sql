create or replace function public.materialize_plan_execution_from_active_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_steps jsonb;
  v_step jsonb;
  v_count integer;
  v_idx integer := 0;
  v_seconds numeric;
  v_match text[];
  v_scheduled_at timestamptz;
  v_task text;
  v_duration_minutes integer;
begin
  if new.status <> 'active' then return new; end if;
  if new.plan_json is null or jsonb_typeof(new.plan_json->'steps') <> 'array' then return new; end if;
  if coalesce(jsonb_array_length(new.plan_json->'steps'), 0) = 0 then return new; end if;
  if old.status = 'active' then return new; end if;
  if exists (select 1 from public.sessions where goal_id = new.id)
     or exists (select 1 from public.goal_plan_items where goal_id = new.id) then return new; end if;

  v_steps := new.plan_json->'steps';
  v_count := least(jsonb_array_length(v_steps), 24);
  v_match := regexp_match(lower(coalesce(new.duration, '')), '([0-9]+(?:\\.[0-9]+)?)\\s*(minute|minutes|hour|hours|day|days|week|weeks|month|months)');
  if v_match is not null then
    v_seconds := v_match[1]::numeric * case v_match[2]
      when 'minute' then 60 when 'minutes' then 60
      when 'hour' then 3600 when 'hours' then 3600
      when 'day' then 86400 when 'days' then 86400
      when 'week' then 604800 when 'weeks' then 604800
      when 'month' then 2592000 when 'months' then 2592000
      else 0 end;
  else
    v_seconds := 0;
  end if;

  for v_step in select value from jsonb_array_elements(v_steps) limit 24 loop
    v_idx := v_idx + 1;
    v_task := nullif(trim(coalesce(v_step->>'title', '')), '');
    if v_task is null then continue; end if;
    if v_seconds > 0 and v_count > 1 then
      v_scheduled_at := now() + make_interval(secs => (v_seconds * (v_idx - 1) / (v_count - 1))::double precision);
    else
      v_scheduled_at := now();
    end if;
    v_duration_minutes := greatest(1, least(1440, coalesce((v_step->>'estimated_minutes')::integer, 30)));

    insert into public.goal_plan_items(goal_id, plan_version, week_number, day_of_week, scheduled_at, task, purpose, target_metric, duration_minutes, status)
    values (new.id, coalesce(new.plan_version, 1), greatest(1, floor(extract(epoch from (v_scheduled_at - now())) / 604800)::integer + 1), to_char(v_scheduled_at at time zone coalesce(nullif(new.planning_timezone, ''), 'UTC'), 'FMDay'), v_scheduled_at, v_task, nullif(trim(coalesce(v_step->>'purpose', '')), ''), nullif(trim(coalesce(v_step->>'target', '')), ''), v_duration_minutes, 'scheduled')
    on conflict do nothing;

    insert into public.sessions(goal_id, user_id, title, scheduled_at, duration_minutes, status, moved_count, notes, external_event_id)
    values (new.id, new.user_id, v_task, v_scheduled_at, v_duration_minutes, 'scheduled', 0, nullif(trim(coalesce(v_step->>'purpose', '')), ''), null)
    on conflict do nothing;
  end loop;
  return new;
end;
$$;

create trigger trg_materialize_goal_execution
after update of status, plan_json, duration on public.goals
for each row
execute function public.materialize_plan_execution_from_active_goal();
