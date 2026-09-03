do $$
declare fn text;
begin
  select pg_get_functiondef(p.oid) into fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='armadillo_analyse_goal' and pg_get_function_identity_arguments(p.oid)='goal_title text, goal_outcome text, goal_why text';
  if fn is null then raise exception 'armadillo_analyse_goal not found'; end if;
  fn:=replace(fn,'app development)','app development|mobile app|web app|website|build an app|build a website)');
  execute fn;
end $$;
