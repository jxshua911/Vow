-- VOW entitlement accounting: usage table is the source of truth for plan/adaptive usage.

create or replace function public.vow_get_entitlement_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'auth'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_plan text := 'free';
  v_status text := 'inactive';
  v_active_goals integer := 0;
  v_planning_used integer := 0;
  v_adaptive_used integer := 0;
  v_advanced_used integer := 0;
  v_period date := date_trunc('month', now())::date;
begin
  if v_user_id is null then
    return null;
  end if;

  select plan, status
    into v_plan, v_status
    from public.vow_get_effective_entitlement()
   limit 1;

  select count(*)::integer
    into v_active_goals
    from public.goals
   where user_id = v_user_id
     and status = 'active';

  select count(*)::integer
    into v_planning_used
    from public.vow_entitlement_usage
   where user_id = v_user_id
     and feature = 'planning_action'
     and period_start = v_period;

  select count(*)::integer
    into v_adaptive_used
    from public.vow_entitlement_usage
   where user_id = v_user_id
     and feature = 'adaptive_replan'
     and period_start = v_period;

  -- Advanced reviews remain a separate entitlement until review charging is
  -- explicitly moved to vow_entitlement_usage.
  select count(*)::integer
    into v_advanced_used
    from public.vow_ai_usage_events
   where user_id = v_user_id
     and mode = 'review'
     and outcome = 'success'
     and created_at >= date_trunc('month', now());

  return jsonb_build_object(
    'plan', case when v_status = 'active' and v_plan = 'premium' then 'premium' else 'free' end,
    'active_goals', v_active_goals,
    'active_goal_limit', case when v_status = 'active' and v_plan = 'premium' then null else 1 end,
    'planning_used', v_planning_used,
    'planning_limit', case when v_status = 'active' and v_plan = 'premium' then null else 10 end,
    'adaptive_replans_used', v_adaptive_used,
    'adaptive_replans_limit', case when v_status = 'active' and v_plan = 'premium' then null else 1 end,
    'advanced_reviews_used', v_advanced_used,
    'advanced_reviews_limit', case when v_status = 'active' and v_plan = 'premium' then null else 1 end,
    'period_start', v_period
  );
end;
$function$;
