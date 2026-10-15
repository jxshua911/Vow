alter table public.support_submissions
  add column if not exists delivery_id text;

create index if not exists support_submissions_delivery_id_idx
  on public.support_submissions (delivery_id)
  where delivery_id is not null;
