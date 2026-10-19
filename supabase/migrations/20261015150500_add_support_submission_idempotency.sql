alter table public.support_submissions
  add column if not exists client_request_id uuid;

create unique index if not exists support_submissions_client_request_id_uidx
  on public.support_submissions (client_request_id)
  where client_request_id is not null;
