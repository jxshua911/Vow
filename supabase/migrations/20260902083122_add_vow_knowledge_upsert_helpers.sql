create or replace function public.match_vow_knowledge_keyword(query_text text, domain_filter text default null, match_count integer default 8)
returns table(id uuid, domain text, topic text, title text, content text, principles jsonb, recommended_actions jsonb, metrics jsonb, cautions jsonb, source_url text, score real)
language sql stable
as $$
  select k.id, k.domain, k.topic, k.title, k.content, k.principles, k.recommended_actions, k.metrics, k.cautions, k.source_url,
         ts_rank_cd(k.search_vector, websearch_to_tsquery('english', query_text))::real as score
  from public.vow_knowledge k
  where k.active = true
    and k.search_vector @@ websearch_to_tsquery('english', query_text)
    and (domain_filter is null or k.domain = domain_filter)
  order by score desc
  limit least(greatest(match_count, 1), 20);
$$;
