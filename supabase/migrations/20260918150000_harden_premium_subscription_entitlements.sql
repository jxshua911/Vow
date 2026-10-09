-- P2: harden premium entitlement and subscription state.
-- Clients may read their own subscription/entitlement state; only trusted
-- server-side verification may mutate it.

create index if not exists idx_vow_user_entitlements_active
  on public.vow_user_entitlements (user_id, status, current_period_end desc);
create index if not exists idx_user_entitlements_active
  on public.user_entitlements (user_id, plan, status, expires_at desc);

revoke insert, update, delete on public.user_entitlements from anon, authenticated;
revoke insert, update, delete on public.vow_user_entitlements from anon, authenticated;
revoke insert, update, delete on public.vow_payment_events from anon, authenticated;

create table if not exists public.vow_subscription_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google_play','apple','stripe','manual')),
  product_id text not null,
  billing_period text not null check (billing_period in ('monthly','yearly')),
  provider_purchase_id text,
  provider_event_id text,
  status text not null check (status in ('active','grace','paused','cancelled','expired','pending','revoked')),
  purchased_at timestamptz,
  current_period_end timestamptz,
  auto_renewing boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_purchase_id),
  unique (provider, provider_event_id)
);

create index if not exists idx_vow_subscription_records_user
  on public.vow_subscription_records (user_id, status, current_period_end desc);

alter table public.vow_subscription_records enable row level security;
revoke all on public.vow_subscription_records from anon;
revoke insert, update, delete on public.vow_subscription_records from authenticated;
grant select on public.vow_subscription_records to authenticated;

drop policy if exists "Users can read their own subscription records" on public.vow_subscription_records;
create policy "Users can read their own subscription records"
on public.vow_subscription_records
for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.vow_set_subscription_record(
  p_user_id uuid,
  p_provider text,
  p_product_id text,
  p_billing_period text,
  p_provider_purchase_id text,
  p_provider_event_id text,
  p_status text,
  p_purchased_at timestamptz,
  p_current_period_end timestamptz,
  p_auto_renewing boolean
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_id uuid;
begin
  if p_user_id is null
     or p_provider not in ('google_play','apple','stripe','manual')
     or p_billing_period not in ('monthly','yearly')
     or p_status not in ('active','grace','paused','cancelled','expired','pending','revoked')
     or p_product_id is null
     or length(p_product_id) > 200
  then raise exception 'INVALID_SUBSCRIPTION_RECORD'; end if;

  insert into public.vow_subscription_records
    (user_id,provider,product_id,billing_period,provider_purchase_id,provider_event_id,
     status,purchased_at,current_period_end,auto_renewing)
  values
    (p_user_id,p_provider,p_product_id,p_billing_period,nullif(p_provider_purchase_id,''),
     nullif(p_provider_event_id,''),p_status,p_purchased_at,p_current_period_end,p_auto_renewing)
  on conflict (provider, provider_purchase_id) do update set
    product_id=excluded.product_id,
    billing_period=excluded.billing_period,
    provider_event_id=coalesce(excluded.provider_event_id,public.vow_subscription_records.provider_event_id),
    status=excluded.status,
    purchased_at=excluded.purchased_at,
    current_period_end=excluded.current_period_end,
    auto_renewing=excluded.auto_renewing,
    updated_at=now()
  returning id into v_id;

  if v_id is null and p_provider_event_id is not null then
    select id into v_id from public.vow_subscription_records
    where provider=p_provider and provider_event_id=p_provider_event_id limit 1;
  end if;

  if v_id is null then raise exception 'SUBSCRIPTION_RECORD_WRITE_FAILED'; end if;

  insert into public.vow_payment_events
    (user_id,provider,provider_event_id,event_type,amount_minor,currency,status,metadata)
  values
    (p_user_id,p_provider,coalesce(nullif(p_provider_event_id,''),'subscription:'||v_id::text),
     'subscription_state',null,null,p_status,
     jsonb_build_object('product_id',p_product_id,'billing_period',p_billing_period))
  on conflict (provider, provider_event_id) do nothing;

  insert into public.vow_user_entitlements
    (user_id,plan,status,provider,current_period_end,updated_at)
  values
    (p_user_id,
     case when p_status in ('active','grace') then 'premium' else 'free' end,
     case when p_status in ('active','grace')
                and (p_current_period_end is null or p_current_period_end > now())
          then 'active' else 'inactive' end,
     p_provider,p_current_period_end,now())
  on conflict (user_id) do update set
    plan=excluded.plan,
    status=excluded.status,
    provider=excluded.provider,
    current_period_end=excluded.current_period_end,
    updated_at=now();

  return v_id;
end;
$$;

revoke all on function public.vow_set_subscription_record(
  uuid,text,text,text,text,text,text,timestamptz,timestamptz,boolean
) from public, anon, authenticated;
grant execute on function public.vow_set_subscription_record(
  uuid,text,text,text,text,text,text,timestamptz,timestamptz,boolean
) to service_role;

create or replace function public.vow_get_effective_entitlement()
returns table(plan text,status text,provider text,current_period_end timestamptz)
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select e.plan,
    case when e.status='active'
              and (e.current_period_end is null or e.current_period_end > now())
         then 'active' else 'inactive' end,
    e.provider,e.current_period_end
  from public.vow_user_entitlements e
  where e.user_id=(select auth.uid())
  limit 1
$$;

revoke all on function public.vow_get_effective_entitlement() from public, anon;
grant execute on function public.vow_get_effective_entitlement() to authenticated;