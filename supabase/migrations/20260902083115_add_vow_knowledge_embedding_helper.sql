create or replace function public.vow_knowledge_embedding_text(k public.vow_knowledge)
returns text
language sql immutable
as $$
  select concat_ws(E'\n', k.domain, k.topic, k.title, k.content, k.principles::text, k.recommended_actions::text, k.metrics::text, k.cautions::text);
$$;
