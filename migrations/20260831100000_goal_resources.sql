create table if not exists public.goal_resources (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null check (char_length(url) between 1 and 2048),
  title text,
  resource_type text not null default 'link' check (resource_type in ('youtube','instagram','image','video','link')),
  created_at timestamptz not null default now()
);

create index if not exists goal_resources_goal_id_idx on public.goal_resources(goal_id);
create index if not exists goal_resources_user_id_idx on public.goal_resources(user_id);

alter table public.goal_resources enable row level security;

drop policy if exists "Users can read their goal resources" on public.goal_resources;
drop policy if exists "Users can create their goal resources" on public.goal_resources;
drop policy if exists "Users can update their goal resources" on public.goal_resources;
drop policy if exists "Users can delete their goal resources" on public.goal_resources;

create policy "Users can read their goal resources"
  on public.goal_resources for select
  using (auth.uid() = user_id);

create policy "Users can create their goal resources"
  on public.goal_resources for insert
  with check (auth.uid() = user_id);

create policy "Users can update their goal resources"
  on public.goal_resources for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their goal resources"
  on public.goal_resources for delete
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('goal-resources', 'goal-resources', false)
on conflict (id) do nothing;

create policy "Users can upload goal resources"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'goal-resources' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can read goal resources"
  on storage.objects for select to authenticated
  using (bucket_id = 'goal-resources' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete goal resources"
  on storage.objects for delete to authenticated
  using (bucket_id = 'goal-resources' and auth.uid()::text = (storage.foldername(name))[1]);
