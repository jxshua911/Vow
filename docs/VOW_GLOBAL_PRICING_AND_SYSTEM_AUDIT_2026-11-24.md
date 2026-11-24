# VOW global pricing, notifications and release-readiness audit

**Audit date:** 24 November 2026  
**Repository:** `jxshua911/Vow`  
**Source branch:** `capacitor-mobile`  
**Remediation branch:** `vow/remediation-nov-2026`  
**Remediation PR:** https://github.com/jxshua911/Vow/pull/18  
**Latest audited remediation commit:** `a0c60b058c86b7c03c9019a38d051912f358c767`

This is a read-only production audit plus a code-branch review. It does not represent a production deployment. No production migration, Edge Function deployment, billing change, account deletion or customer-data mutation was performed during this audit.

## Executive summary

VOW's remediation branch contains substantial code for account lifecycle, goal durations and a remote notification queue. However, the live Supabase project is still running the previous implementation. The regional-pricing system is only a design document. The main blocker is not a lack of ideas; it is the gap between branch code, database migration state and deployed Edge Functions.

## 1. Regional pricing

### Market research

Benchmarked Todoist, TickTick, Notion, Structured, Habitify, Sunsama and Motion using publicly available pricing and feature information. Structured is the closest documented example of explicit purchasing-power regional pricing. Google Play and Apple support country/storefront-specific price points. Stripe Adaptive Pricing converts a configured price into local currency; it does not, by itself, implement VOW's four purchasing-power tiers.

### Owner-approved USD-equivalent proposal

- Standard: $6.99/month
- Moderate: $5.99/month
- Accessible: $4.99/month
- Entry: $2.99/month

### Current VOW implementation

- `vow-create-checkout` uses a single `STRIPE_PRICE_ID_MONTHLY` environment variable.
- Checkout is monthly-only and explicitly ignores client-supplied billing interval.
- No server-owned market catalogue, user-market assignment or market audit trail exists.
- Live `vow_subscription_records` and `vow_user_entitlements` have no market/country/tier columns.
- Neither the live nor remediation-branch Google Play verification code currently captures or persists the verified purchase `regionCode`.
- The Stripe webhook in the remediation branch does not yet validate billing country or card issuing country.
- No regional Stripe Price IDs or country-tier assignments are configured.
- The pricing design now records the owner-approved ladder and a preliminary 37-country Europe matrix.

**Status:** research and design underway; implementation not started; not live.

## 2. Notifications

### Live production state verified

- `public.vow_notification_queue` does not exist.
- `vow_claim_due_notifications(integer)` and `vow_enqueue_periodic_notifications()` do not exist.
- Live `reminder_preferences` contains only: `user_id`, `enabled`, `preferred_time`, `timezone`, `quiet_start`, `quiet_end`, `updated_at`. The category columns are absent.
- The only active VOW cron job is `vow-account-purge-expired` every 15 minutes.
- The deployed `vow-dispatch-notifications` Edge Function does not exist.
- Deployed `vow-send-push` is version 8. Its live code does not enforce account status or per-category reminder flags.
- The remediation branch has a newer sender with account-status and category checks, plus a dispatcher and migration-backed queue, but these are not deployed.
- The production app currently exposes only one global “Enable notifications” switch. I have now added four category controls (sessions, weekly reviews, deadlines and streaks) to the remediation branch and wired them to the migration's server-side preference fields; this code passed the completed Capacitor Mobile CI run on commit `1d54e9160fa4ea190679700e876697b47a8e70de` (Edge Function typecheck, unit tests, ESLint, TypeScript typecheck and production build). The separate Android debug APK build is still in progress.
- The live Vault contains only the existing account-purge cron secret; the notification-dispatch secret has not been created because its migration is not applied.
- The live database migration history ends at `20261119054150`; the three 24 November remediation migrations are not applied.
- No end-to-end FCM delivery or Samsung S24 Ultra notification test has been completed.

### Issues found in the proposed branch implementation

- Session and periodic notification generation currently drops a reminder when its fire time falls inside quiet hours. It does not defer the reminder to the next allowed time. Decide whether the intended policy is “skip” or “reschedule”; if reschedule, implement and test it.
- Per-category preference columns are created by the un-applied migration, but the app settings UI does not yet let users control them.
- Account/security/subscription messages are intentionally treated as critical by the branch sender and bypass routine reminder preferences. Keep these separate from optional routine reminders and explain this in settings.
- The dispatcher currently marks a queue item as sent when at least one device succeeds, even if another registered device fails. A robust multi-device retry needs per-device delivery state; simply retrying the whole notification would duplicate it on devices that already received it.
- The dispatcher cron, Vault secret, sender internal secret and Firebase credentials must be verified in a development environment before production deployment.

**Status:** local reminders exist; remote queue/scheduler implementation is branch-only; remote delivery is not release-ready.

## 3. Account deletion, restoration and subscription lifecycle

### Branch implementation

PR #18 changes account deletion to stop renewals while preserving paid-through access, adds restoration handling, introduces a `purging` state and an atomic purge claim, and adjusts Stripe/Google Play lifecycle handling. The PR description explicitly says Apple subscription cancellation is not implemented.

