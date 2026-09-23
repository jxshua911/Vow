-- Strengthen the transactional plan-lock RPC so clients cannot bypass plan-quality invariants.
create or replace function public.lock_goal_plan(p_goal_id uuid, p_goal jsonb, p_milestones jsonb, p_plan_items jsonb, p_sessions jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  milestone_ids uuid[] := array[]::uuid[];
  item jsonb;
  session_item jsonb;
  inserted_id uuid;
  idx integer := 0;
  goal_exists boolean;
  locked_plan jsonb;
  execution_count integer := 0;
  milestone_count integer := 0;
  session_count integer := 0;
  horizon integer;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_goal_id is null or p_goal is null or jsonb_typeof(p_goal) <> 'object' then raise exception 'INVALID_GOAL'; end if;
  if coalesce(p_goal->>'status','active') <> 'active' then raise exception 'INVALID_GOAL_STATUS'; end if;
  select exists(select 1 from public.goals where id = p_goal_id and user_id = uid) into goal_exists;
  if not goal_exists then raise exception 'GOAL_NOT_FOUND'; end if;
  locked_plan := p_goal->'plan_json';
  if locked_plan is null or jsonb_typeof(locked_plan) <> 'object' then raise exception 'PLAN_REQUIRED'; end if;
  horizon := greatest(1, least(52, coalesce((p_goal->>'planning_horizon_weeks')::integer, (locked_plan->>'duration_weeks')::integer, 8)));
  if coalesce((locked_plan->>'duration_weeks')::integer, horizon) <> horizon then raise exception 'PLAN_DURATION_MISMATCH'; end if;
  milestone_count := jsonb_array_length(coalesce(p_milestones,'[]'::jsonb));
  execution_count := jsonb_array_length(coalesce(p_plan_items,'[]'::jsonb));
  session_count := jsonb_array_length(coalesce(p_sessions,'[]'::jsonb));
  if milestone_count < 2 or milestone_count > 12 then raise exception 'MILESTONE_COUNT_INVALID'; end if;
  if execution_count < 1 or execution_count > 364 then raise exception 'PLAN_ITEM_COUNT_INVALID'; end if;
  if session_count <> execution_count then raise exception 'EXECUTION_COUNT_MISMATCH'; end if;
  for item in select value from jsonb_array_elements(coalesce(p_milestones,'[]'::jsonb)) loop
    if nullif(trim(item->>'title'),'') is null or nullif(trim(item->>'description'),'') is null then raise exception 'MILESTONE_QUALITY_REJECTED'; end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(p_plan_items,'[]'::jsonb)) loop
    if nullif(trim(item->>'task'),'') is null or nullif(trim(item->>'purpose'),'') is null or nullif(trim(item->>'target_metric'),'') is null then raise exception 'PLAN_ITEM_QUALITY_REJECTED'; end if;
    if coalesce((item->>'week_number')::integer,0) < 1 or coalesce((item->>'week_number')::integer,0) > horizon then raise exception 'PLAN_ITEM_WEEK_INVALID'; end if;
    if nullif(trim(item->>'day_of_week'),'') is null or nullif(trim(item->>'scheduled_at'),'') is null then raise exception 'PLAN_ITEM_SCHEDULE_INVALID'; end if;
    if coalesce((item->>'duration_minutes')::integer,30) < 5 or coalesce((item->>'duration_minutes')::integer,30) > 240 then raise exception 'PLAN_ITEM_DURATION_INVALID'; end if;
  end loop;
  for session_item in select value from jsonb_array_elements(coalesce(p_sessions,'[]'::jsonb)) loop
    if nullif(trim(session_item->>'title'),'') is null or nullif(trim(session_item->>'scheduled_at'),'') is null then raise exception 'SESSION_QUALITY_REJECTED'; end if;
    if coalesce((session_item->>'duration_minutes')::integer,30) < 5 or coalesce((session_item->>'duration_minutes')::integer,30) > 240 then raise exception 'SESSION_DURATION_INVALID'; end if;
  end loop;
  update public.goals
  set title = coalesce(p_goal->>'title', title), outcome = coalesce(p_goal->>'outcome', outcome), why_it_matters = nullif(p_goal->>'why_it_matters',''),
      start_date = nullif(p_goal->>'start_date','')::date, deadline = nullif(p_goal->>'deadline','')::date, duration = coalesce(p_goal->>'duration', duration),
      status = 'active', weekly_commitment_target = coalesce((p_goal->>'weekly_commitment_target')::integer, weekly_commitment_target),
      armadillo = coalesce(p_goal->'armadillo', armadillo), armadillo_analyzed_at = coalesce(nullif(p_goal->>'armadillo_analyzed_at','')::timestamptz, armadillo_analyzed_at),
      plan_json = locked_plan, plan_version = coalesce((p_goal->>'plan_version')::integer, plan_version),
      plan_generated_at = coalesce(nullif(p_goal->>'plan_generated_at','')::timestamptz, plan_generated_at),
      planning_horizon_weeks = horizon, planning_timezone = coalesce(p_goal->>'planning_timezone', planning_timezone), updated_at = now()
  where id = p_goal_id and user_id = uid
  returning plan_json into locked_plan;
  if locked_plan is null then raise exception 'PLAN_REQUIRED'; end if;
  delete from public.goal_plan_items where goal_id=p_goal_id and user_id=uid;
  delete from public.sessions where goal_id=p_goal_id and user_id=uid;
  delete from public.milestones where goal_id=p_goal_id and user_id=uid;
  for item in select value from jsonb_array_elements(coalesce(p_milestones,'[]'::jsonb)) loop
    insert into public.milestones(goal_id,title,description,sort_order,deadline,status)
    values(p_goal_id,item->>'title',item->>'description',coalesce((item->>'sort_order')::integer,idx),nullif(item->>'deadline','')::date,coalesce(item->>'status','pending'))
    returning id into inserted_id;
    milestone_ids:=array_append(milestone_ids,inserted_id); idx:=idx+1;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(p_plan_items,'[]'::jsonb)) loop
    insert into public.goal_plan_items(goal_id,plan_version,week_number,day_of_week,scheduled_at,task,purpose,target_metric,duration_minutes,status)
    values(p_goal_id,coalesce((item->>'plan_version')::integer,1),(item->>'week_number')::integer,item->>'day_of_week',nullif(item->>'scheduled_at','')::timestamptz,item->>'task',nullif(item->>'purpose',''),nullif(item->>'target_metric',''),coalesce((item->>'duration_minutes')::integer,30),coalesce(item->>'status','scheduled'));
  end loop;
  for session_item in select value from jsonb_array_elements(coalesce(p_sessions,'[]'::jsonb)) loop
    idx:=coalesce((session_item->>'milestone_sort_order')::integer,0)+1;
    insert into public.sessions(goal_id,milestone_id,user_id,title,scheduled_at,duration_minutes,status,moved_count,notes,external_event_id)
    values(p_goal_id,case when idx between 1 and coalesce(array_length(milestone_ids,1),0) then milestone_ids[idx] else null end,uid,session_item->>'title',nullif(session_item->>'scheduled_at','')::timestamptz,coalesce((session_item->>'duration_minutes')::integer,30),coalesce(session_item->>'status','scheduled'),coalesce((session_item->>'moved_count')::integer,0),nullif(session_item->>'notes',''),nullif(session_item->>'external_event_id',''));
  end loop;
  return p_goal_id;
end;
$function$;
