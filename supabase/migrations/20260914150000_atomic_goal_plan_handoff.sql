-- Atomically lock a generated plan and materialise its first actionable work.
-- The client computes conflict-free timestamps with src/lib/scheduling.ts;
-- this function commits the goal, milestones, plan items and sessions together.

alter table public.sessions
  add column if not exists plan_version integer not null default 0;

create unique index if not exists sessions_goal_plan_version_scheduled_unique
  on public.sessions (goal_id, plan_version, scheduled_at)
  where status = 'scheduled' and plan_version > 0;

create unique index if not exists goal_plan_items_goal_plan_version_scheduled_unique
  on public.goal_plan_items (goal_id, plan_version, scheduled_at)
  where status = 'scheduled';

create or replace function public.lock_in_goal_plan(
  p_goal_id uuid,
  p_user_id uuid,
  p_title text,
  p_outcome text,
  p_why_it_matters text,
  p_plan jsonb,
  p_goal_context jsonb,
  p_plan_version integer,
  p_plan_generated_at timestamptz,
  p_planning_timezone text,
  p_deadline date,
  p_duration text,
  p_milestones jsonb,
  p_execution_items jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  current_goal public.goals%rowtype;
  expected_items integer := jsonb_array_length(coalesce(p_execution_items, '[]'::jsonb));
  existing_items integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Authentication required';
  end if;

  if expected_items = 0 then
    raise exception 'At least one actionable plan item is required';
  end if;

  select * into current_goal
  from public.goals
  where id = p_goal_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Goal not found';
  end if;

  select count(*) into existing_items
  from public.goal_plan_items
  where goal_id = p_goal_id and plan_version = p_plan_version;

  if current_goal.status = 'active'
     and current_goal.plan_version = p_plan_version
     and existing_items = expected_items then
    return true;
  end if;

  delete from public.sessions
  where goal_id = p_goal_id and plan_version = p_plan_version;
  delete from public.goal_plan_items
  where goal_id = p_goal_id and plan_version = p_plan_version;
  delete from public.milestones where goal_id = p_goal_id;

  update public.goals
  set title = p_title,
      outcome = p_outcome,
      why_it_matters = p_why_it_matters,
      status = 'active',
      plan_json = p_plan,
      goal_context_json = coalesce(p_goal_context, '{}'::jsonb),
      plan_version = p_plan_version,
      plan_generated_at = p_plan_generated_at,
      planning_horizon_weeks = null,
      planning_timezone = p_planning_timezone,
      deadline = p_deadline,
      duration = p_duration,
      updated_at = now()
  where id = p_goal_id and user_id = p_user_id;

  insert into public.milestones (goal_id, title, description, sort_order, deadline, status)
  select p_goal_id,
         nullif(trim(item.title), ''),
         nullif(trim(item.description), ''),
         item.sort_order,
         p_deadline,
         case when item.sort_order = 0 then 'in_progress' else 'pending' end
  from jsonb_to_recordset(coalesce(p_milestones, '[]'::jsonb)) as item(
    title text,
    description text,
    sort_order integer
  );

  with inserted_items as (
    insert into public.goal_plan_items (
      goal_id, user_id, plan_version, week_number, day_of_week,
      scheduled_at, task, purpose, target_metric, duration_minutes, status
    )
    select p_goal_id, p_user_id, p_plan_version,
           item.week_number, item.day_of_week, item.scheduled_at,
           item.task, item.purpose, item.target_metric,
           greatest(5, item.duration_minutes), 'scheduled'
    from jsonb_to_recordset(p_execution_items) as item(
      week_number integer,
      day_of_week text,
      scheduled_at timestamptz,
      task text,
      purpose text,
      target_metric text,
      duration_minutes integer,
      notes text
    )
    returning task, purpose, target_metric, scheduled_at, duration_minutes
  )
  insert into public.sessions (
    goal_id, user_id, title, scheduled_at, duration_minutes,
    status, plan_version, notes
  )
  select p_goal_id, p_user_id, item.task, item.scheduled_at,
         item.duration_minutes, 'scheduled', p_plan_version,
         jsonb_build_object(
           'purpose', item.purpose,
           'target', item.target_metric,
           'evidence', source.notes
         )::text
  from inserted_items item
  join jsonb_to_recordset(p_execution_items) as source(
    week_number integer,
    day_of_week text,
    scheduled_at timestamptz,
    task text,
    purpose text,
    target_metric text,
    duration_minutes integer,
    notes text
  ) on source.task = item.task and source.scheduled_at = item.scheduled_at;

  return true;
end;
$$;

revoke all on function public.lock_in_goal_plan(uuid, uuid, text, text, text, jsonb, jsonb, integer, timestamptz, text, date, text, jsonb, jsonb) from public, anon;
grant execute on function public.lock_in_goal_plan(uuid, uuid, text, text, text, jsonb, jsonb, integer, timestamptz, text, date, text, jsonb, jsonb) to authenticated;
