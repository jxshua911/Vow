-- Move AI guardrail and trusted usage writes behind server-only RPCs.
-- The Edge Function verifies the user's JWT and supplies the derived user ID.
-- The service-role key is never exposed to clients.

begin;

alter table public.vow_ai_request_leases
  add column if not exists parent_request_id uuid;

create index if not exists vow_ai_request_leases_parent_request_idx
  on public.vow_ai_request_leases (parent_request_id);

alter table public.vow_ai_usage_events
  add column if not exists request_id uuid;

create unique index if not exists vow_ai_usage_events_request_id_uidx
  on public.vow_ai_usage_events (request_id)
  where request_id is not null;

create or replace function public.vow_claim_ai_guardrail_internal(
  p_request_id uuid,
  p_parent_request_id uuid,
  p_user_id uuid,
  p_reservation_usd numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := p_user_id;
  v_cfg public.vow_ai_guardrail_config%rowtype;
  v_now timestamptz := pg_catalog.now();
  v_day timestamptz := pg_catalog.date_trunc('day', v_now);
  v_month timestamptz := pg_catalog.date_trunc('month', v_now);
  v_reservation numeric(12,6);
  v_user_day public.vow_ai_budget_buckets%rowtype;
  v_user_month public.vow_ai_budget_buckets%rowtype;
  v_global_day public.vow_ai_budget_buckets%rowtype;
  v_global_month public.vow_ai_budget_buckets%rowtype;
  v_active integer;
  v_existing_user_id uuid;
  v_existing_expiry timestamptz;
begin
  if v_user_id is null then
    return pg_catalog.jsonb_build_object('allowed', false, 'code', 'USER_ID_REQUIRED');
  end if;
  if p_request_id is null or p_parent_request_id is null then
    return pg_catalog.jsonb_build_object('allowed', false, 'code', 'REQUEST_ID_REQUIRED');
  end if;

  select * into v_cfg
  from public.vow_ai_guardrail_config
  where id = true
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('allowed', false, 'code', 'GUARDRAIL_CONFIG_MISSING');
  end if;

  -- The configured default is a floor; the daily global budget is the ceiling.
  -- The only caller is the trusted Edge Function, not a client-controlled RPC.
  v_reservation := least(
    greatest(
      coalesce(p_reservation_usd, v_cfg.default_reservation_usd),
      v_cfg.default_reservation_usd
    ),
    v_cfg.global_daily_budget_usd
  );

  delete from public.vow_ai_request_leases
  where expires_at <= v_now;

  select user_id, expires_at
  into v_existing_user_id, v_existing_expiry
  from public.vow_ai_request_leases
  where request_id = p_request_id;

  if found then
    if v_existing_user_id = v_user_id and v_existing_expiry > v_now then
      return pg_catalog.jsonb_build_object('allowed', true, 'idempotent', true);
    end if;
    return pg_catalog.jsonb_build_object('allowed', false, 'code', 'REQUEST_ID_CONFLICT');
  end if;

  select count(*)::integer into v_active
  from public.vow_ai_request_leases
  where user_id = v_user_id and expires_at > v_now;

  if v_active >= v_cfg.max_concurrent_user_requests then
    return pg_catalog.jsonb_build_object(
      'allowed', false,
      'code', 'AI_CONCURRENCY_LIMIT',
      'retry_after_seconds', 15
    );
  end if;

  insert into public.vow_ai_budget_buckets (bucket_key)
  values
    ('user:' || v_user_id::text || ':day:' || pg_catalog.to_char(v_day, 'YYYY-MM-DD')),
    ('user:' || v_user_id::text || ':month:' || pg_catalog.to_char(v_month, 'YYYY-MM')),
    ('global:day:' || pg_catalog.to_char(v_day, 'YYYY-MM-DD')),
    ('global:month:' || pg_catalog.to_char(v_month, 'YYYY-MM'))
  on conflict (bucket_key) do nothing;

  select * into v_user_day
  from public.vow_ai_budget_buckets
  where bucket_key = 'user:' || v_user_id::text || ':day:' || pg_catalog.to_char(v_day, 'YYYY-MM-DD')
  for update;

  select * into v_user_month
  from public.vow_ai_budget_buckets
  where bucket_key = 'user:' || v_user_id::text || ':month:' || pg_catalog.to_char(v_month, 'YYYY-MM')
  for update;

  select * into v_global_day
  from public.vow_ai_budget_buckets
  where bucket_key = 'global:day:' || pg_catalog.to_char(v_day, 'YYYY-MM-DD')
  for update;

  select * into v_global_month
  from public.vow_ai_budget_buckets
  where bucket_key = 'global:month:' || pg_catalog.to_char(v_month, 'YYYY-MM')
  for update;

  if v_user_day.request_count >= v_cfg.daily_user_requests then
    return pg_catalog.jsonb_build_object('allowed', false, 'code', 'AI_USER_DAILY_LIMIT');
  end if;
  if v_user_month.request_count >= v_cfg.monthly_user_requests then
    return pg_catalog.jsonb_build_object('allowed', false, 'code', 'AI_USER_MONTHLY_LIMIT');
  end if;
  if v_global_day.request_count >= v_cfg.daily_global_requests
     or v_global_day.reserved_cost_usd + v_reservation > v_cfg.global_daily_budget_usd then
    return pg_catalog.jsonb_build_object('allowed', false, 'code', 'AI_GLOBAL_DAILY_BUDGET');
  end if;
  if v_global_month.request_count >= v_cfg.monthly_global_requests
     or v_global_month.reserved_cost_usd + v_reservation > v_cfg.global_monthly_budget_usd then
    return pg_catalog.jsonb_build_object('allowed', false, 'code', 'AI_GLOBAL_MONTHLY_BUDGET');
  end if;

  update public.vow_ai_budget_buckets
  set request_count = request_count + 1,
      reserved_cost_usd = reserved_cost_usd + v_reservation,
      updated_at = v_now
  where bucket_key in (
    'user:' || v_user_id::text || ':day:' || pg_catalog.to_char(v_day, 'YYYY-MM-DD'),
    'user:' || v_user_id::text || ':month:' || pg_catalog.to_char(v_month, 'YYYY-MM'),
    'global:day:' || pg_catalog.to_char(v_day, 'YYYY-MM-DD'),
    'global:month:' || pg_catalog.to_char(v_month, 'YYYY-MM')
  );

  insert into public.vow_ai_request_leases (
    request_id, parent_request_id, user_id, expires_at
  )
  values (
    p_request_id,
    p_parent_request_id,
    v_user_id,
    v_now + pg_catalog.make_interval(secs => v_cfg.lease_seconds)
  );

  return pg_catalog.jsonb_build_object(
    'allowed', true,
    'reservation_usd', v_reservation,
    'lease_seconds', v_cfg.lease_seconds
  );
end;
$function$;

create or replace function public.vow_release_ai_guardrail_internal(
  p_request_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_request_id is null or p_user_id is null then
    return;
  end if;

  -- This releases the concurrency lease. The current budget buckets are
  -- cumulative conservative reservations and are not refunded by this call.
  delete from public.vow_ai_request_leases
  where request_id = p_request_id
    and user_id = p_user_id;
end;
$function$;

create or replace function public.vow_record_ai_usage_internal(
  p_request_id uuid,
  p_user_id uuid,
  p_mode text,
  p_outcome text,
  p_latency_ms integer default null,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_request_id is null or p_user_id is null then
    raise exception 'request_id and user_id are required'
      using errcode = '22023';
  end if;

  if p_mode is null or p_mode not in ('goal-clarify', 'goal-plan', 'chat') then
    raise exception 'invalid AI usage mode'
      using errcode = '22023';
  end if;

  if p_outcome is null or p_outcome not in ('success', 'error', 'blocked') then
    raise exception 'invalid AI usage outcome'
      using errcode = '22023';
  end if;

  if p_latency_ms is not null and (p_latency_ms < 0 or p_latency_ms > 600000) then
    raise exception 'invalid AI usage latency'
      using errcode = '22023';
  end if;

  insert into public.vow_ai_usage_events (
    request_id, user_id, mode, outcome, latency_ms, error_code
  )
  values (
    p_request_id,
    p_user_id,
    p_mode,
    p_outcome,
    p_latency_ms,
    nullif(pg_catalog.left(coalesce(p_error_code, ''), 64), '')
  )
  on conflict (request_id) do nothing;
end;
$function$;

revoke all on function public.vow_claim_ai_guardrail_internal(uuid, uuid, uuid, numeric)
  from public, anon, authenticated;
revoke all on function public.vow_release_ai_guardrail_internal(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.vow_record_ai_usage_internal(uuid, uuid, text, text, integer, text)
  from public, anon, authenticated;

grant execute on function public.vow_claim_ai_guardrail_internal(uuid, uuid, uuid, numeric)
  to service_role;
grant execute on function public.vow_release_ai_guardrail_internal(uuid, uuid)
  to service_role;
grant execute on function public.vow_record_ai_usage_internal(uuid, uuid, text, text, integer, text)
  to service_role;

create or replace function public.vow_get_entitlement_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_plan text := 'free';
  v_status text := 'inactive';
  v_active_goals integer := 0;
  v_planning_used integer := 0;
  v_adaptive_used integer := 0;
  v_review_used integer := 0;
  v_period date := date_trunc('month', now())::date;
begin
  if v_user_id is null then return null; end if;

  select plan, status into v_plan, v_status
  from public.vow_get_effective_entitlement()
  limit 1;

  select count(*)::integer into v_active_goals
  from public.goals
  where user_id = v_user_id and status in ('active', 'locked');

  select count(*)::integer into v_planning_used
  from public.vow_entitlement_usage
  where user_id = v_user_id and feature = 'planning_action' and period_start = v_period;

  select v_planning_used + count(*)::integer into v_planning_used
  from public.vow_entitlement_reservations
  where user_id = v_user_id and feature = 'planning_action'
    and period_start = v_period and status = 'reserved' and expires_at > now();

  select count(*)::integer into v_adaptive_used
  from public.vow_entitlement_usage
  where user_id = v_user_id and feature = 'adaptive_replan' and period_start = v_period;

  select v_adaptive_used + count(*)::integer into v_adaptive_used
  from public.vow_entitlement_reservations
  where user_id = v_user_id and feature = 'adaptive_replan'
    and period_start = v_period and status = 'reserved' and expires_at > now();

  select count(*)::integer into v_review_used
  from public.reviews
  where user_id = v_user_id and created_at >= date_trunc('month', now());

  return pg_catalog.jsonb_build_object(
    'plan', case when v_status = 'active' and v_plan = 'premium' then 'premium' else 'free' end,
    'active_goals', v_active_goals,
    'active_goal_limit', case when v_status = 'active' and v_plan = 'premium' then null else 1 end,
    'planning_used', v_planning_used,
    'planning_limit', case when v_status = 'active' and v_plan = 'premium' then null else 3 end,
    'adaptive_replans_used', v_adaptive_used,
    'adaptive_replans_limit', case when v_status = 'active' and v_plan = 'premium' then null else 1 end,
    'advanced_reviews_used', v_review_used,
    'advanced_reviews_limit', case when v_status = 'active' and v_plan = 'premium' then null else 1 end,
    'period_start', v_period
  );
end;
$function$;

revoke all on function public.vow_get_entitlement_snapshot() from public;
grant execute on function public.vow_get_entitlement_snapshot() to authenticated;

commit;

notify pgrst, 'reload schema';
