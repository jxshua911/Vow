-- Intelligence 10/10: indexes for progress queries and controlled knowledge embedding backfill.
create index if not exists idx_sessions_user_scheduled_at on public.sessions (user_id, scheduled_at);
create index if not exists idx_vow_knowledge_embedding_pending on public.vow_knowledge (updated_at)
where active = true and embedding is null;
