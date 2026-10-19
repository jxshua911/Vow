alter function public.match_vow_knowledge(text, text, integer) set search_path = public, pg_temp;
alter function public.match_vow_knowledge_keyword(text, text, integer) set search_path = public, pg_temp;
alter function public.match_vow_knowledge_semantic(vector, text, integer) set search_path = public, pg_temp;
alter function public.vow_knowledge_embedding_text(public.vow_knowledge) set search_path = public, pg_temp;
