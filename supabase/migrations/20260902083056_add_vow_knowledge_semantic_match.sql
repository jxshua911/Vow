create or replace function public.match_vow_knowledge_semantic(query_embedding extensions.vector(384), domain_filter text default null, match_count integer default 8)
returns table(id uuid, domain text, topic text, title text, content text, principles jsonb, recommended_actions jsonb, metrics jsonb, cautions jsonb, source_url text, score real)
language sql stable
as $$
  select k.id, k.domain, k.topic, k.title, k.content, k.principles, k.recommended_actions, k.metrics, k.cautions, k.source_url,
         (1 - (k.embedding <=> query_embedding))::real as score
  from public.vow_knowledge k
  where k.active = true
    and k.embedding is not null
    and (domain_filter is null or k.domain = domain_filter)
  order by k.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

create index if not exists vow_knowledge_embedding_hnsw on public.vow_knowledge using hnsw (embedding vector_cosine_ops);
