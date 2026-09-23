drop policy if exists "Owners can view moderation metadata" on public.moderation_events;
create policy "Owners can view moderation metadata" on public.moderation_events for select to authenticated using (((select (auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'owner') and owner_visible = true);
