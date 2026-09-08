create or replace function public.delete_own_review(p_review_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted boolean := false;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;

  delete from public.reviews
  where id = p_review_id
    and user_id = auth.uid();

  deleted := found;
  return deleted;
end;
$$;

revoke all on function public.delete_own_review(uuid) from public;
grant execute on function public.delete_own_review(uuid) to authenticated;