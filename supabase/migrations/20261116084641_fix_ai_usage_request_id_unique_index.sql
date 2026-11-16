-- Make request_id conflict inference unambiguous for idempotent AI telemetry writes.
-- PostgreSQL unique indexes permit multiple NULL values, so a partial index is unnecessary.

begin;

drop index if exists public.vow_ai_usage_events_request_id_uidx;

create unique index vow_ai_usage_events_request_id_uidx
  on public.vow_ai_usage_events (request_id);

commit;