### Live state

The production migration history is still at 19 November. The account deletion, restore/purge, Stripe webhook and Google Play RTDN/verification changes in PR #18 have not been deployed from the remediation branch. The deployed function list does not include the branch's new `vow-account-restore` function.

### Required validation

- Stripe test subscription: cancel-at-period-end, restore, paid-through entitlement, webhook ordering and idempotency.
- Google Play license tester: stop renewals, verify region code, restore, expiry and resubscribe behaviour.
- Full 14-day deletion grace period, purge and restore/purge race.
- Apple billing guard before any iOS release if Apple subscriptions are enabled.

**Status:** branch implementation present; live deployment and provider sandbox verification pending.

## 4. Goal duration integrity

The branch adds canonical week/month/year duration tokens and tests legacy week restoration and invalid tokens. CI passed on the audited commit according to the PR record. No physical-device regression test has been completed.

**Status:** code and unit tests present on the branch; merge, migration reconciliation and device QA pending.

## 5. Supabase migration and security state

### Migration state

- Live `supabase_migrations.schema_migrations` latest entry: `20261119054150`.
- The three 24 November migrations for paid-entitlement preservation, remote notifications and purge/restore race safety are not in live migration history.
- Confirmed Git/database drift: the `capacitor-mobile` Git tree's latest migration is `20261117045925_persist_user_display_name.sql`, while production migration history contains `20261119054150_harden_account_lifecycle_and_notifications`. The matching 19 November production migration file is absent from that Git tree.
- PR #18 adds a distinct `20261119140000_harden_account_lifecycle_and_notifications.sql` file. It has a different migration version; it must not be assumed to be a safe replacement for the missing production migration until the two schema changes are reconciled.
- Supabase development branch `capacitor-mobile` reports `MIGRATIONS_FAILED` (last branch update reported 27 October); its preview project reports `ACTIVE_HEALTHY`. The available connector exposes the status but not the branch's migration-step error log, so the original failure cause is not yet confirmed.
- Do not merge or apply migrations to production until the missing migration is recovered/reconciled, the failed branch logs are inspected, and all migrations pass on a clean development database.

### Advisors

- Security advisor: six `SECURITY DEFINER` functions are executable by authenticated users. This is a review item, not proof of a vulnerability; inspect each function's identity/authorization checks and grant requirements before changing privileges.
- Leaked-password protection is disabled; enable after validating the Auth configuration and rollout impact.
- Performance advisor: 62 unused-index notices. Do not bulk-drop indexes; some may be important for infrequent queries or new workloads.

## 6. Build and QA

PR #18 is open and draft, based on `capacitor-mobile`. Its latest audited head is `a0c60b0`. On commit `1d54e9160fa4ea190679700e876697b47a8e70de`, the completed Capacitor Mobile CI run passed Edge Function typecheck, unit tests, ESLint, TypeScript typecheck and production build. The separate Android debug APK build is still in progress. No APK has been installed or tested on a physical device.

The Samsung Galaxy S24 Ultra regression suite remains outstanding. Test login, goal creation and duration changes, session scheduling, local and remote notifications, calendar permissions/sync, account deletion/restoration, Premium, offline/reconnect and crash recovery.

## 7. Additional product QA still open from the existing audit

- Google Calendar permission-choice UX and actual sync behaviour.
- Dashboard session cards and goal/session count consistency.
- Weekly-review entitlement counter after generate/lock/regenerate.
- Empty/no-date/no-time labels and scheduling edge cases.
- Notification permission prompt and settings UX.
- Loading/transition states and pinch-zoom behaviour.
- Support/account-unban request flow.
- Full email lifecycle: registration verification, password reset, email changes, deletion, Premium activation, renewal/cancellation, bounce and retry.
- Reconcile the earlier live user/settings/push-device snapshot with the conflicting PR #17 report.

## 8. Priority remediation order

1. **Migration reconciliation:** identify why the Supabase development branch is `MIGRATIONS_FAILED`; validate all migration files on a clean development database; test rollback/recovery. Production remains untouched.
2. **Notification correctness:** fix quiet-hour semantics, add category controls, validate queue claims/retries/deduplication, verify Vault and FCM secrets, deploy dispatcher/sender only after migration validation.
3. **Regional pricing:** approve the 37-country Europe proposal and other markets; complete local currency prices; implement server-owned country/tier assignment and anti-arbitrage; validate Stripe and Google Play paths.
4. **Billing/account lifecycle:** run provider sandbox tests and verify paid-through entitlements, restore and purge behaviour.
5. **Security and email:** complete RLS/SECURITY DEFINER review, leaked-password protection and email delivery tests.
6. **Device QA:** install a newly built APK on the S24 Ultra and execute the regression plan.

## Release decision

**Not release-ready.** The branch contains useful implementation work, but the production database and Edge Functions do not yet contain the remote-notification architecture or regional-pricing enforcement. PR #18 remains draft and unmerged. Do not deploy the new migrations or Edge Functions until the migration failure is resolved and development tests pass.
