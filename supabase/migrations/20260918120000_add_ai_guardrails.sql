-- Launch-grade AI guardrails: per-user quotas, concurrency leases, and global budget reservations.
-- Limits are configuration data so they can be tuned without rebuilding the app.

create table if not exists public.vow_ai_guardrail_config (
  id boolean primary key default true check (id = true),
  daily_user_requests integer not null default 25,
  monthly_user_requests integer not null default 300,
  daily_global_requests integer not null default 500,
  monthly_global_requests integer not null default 10000,
  max_concurrent_user_requests integer not null default 2,
  global_daily_budget_usd numeric(12,6) not null default 5,
  global_monthly_budget_usd numeric(12,6) not null default 100,
  default_reservation_usd numeric(12,6) not null default 0.01,
  lease_seconds integer not null default 90,
  updated_at timestamptz not null default now(),
  constraint vow_ai_guardrail_config_positive check (
    daily_user_requests > 0
    and monthly_user_requests >= daily_user_requests
    and daily_global_requests > 0
    and monthly_global_requests >= daily_global_requests
    and max_concurrent_user_requests > 0
    and global_daily_budget_usd > 0
    and global_monthly_budget_usd >= global_daily_budget_usd
    and default_reservation_usd > 0
    and lease_seconds between 15 and 600
  )
);

insert into public.vow_ai_guardrail_config (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.vow_ai_budget_buckets (
  bucket_key text primary key,
  request_count bigint not null default 0,
  reserved_cost_usd numeric(12,6) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.vow_ai_request_leases (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

revoke all on public.vow_ai_guardrail_config from public, anon, authenticated;
revoke all on public.vow_ai_budget_buckets from public, anon, authenticated;
revoke all on public.vow_ai_request_leases from public, anon, authenticated;

create or replace function public.vow_claim_ai_guardrail(
  p_request_id uuid,
  p_reservation_usd numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cfg public.vow_ai_guardrail_config%rowtype;
  v_now timestamptz := now();
  v_day timestamptz := date_trunc('day', v_now);
  v_month timestamptz := date_trunc('month', v_now);
  v_reservation numeric(12,6);
  v_user_day public.vow_ai_budget_buckets%rowtype;
  v_user_month public.vow_ai_budget_buckets%rowtype;
  v_global_day public.vow_ai_budget_buckets%rowtype;
  v_global_month public.vow_ai_budget_buckets%rowtype;
  v_active integer;
begin
  if v_user_id is null then
    return jsonb_build_object('allowed', false, 'code', 'AUTH_REQUIRED');
  end if;

  if p_request_id is null then
    return jsonb_build_object('allowed', false, 'code', 'REQUEST_ID_REQUIRED');
  end if;

  select * into v_cfg
  from public.vow_ai_guardrail_config
  where id = true
  for update;

  if not found then
    return jsonb_build_object('allowed', false, 'code', 'GUARDRAIL_CONFIG_MISSING');
  end if;

  v_reservation := coalesce(p_reservation_usd, v_cfg.default_reservation_usd);
  if v_reservation <= 0 then
    return jsonb_build_object('allowed', false, 'code', 'INVALID_RESERVATION');
  end if;

  delete from public.vow_ai_request_leases
  where expires_at <= v_now;

  if exists (
    select 1 from public.vow_ai_request_leases
    where request_id = p_request_id
      and user_id = v_user_id
  ) then
    return jsonb_build_object('allowed', true, 'idempotent', true);
  end if;

  select count(*)::integer into v_active
  from public.vow_ai_request_leases
  where user_id = v_user_id
    and expires_at > v_now;

  if v_active >= v_cfg.max_concurrent_user_requests then
    return jsonb_build_object(
      'allowed', false,
      'code', 'AI_CONCURRENCY_LIMIT',
      'retry_after_seconds', 15
    );
  end if;

  insert into public.vow_ai_budget_buckets (bucket_key)
  values
    ('user:' || v_user_id::text || ':day:' || to_char(v_day, 'YYYY-MM-DD')),
    ('user:' || v_user_id::text || ':month:' || to_char(v_month, 'YYYY-MM')),
    ('global:day:' || to_char(v_day, 'YYYY-MM-DD')),
    ('global:month:' || to_char(v_month, 'YYYY-MM'))
  on conflict (bucket_key) do nothing;

  select * into v_user_day
  from public.vow_ai_budget_buckets
  where bucket_key = 'user:' || v_user_id::text || ':day:' || to_char(v_day, 'YYYY-MM-DD')
  for update;

  select * into v_user_month
  from public.vow_ai_budget_buckets
  where bucket_key = 'user:' || v_user_id::text || ':month:' || to_char(v_month, 'YYYY-MM')
  for update;

  select * into v_global_day
  from public.vow_ai_budget_buckets
  where bucket_key = 'global:day:' || to_char(v_day, 'YYYY-MM-DD')
  for update;

  select * into v_global_month
  from public.vow_ai_budget_buckets
  where bucket_key = 'global:month:' || to_char(v_month, 'YYYY-MM')
  for update;

  if v_user_day.request_count >= v_cfg.daily_user_requests then
    return jsonb_build_object('allowed', false, 'code', 'AI_USER_DAILY_LIMIT');
  end if;

  if v_user_month.request_count >= v_cfg.monthly_user_requests then
    return jsonb_build_object('allowed', false, 'code', 'AI_USER_MONTHLY_LIMIT');
  end if;

  if v_global_day.request_count >= v_cfg.daily_global_requests
     or v_global_day.reserved_cost_usd + v_reservation > v_cfg.global_daily_budget_usd then
    return jsonb_build_object('allowed', false, 'code', 'AI_GLOBAL_DAILY_BUDGET');
  end if;

  if v_global_month.request_count >= v_cfg.monthly_global_requests
     or v_global_month.reserved_cost_usd + v_reservation > v_cfg.global_monthly_budget_usd then
    return jsonb_build_object('allowed', false, 'code', 'AI_GLOBAL_MONTHLY_BUDGET');
  end if;

  update public.vow_ai_budget_buckets
  set request_count = request_count + 1,
      reserved_cost_usd = reserved_cost_usd + v_reservation,
      updated_at = v_now
  where bucket_key in (
    'user:' || v_user_id::text || ':day:' || to_char(v_day, 'YYYY-MM-DD'),
    'user:' || v_user_id::text || ':month:' || to_char(v_month, 'YYYY-MM'),
    'global:day:' || to_char(v_day, 'YYYY-MM-DD'),
    'global:month:' || to_char(v_month, 'YYYY-MM')
  );

  insert into public.vow_ai_request_leases (request_id, user_id, expires_at)
  values (p_request_id, v_user_id, v_now + make_interval(secs => v_cfg.lease_seconds));

  return jsonb_build_object(
    'allowed', true,
    'reservation_usd', v_reservation,
    'lease_seconds', v_cfg.lease_seconds
  );
end;
$$;

create or replace function public.vow_release_ai_guardrail(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  delete from public.vow_ai_request_leases
  where request_id = p_request_id
    and user_id = auth.uid();
end;
$$;

revoke all on function public.vow_claim_ai_guardrail(uuid, numeric) from public, anon;
revoke all on function public.vow_release_ai_guardrail(uuid) from public, anon;
grant execute on function public.vow_claim_ai_guardrail(uuid, numeric) to authenticated;
grant execute on function public.vow_release_ai_guardrail(uuid) to authenticated;

comment on table public.vow_ai_guardrail_config is
  'Runtime-configurable VOW AI safety limits. Tune with reviewed database changes; do not rely on client enforcement.';
