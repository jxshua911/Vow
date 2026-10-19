create index if not exists vow_knowledge_domain_idx on public.vow_knowledge (domain) where active = true;
create index if not exists vow_knowledge_search_vector_idx on public.vow_knowledge using gin (search_vector);
