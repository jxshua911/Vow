-- Keep support delivery tracking in sync with the statuses written by vow-support.
-- "accepted" means Resend accepted the message; it does not prove inbox delivery.
alter table public.support_submissions
  drop constraint if exists support_submissions_delivery_status_check;

alter table public.support_submissions
  add constraint support_submissions_delivery_status_check
  check (delivery_status = any (array[
    'pending'::text,
    'accepted'::text,
    'sent'::text,
    'delivered'::text,
    'delivery_delayed'::text,
    'bounced'::text,
    'complained'::text,
    'suppressed'::text,
    'failed'::text
  ]));
