create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  integration_id text not null,
  status text not null check (status in ('connected', 'disconnected')),
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_goal_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, integration_id)
);

alter table public.integration_connections enable row level security;

drop policy if exists "Users can read their integration connections" on public.integration_connections;
create policy "Users can read their integration connections"
  on public.integration_connections for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their integration connections" on public.integration_connections;
create policy "Users can insert their integration connections"
  on public.integration_connections for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their integration connections" on public.integration_connections;
create policy "Users can update their integration connections"
  on public.integration_connections for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their integration connections" on public.integration_connections;
create policy "Users can delete their integration connections"
  on public.integration_connections for delete to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists integration_connections_user_status_idx
  on public.integration_connections (user_id, status);

alter table public.goal_resources
  add column if not exists relevance_score numeric(5,4),
  add column if not exists goal_id uuid,
  add column if not exists plan_step text,
  add column if not exists difficulty text,
  add column if not exists reason_recommended text;

create index if not exists goal_resources_goal_created_idx
  on public.goal_resources (goal_id, created_at desc);

create index if not exists goal_resources_goal_relevance_idx
  on public.goal_resources (goal_id, relevance_score desc nulls last);

alter table public.goal_resources drop constraint if exists goal_resources_difficulty_check;
alter table public.goal_resources
  add constraint goal_resources_difficulty_check
  check (difficulty is null or difficulty in ('beginner', 'intermediate', 'advanced'));

comment on table public.integration_connections is 'Persistent connection state only; provider credentials/tokens must remain outside this table.';
comment on column public.goal_resources.relevance_score is 'Normalised 0..1 relevance score produced by the resource pipeline.';
comment on column public.goal_resources.plan_step is 'The plan step this resource is intended to support.';
comment on column public.goal_resources.reason_recommended is 'Human-readable explanation for why VOW surfaced the resource.';
