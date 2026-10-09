begin;

create table if not exists public.vow_ai_request_cooldowns (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('plan', 'clarify', 'chat')),
  claimed_at timestamptz not null,
  primary key (user_id, kind)
);

alter table public.vow_ai_request_cooldowns enable row level security;
revoke all on table public.vow_ai_request_cooldowns from public, anon, authenticated;

create or replace function public.vow_claim_ai_cooldown(
  p_user_id uuid,
  p_kind text,
  p_cooldown_seconds integer
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_claimed_at timestamptz;
begin
  if p_user_id is null
     or p_kind is null
     or p_kind not in ('plan', 'clarify', 'chat')
     or p_cooldown_seconds is null
     or p_cooldown_seconds < 0
     or p_cooldown_seconds > 3600 then
    raise exception 'Invalid AI cooldown request';
  end if;

  insert into public.vow_ai_request_cooldowns as existing (user_id, kind, claimed_at)
  values (p_user_id, p_kind, v_now)
  on conflict (user_id, kind) do update
  set claimed_at = excluded.claimed_at
  where existing.claimed_at <= excluded.claimed_at
    - make_interval(secs => p_cooldown_seconds)
  returning existing.claimed_at into v_claimed_at;

  if found then
    return 0;
  end if;

  select claimed_at into strict v_claimed_at
  from public.vow_ai_request_cooldowns
  where user_id = p_user_id and kind = p_kind;

  return greatest(
    0,
    ceil(extract(epoch from (
      v_claimed_at + make_interval(secs => p_cooldown_seconds) - clock_timestamp()
    )))::integer
  );
end;
$$;

revoke all on function public.vow_claim_ai_cooldown(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.vow_claim_ai_cooldown(uuid, text, integer)
  to service_role;

commit;
