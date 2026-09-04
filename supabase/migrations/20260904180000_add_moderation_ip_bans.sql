create table if not exists public.moderation_ip_bans (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null unique,
  user_id uuid null references auth.users(id) on delete set null,
  banned_until timestamptz null,
  reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists moderation_ip_bans_banned_until_idx on public.moderation_ip_bans (banned_until);
create index if not exists moderation_ip_bans_user_id_idx on public.moderation_ip_bans (user_id);

alter table public.moderation_ip_bans enable row level security;
revoke all on table public.moderation_ip_bans from anon, authenticated;

comment on table public.moderation_ip_bans is 'Private hashed-IP moderation bans. Access is restricted to trusted server-side code.';

create or replace function public.set_moderation_ip_bans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_moderation_ip_bans_updated_at on public.moderation_ip_bans;
create trigger trg_moderation_ip_bans_updated_at
before update on public.moderation_ip_bans
for each row execute procedure public.set_moderation_ip_bans_updated_at();
