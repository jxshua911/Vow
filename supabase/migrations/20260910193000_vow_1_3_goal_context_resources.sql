-- VOW 1.3: resource metadata and persistent connection lifecycle support.
-- integration_connections already exists with last_goal_ids stored as jsonb; preserve that contract.

alter table public.integration_connections
  add column if not exists disconnected_at timestamptz;

drop policy if exists "Users can delete their integration connections" on public.integration_connections;
create policy "Users can delete their integration connections"
  on public.integration_connections for delete to authenticated
  using ((select auth.uid()) = user_id);

alter table public.goal_resources
  add column if not exists relevance_score numeric(5,4),
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

comment on column public.goal_resources.relevance_score is 'Normalised 0..1 relevance score produced by the resource pipeline.';
comment on column public.goal_resources.plan_step is 'The plan step this resource is intended to support.';
comment on column public.goal_resources.reason_recommended is 'Human-readable explanation for why VOW surfaced the resource.';
