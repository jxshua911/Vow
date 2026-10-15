-- Repair the live plan-lock RPC to match the current schema.
-- Ownership is checked against goals before child rows are replaced.
-- milestones is goal-scoped and has no user_id column; goal_plan_items.user_id is required.
CREATE OR REPLACE FUNCTION private.lock_goal_plan_secure(
  p_goal_id uuid,
  p_goal jsonb,
  p_milestones jsonb,
  p_plan_items jsonb,
  p_sessions jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
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
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_goal_id IS NULL OR p_goal IS NULL OR jsonb_typeof(p_goal) <> 'object' THEN RAISE EXCEPTION 'INVALID_GOAL'; END IF;
  IF coalesce(p_goal->>'status','active') <> 'active' THEN RAISE EXCEPTION 'INVALID_GOAL_STATUS'; END IF;

  SELECT EXISTS(SELECT 1 FROM public.goals WHERE id = p_goal_id AND user_id = uid) INTO goal_exists;
  IF NOT goal_exists THEN RAISE EXCEPTION 'GOAL_NOT_FOUND'; END IF;

  locked_plan := p_goal->'plan_json';
  IF locked_plan IS NULL OR jsonb_typeof(locked_plan) <> 'object' THEN RAISE EXCEPTION 'PLAN_REQUIRED'; END IF;

  horizon := greatest(1, least(52, coalesce((p_goal->>'planning_horizon_weeks')::integer, (locked_plan->>'duration_weeks')::integer, 8)));
  IF coalesce((locked_plan->>'duration_weeks')::integer, horizon) <> horizon THEN RAISE EXCEPTION 'PLAN_DURATION_MISMATCH'; END IF;

  milestone_count := jsonb_array_length(coalesce(p_milestones,'[]'::jsonb));
  execution_count := jsonb_array_length(coalesce(p_plan_items,'[]'::jsonb));
  session_count := jsonb_array_length(coalesce(p_sessions,'[]'::jsonb));
  IF milestone_count < 2 OR milestone_count > 12 THEN RAISE EXCEPTION 'MILESTONE_COUNT_INVALID'; END IF;
  IF execution_count < 1 OR execution_count > 364 THEN RAISE EXCEPTION 'PLAN_ITEM_COUNT_INVALID'; END IF;
  IF session_count <> execution_count THEN RAISE EXCEPTION 'EXECUTION_COUNT_MISMATCH'; END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_milestones,'[]'::jsonb)) LOOP
    IF nullif(trim(item->>'title'),'') IS NULL OR nullif(trim(item->>'description'),'') IS NULL THEN
      RAISE EXCEPTION 'MILESTONE_QUALITY_REJECTED';
    END IF;
    IF coalesce((item->>'week')::integer,1) < 1 OR coalesce((item->>'week')::integer,1) > horizon THEN
      RAISE EXCEPTION 'MILESTONE_WEEK_INVALID';
    END IF;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_plan_items,'[]'::jsonb)) LOOP
    IF nullif(trim(item->>'task'),'') IS NULL OR nullif(trim(item->>'purpose'),'') IS NULL OR nullif(trim(item->>'target_metric'),'') IS NULL THEN
      RAISE EXCEPTION 'PLAN_ITEM_QUALITY_REJECTED';
    END IF;
    IF coalesce((item->>'week_number')::integer,0) < 1 OR coalesce((item->>'week_number')::integer,0) > horizon THEN
      RAISE EXCEPTION 'PLAN_ITEM_WEEK_INVALID';
    END IF;
    IF nullif(trim(item->>'day_of_week'),'') IS NULL OR nullif(trim(item->>'scheduled_at'),'') IS NULL THEN
      RAISE EXCEPTION 'PLAN_ITEM_SCHEDULE_INVALID';
    END IF;
    IF coalesce((item->>'duration_minutes')::integer,30) < 5 OR coalesce((item->>'duration_minutes')::integer,30) > 240 THEN
      RAISE EXCEPTION 'PLAN_ITEM_DURATION_INVALID';
    END IF;
  END LOOP;

  FOR session_item IN SELECT value FROM jsonb_array_elements(coalesce(p_sessions,'[]'::jsonb)) LOOP
    IF nullif(trim(session_item->>'title'),'') IS NULL OR nullif(trim(session_item->>'scheduled_at'),'') IS NULL THEN
      RAISE EXCEPTION 'SESSION_QUALITY_REJECTED';
    END IF;
    IF coalesce((session_item->>'duration_minutes')::integer,30) < 5 OR coalesce((session_item->>'duration_minutes')::integer,30) > 240 THEN
      RAISE EXCEPTION 'SESSION_DURATION_INVALID';
    END IF;
  END LOOP;

  UPDATE public.goals
  SET title = coalesce(p_goal->>'title', title),
      outcome = coalesce(p_goal->>'outcome', outcome),
      why_it_matters = nullif(p_goal->>'why_it_matters',''),
      start_date = nullif(p_goal->>'start_date','')::date,
      deadline = nullif(p_goal->>'deadline','')::date,
      duration = coalesce(p_goal->>'duration', duration),
      status = 'active',
      weekly_commitment_target = coalesce((p_goal->>'weekly_commitment_target')::integer, weekly_commitment_target),
      armadillo = coalesce(p_goal->'armadillo', armadillo),
      armadillo_analyzed_at = coalesce(nullif(p_goal->>'armadillo_analyzed_at','')::timestamptz, armadillo_analyzed_at),
      plan_json = locked_plan,
      plan_version = coalesce((p_goal->>'plan_version')::integer, plan_version),
      plan_generated_at = coalesce(nullif(p_goal->>'plan_generated_at','')::timestamptz, plan_generated_at),
      planning_horizon_weeks = horizon,
      planning_timezone = coalesce(p_goal->>'planning_timezone', planning_timezone),
      goal_context_json = coalesce(goal_context_json, '{}'::jsonb),
      updated_at = now()
  WHERE id = p_goal_id AND user_id = uid
  RETURNING plan_json INTO locked_plan;

  IF locked_plan IS NULL THEN RAISE EXCEPTION 'PLAN_REQUIRED'; END IF;

  DELETE FROM public.goal_plan_items WHERE goal_id = p_goal_id AND user_id = uid;
  DELETE FROM public.sessions WHERE goal_id = p_goal_id AND user_id = uid;
  -- milestones has no user_id column. The goal ownership check above scopes this delete.
  DELETE FROM public.milestones WHERE goal_id = p_goal_id;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_milestones,'[]'::jsonb)) LOOP
    INSERT INTO public.milestones(goal_id,title,description,sort_order,deadline,status)
    VALUES(p_goal_id,item->>'title',item->>'description',coalesce((item->>'sort_order')::integer,idx),nullif(item->>'deadline','')::date,coalesce(item->>'status','pending'))
    RETURNING id INTO inserted_id;
    milestone_ids := array_append(milestone_ids, inserted_id);
    idx := idx + 1;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(p_plan_items,'[]'::jsonb)) LOOP
    INSERT INTO public.goal_plan_items(goal_id,user_id,plan_version,week_number,day_of_week,scheduled_at,task,purpose,target_metric,duration_minutes,status)
    VALUES(p_goal_id,uid,coalesce((item->>'plan_version')::integer,1),(item->>'week_number')::integer,item->>'day_of_week',nullif(item->>'scheduled_at','')::timestamptz,item->>'task',nullif(item->>'purpose',''),nullif(item->>'target_metric',''),coalesce((item->>'duration_minutes')::integer,30),coalesce(item->>'status','scheduled'));
  END LOOP;

  FOR session_item IN SELECT value FROM jsonb_array_elements(coalesce(p_sessions,'[]'::jsonb)) LOOP
    idx := coalesce((session_item->>'milestone_sort_order')::integer,0) + 1;
    INSERT INTO public.sessions(goal_id,milestone_id,user_id,title,scheduled_at,duration_minutes,status,moved_count,notes,external_event_id)
    VALUES(p_goal_id,CASE WHEN idx BETWEEN 1 AND coalesce(array_length(milestone_ids,1),0) THEN milestone_ids[idx] ELSE NULL END,uid,session_item->>'title',nullif(session_item->>'scheduled_at','')::timestamptz,coalesce((session_item->>'duration_minutes')::integer,30),coalesce(session_item->>'status','scheduled'),coalesce((session_item->>'moved_count')::integer,0),nullif(session_item->>'notes',''),nullif(session_item->>'external_event_id',''));
  END LOOP;

  RETURN p_goal_id;
END;
$function$;
