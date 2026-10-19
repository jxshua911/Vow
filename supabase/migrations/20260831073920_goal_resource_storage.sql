insert into storage.buckets (id, name, public) values ('goal-resources', 'goal-resources', false) on conflict (id) do nothing;
create policy "Users can upload goal resources" on storage.objects for insert to authenticated with check (bucket_id = 'goal-resources' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can read goal resources" on storage.objects for select to authenticated using (bucket_id = 'goal-resources' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can delete goal resources" on storage.objects for delete to authenticated using (bucket_id = 'goal-resources' and auth.uid()::text = (storage.foldername(name))[1]);
