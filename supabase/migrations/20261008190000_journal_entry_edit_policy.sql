-- Allow users to edit their own journal entries at any time.
-- The client already exposes the edit flow; this policy makes the update
-- authoritative under RLS instead of leaving entries effectively read-only.
alter table public.journal_entries enable row level security;

drop policy if exists "Users can update their own journal entries" on public.journal_entries;

create policy "Users can update their own journal entries"
  on public.journal_entries
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
