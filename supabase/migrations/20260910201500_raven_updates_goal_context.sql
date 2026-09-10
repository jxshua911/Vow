create or replace function public.update_goal_context_from_review()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  commitment jsonb;
  goal_ids uuid[] := '{}';
begin
  if NEW.status <> 'confirmed' then
    return NEW;
  end if;

  for commitment in select value from jsonb_array_elements(coalesce(NEW.proposed_commitments, '[]'::jsonb)) loop
    begin
      goal_ids := array_append(goal_ids, (commitment->>'goal_id')::uuid);
    exception when invalid_text_representation then
      null;
    end;
  end loop;

  update public.goals
     set goal_context_json = coalesce(goal_context_json, '{}'::jsonb) || jsonb_build_object(
       'last_review', jsonb_build_object(
         'review_id', NEW.id,
         'week_start', NEW.week_start,
         'week_end', NEW.week_end,
         'completion_pct', NEW.completion_pct,
         'biggest_win', NEW.biggest_win,
         'biggest_setback', NEW.biggest_setback,
         'raven', coalesce(NEW.raven_snapshot, '{}'::jsonb),
         'recommendations', coalesce(NEW.recommendations, '[]'::jsonb)
       ),
       'updated_from_review_at', now()
     ),
       updated_at = now()
   where user_id = NEW.user_id
     and (cardinality(goal_ids) = 0 or id = any(goal_ids));

  return NEW;
end;
$$;

drop trigger if exists reviews_update_goal_context on public.reviews;
create trigger reviews_update_goal_context
after insert or update of status on public.reviews
for each row execute function public.update_goal_context_from_review();
