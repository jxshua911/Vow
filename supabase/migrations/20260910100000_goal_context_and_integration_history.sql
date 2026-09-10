-- Canonical goal context metadata and reusable integration history.
-- OAuth/provider credentials must remain in provider-specific secure storage; this table stores user-facing connection state only.

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  integration_id text not null,
  status text not null check (status in ('connected','disconnected')),
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_goal_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, integration_id)
);

create index if not exists integration_connections_user_status_idx
  on public.integration_connections(user_id, status);

alter table public.integration_connections enable row level security;

drop policy if exists "Users can read their integration history" on public.integration_connections;
create policy "Users can read their integration history"
  on public.integration_connections for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their integration history" on public.integration_connections;
create policy "Users can create their integration history"
  on public.integration_connections for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their integration history" on public.integration_connections;
create policy "Users can update their integration history"
  on public.integration_connections for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their integration history" on public.integration_connections;
create policy "Users can delete their integration history"
  on public.integration_connections for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.touch_integration_connection_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_integration_connection_updated_at on public.integration_connections;
create trigger trg_touch_integration_connection_updated_at before update on public.integration_connections for each row execute function public.touch_integration_connection_updated_at();
