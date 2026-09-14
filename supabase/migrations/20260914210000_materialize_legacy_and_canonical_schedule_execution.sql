create or replace function public.materialize_plan_execution_from_active_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_source jsonb;
  v_item jsonb;
  v_is_schedule boolean := false;
  v_count integer;
  v_idx integer := 0;
  v_seconds numeric := 0;
  v_scheduled_at timestamptz;
  v_task text;
  v_duration_minutes integer;
  v_number numeric;
  v_duration_text text;
begin
  if new.status <> 'active' then return new; end if;

  -- Support both the legacy canonical schedule and the newer step plan.
  if jsonb_typeof(new.plan_json->'schedule') = 'array'
     and coalesce(jsonb_array_length(new.plan_json->'schedule'), 0) > 0 then
    v_source := new.plan_json->'schedule';
    v_is_schedule := true;
  elsif jsonb_typeof(new.plan_json->'steps') = 'array'
     and coalesce(jsonb_array_length(new.plan_json->'steps'), 0) > 0 then
    v_source := new.plan_json->'steps';
  else
    return new;
  end if;

  if exists (select 1 from public.sessions where goal_id = new.id)
     or exists (select 1 from public.goal_plan_items where goal_id = new.id) then
    return new;
  end if;

  v_count := least(jsonb_array_length(v_source), 24);

  -- New step plans only get future scheduling when the user supplied a timeframe.
  -- A missing timeframe produces one immediate next action, never an invented programme.
  if not v_is_schedule then
    v_duration_text := lower(trim(coalesce(new.duration, '')));
    begin
      v_number := nullif(translate(v_duration_text, 'abcdefghijklmnopqrstuvwxyz ', ''), '')::numeric;
    exception when others then
      v_number := null;
    end;

    if v_number is not null then
      if position('minute' in v_duration_text) > 0 then v_seconds := v_number * 60;
      elsif position('hour' in v_duration_text) > 0 then v_seconds := v_number * 3600;
      elsif position('day' in v_duration_text) > 0 then v_seconds := v_number * 86400;
      elsif position('week' in v_duration_text) > 0 then v_seconds := v_number * 604800;
      elsif position('month' in v_duration_text) > 0 then v_seconds := v_number * 2592000;
      end if;
    end if;

    if v_seconds <= 0 then v_count := 1; end if;
  end if;

  for v_item in select value from jsonb_array_elements(v_source) limit 24 loop
    v_idx := v_idx + 1;
    if v_idx > v_count then exit; end if;

    v_task := nullif(trim(coalesce(v_item->>'task', v_item->>'title', '')), '');
    if v_task is null then continue; end if;

    if v_is_schedule and nullif(trim(coalesce(v_item->>'scheduled_at', '')), '') is not null then
      begin
        v_scheduled_at := (v_item->>'scheduled_at')::timestamptz;
      exception when others then
        v_scheduled_at := now();
      end;
    elsif v_seconds > 0 and v_count > 1 then
      v_scheduled_at := now() + make_interval(secs => (v_seconds * (v_idx - 1) / (v_count - 1))::double precision);
    else
      v_scheduled_at := now();
    end if;

    begin
      v_duration_minutes := greatest(1, least(1440, coalesce((coalesce(v_item->>'duration_minutes', v_item->>'estimated_minutes'))::integer, 30)));
    exception when others then
      v_duration_minutes := 30;
    end;

    insert into public.goal_plan_items(
      goal_id, user_id, plan_version, week_number, day_of_week, scheduled_at,
      task, purpose, target_metric, duration_minutes, status
    ) values (
      new.id,
      new.user_id,
      coalesce(new.plan_version, 1),
      greatest(1, coalesce(nullif(v_item->>'week', '')::integer,
        floor(extract(epoch from (v_scheduled_at - now())) / 604800)::integer + 1)),
      coalesce(nullif(trim(v_item->>'day'), ''),
        to_char(v_scheduled_at at time zone coalesce(nullif(new.planning_timezone, ''), 'UTC'), 'FMDay')),
      v_scheduled_at,
      v_task,
      nullif(trim(coalesce(v_item->>'purpose', '')), ''),
      nullif(trim(coalesce(v_item->>'target_metric', v_item->>'target', '')), ''),
      v_duration_minutes,
      'scheduled'
    ) on conflict do nothing;

    insert into public.sessions(
      goal_id, user_id, title, scheduled_at, duration_minutes, status,
      moved_count, notes, external_event_id
    ) values (
      new.id,
      new.user_id,
      v_task,
      v_scheduled_at,
      v_duration_minutes,
      'scheduled',
      0,
      nullif(trim(coalesce(v_item->>'purpose', '')), ''),
      null
    ) on conflict do nothing;
  end loop;

  return new;
end;
$fn$;
