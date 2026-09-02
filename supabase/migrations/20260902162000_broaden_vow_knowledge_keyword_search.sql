create or replace function public.match_vow_knowledge_keyword(query_text text, domain_filter text default null, match_count integer default 8)
returns table(id uuid, domain text, topic text, title text, content text, principles jsonb, recommended_actions jsonb, metrics jsonb, cautions jsonb, source_url text, score real)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  with terms as (
    select distinct lower(trim(term)) as term
    from regexp_split_to_table(regexp_replace(coalesce(query_text, ''), '[^[:alnum:]]+', ' ', 'g'), '\\s+') as term
    where length(trim(term)) >= 3
  ),
  built as (
    select case
      when count(*) = 0 then null::tsquery
      else websearch_to_tsquery('english', string_agg('"' || replace(term, '"', '') || '"', ' OR ' order by term))
    end as q
    from terms
  )
  select k.id, k.domain, k.topic, k.title, k.content, k.principles, k.recommended_actions, k.metrics, k.cautions, k.source_url,
         ts_rank_cd(k.search_vector, built.q)::real as score
  from public.vow_knowledge k
  cross join built
  where k.active = true
    and built.q is not null
    and k.search_vector @@ built.q
    and (domain_filter is null or k.domain = domain_filter)
  order by score desc
  limit least(greatest(match_count, 1), 20);
$function$;
