begin;

drop function if exists public.vow_claim_ai_cooldown(uuid, text, integer);
drop function if exists public.vow_claim_ai_cooldown(uuid, text, numeric);
drop function if exists public.vow_claim_ai_cooldown(uuid, text);

drop table if exists public.vow_ai_request_cooldowns;

create table public.vow_ai_request_cooldowns (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('clarify', 'plan', 'chat', 'review')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind)
);

create index idx_vow_ai_request_cooldowns_expires_at
  on public.vow_ai_request_cooldowns(expires_at);

alter table public.vow_ai_request_cooldowns enable row level security;
revoke all on public.vow_ai_request_cooldowns from public, anon, authenticated;

create function public.vow_claim_ai_cooldown(
  p_user_id uuid,
  p_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_cooldown_seconds integer;
  v_expires_at timestamptz;
begin
  if p_user_id is null or p_kind is null then
    raise exception 'Invalid AI cooldown request';
  end if;

  v_cooldown_seconds := case p_kind
    when 'clarify' then 60
    when 'plan' then 60
    when 'chat' then 10
    when 'review' then 3600
    else null
  end;

  if v_cooldown_seconds is null then
    raise exception 'Invalid AI cooldown request';
  end if;

  insert into public.vow_ai_request_cooldowns as existing (
    user_id,
    kind,
    expires_at,
    created_at
  )
  values (
    p_user_id,
    p_kind,
    v_now + make_interval(secs => v_cooldown_seconds),
    v_now
  )
  on conflict (user_id, kind) do update
    set expires_at = excluded.expires_at,
        created_at = excluded.created_at
    where existing.expires_at <= v_now
  returning expires_at into v_expires_at;

  if found then
    return jsonb_build_object(
      'cooldown_seconds', 0,
      'is_active', false
    );
  end if;

  select expires_at
    into strict v_expires_at
    from public.vow_ai_request_cooldowns
   where user_id = p_user_id
     and kind = p_kind;

  return jsonb_build_object(
    'cooldown_seconds', greatest(
      0,
      ceil(extract(epoch from (v_expires_at - clock_timestamp())))::integer
    ),
    'is_active', true
  );
end;
$$;

revoke all on function public.vow_claim_ai_cooldown(uuid, text)
  from public, anon, authenticated;
grant execute on function public.vow_claim_ai_cooldown(uuid, text)
  to service_role;

commit;
