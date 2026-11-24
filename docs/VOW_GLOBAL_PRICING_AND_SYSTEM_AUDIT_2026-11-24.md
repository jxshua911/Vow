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
- Fixed in the latest remediation work: a per-device delivery ledger now records pending/sent/failed delivery state. Partial success retries only failed devices, avoiding normal duplicate sends to devices already marked sent. A process crash after FCM accepts a message but before the delivery row is updated can still cause an at-least-once duplicate; exactly-once push delivery cannot be guaranteed by FCM.
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

PR #18 is open and draft, based on `capacitor-mobile`. Current PR head: `32664a9b99f94f4da9d4091f30837161634af621`. On that head, Capacitor Mobile CI passed Edge Function typecheck, unit tests, ESLint, TypeScript typecheck and production build (runs [45423875921](https://github.com/jxshua911/Vow/actions/runs/45423875921) and [45423860638](https://github.com/jxshua911/Vow/actions/runs/45423860638)). The separate Android debug APK build is still in progress in [CI run 45423875878](https://github.com/jxshua911/Vow/actions/runs/45423875878). No APK has been installed or tested on a physical device.

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


## 24 November 2026 — Google Play-only pricing and AI cost update

- Current billing scope is Google Play only. Stripe and Apple are deferred; the Android Upgrade surface no longer starts Stripe checkout.
- Added a Google Play market catalogue migration for 49 proposed markets and added server-side subscription fields for verified store region and mapped tier.
- Purchase verification and RTDN now read Google's verified `regionCode`, map it through the catalogue, and persist the country/tier on the subscription record. This is not deployed to production until migration drift is resolved.
- Google Play remains the source of truth for the local amount charged. The app displays the localized product price returned by Google Play; exact country prices and availability still need Play Console configuration.
- The standalone `GoalAI` component was active on the goal-detail screen. I removed its import and UI section from Goals, deleted the component, and disabled the backend chat mode so the separate assistant can no longer consume planning tokens.
- Removed an extra AI model call that was used only to classify a goal when the client supplied an unknown category. The planner now uses supplied deterministic domain evidence or a neutral fallback, then spends its model call on clarification or actual plan generation.
- The two-step goal flow remains intentional: clarification questions (when needed) followed by the actual plan. It is not a second free-form AI chat.
- Mistral remains the default primary provider, followed by configured provider fallbacks. Added a private per-provider usage ledger and RPC for provider, model, request kind and prompt/completion/total token counts. This migration must be deployed before telemetry appears in production. The separate chat route and unused chat component have been removed, and an extra classification-only model call has been eliminated.
- AI and notification changes require a fresh CI run and sandbox/device QA before being called release-ready.


## 24 November 2026 — implementation completion update

### Notifications — implementation target 9/10
- Profile controls for sessions, weekly reviews, deadlines and streaks persist to server-side preferences.
- Session, weekly-review, deadline and streak notifications use the server queue and five-minute dispatcher.
- Quiet hours now defer eligible reminders until the next allowed local time; session reminders are not sent after the session begins.
- Per-device delivery ledger supports safe retries after partial FCM success.
- Account deletion and restoration events have best-effort critical push notifications; account deletion push is sent before device-token cleanup.
- Remaining: resolve migration drift, deploy after validation, verify Vault/FCM credentials and run full S24 Ultra timing/delivery tests.

### Regional pricing — implementation target 9/10
- Google Play only; one monthly product/base plan with localized price display from Google Play.
- 49-country market catalogue and verified regionCode persistence are implemented in the remediation branch.
- Stripe checkout has been removed from the Upgrade surface; Apple is deferred.
- Remaining: configure country availability and exact local prices in Play Console, complete merchant/tax setup and test purchases/restores with license testers.

### AI — cost and reliability remediation
- Removed the active standalone GoalAI assistant from the goal-detail screen, deleted its component, and disabled the backend chat mode.
- Removed the extra classification-only model call; the goal planner uses supplied domain evidence or a deterministic fallback.
- Mistral remains primary with configured fallbacks; plan quality validation and one bounded repair remain.
- Added per-provider token telemetry (provider/model/request kind/token counts). The new migration must be deployed before it becomes visible in production.
- Remaining: verify provider secrets/quotas, inspect real usage after telemetry is live, and test clarify/plan/repair flows against each configured provider.

Important: 9/10 means implementation completeness on the remediation branch, not production deployment or release readiness. Migration reconciliation and end-to-end QA remain separate gates.


## 24 November 2026 — fresh verification and final non-billing gates

### Latest branch verification
- The remediation PR head at the latest successful full run was `64090addddd7deea5b8159a7386edcbcfcf14840`.
- Capacitor Mobile CI passed Edge Function typecheck, unit tests, ESLint, TypeScript typecheck and production web build: [run 45424184933](https://github.com/jxshua911/Vow/actions/runs/45424184933).
- Android debug APK build and upload passed: [run 45424184955](https://github.com/jxshua911/Vow/actions/runs/45424184955). Artifact SHA-256: `099b62889f32d7cceac352bf12552f778f53164e5e3a3a6fe8dcdcd8ac560e62`.
- A subsequent code review found that the new `purging` account state was not yet rejected by the restrictive `vow_account_is_active()` guard. The race-safety migration now replaces that function so only active accounts pass the guard. This follow-up is commit `0501a4d51af229be8eabd892079789eb9bef4d94`.
- On that follow-up commit, TypeScript typecheck, lint, unit tests and production build passed. Android APK build was still running at the time of this update: [run 45429055107](https://github.com/jxshua911/Vow/actions/runs/45429055107).
- The successful APK is a build artifact only. It has not been installed or exercised on the Samsung Galaxy S24 Ultra.

### Fresh production-state check
- Supabase project status is `ACTIVE_HEALTHY`.
- Production migration history still ends at `20261119054150`; the `capacitor-mobile` development branch still reports `MIGRATIONS_FAILED`.
- The deployed function inventory does not include `vow-dispatch-notifications` or `vow-account-restore`. Deployed `vow-send-push` is version 8 and `vow-goal-ai` is version 180; the remediation versions remain branch-only.
- No new migration or Edge Function has been deployed, and no production customer data has been modified.

### Security-advisor review
- The 12 RLS-enabled/no-policy findings inspected include private/server-owned tables. For the seven public-schema tables checked, neither `anon` nor `authenticated` has direct SELECT privileges; `service_role` does. This is intentional isolation, not a reason to add permissive policies.
- The six authenticated `SECURITY DEFINER` functions flagged by the advisor were inspected. Their ACLs deny `anon` execution and grant the intended authenticated RPC access; each uses `auth.uid()` or trusted app metadata for its user-specific operation. Keep them under review rather than blindly revoking required RPC access.
- Leaked-password protection remains disabled and should be enabled after reviewing the Auth rollout.
- `pg_net` and `http` are installed in `public`; do not move extensions without checking dependent functions and cron jobs.
- The performance advisor reports 62 unused-index notices. These are informational; do not bulk-drop indexes before observing real workload.

### Release gates — billing intentionally isolated
The goal is to clear every non-billing gate before the public test rollout:
1. Recover/reconcile the missing production migration and get the Supabase development branch healthy without destructive reset.
2. Validate the complete migration sequence on a clean development database, including account lifecycle, notifications, market catalogue and AI token telemetry.
3. Deploy the non-billing Edge Functions to the development environment only after the schema is validated; verify provider secrets, FCM credentials, Vault and cron configuration.
4. Run end-to-end tests for goal creation/planning, weeks/months/years, sessions, weekly reviews, dashboard counts, calendar sync, account deletion/restoration/purge, support and notification preferences.
5. Install the latest APK on the S24 Ultra and test fresh install, upgrade, sign-in, foreground/background/force-closed notifications, timezone/quiet hours, offline/reconnect and crash recovery.
6. Resolve every reproducible P0/P1 defect and record the test evidence. Only then call non-billing systems release-ready.
7. Keep Google Play Console country availability, local price points, merchant/tax readiness and license-tester purchase/restore/renewal/cancellation as the separate billing workstream.

### Pilot-readiness principle
Do not recruit testers into a broken build. Once the non-billing gates pass, start a small, controlled closed test with a known build number, a short task-based test script, a single feedback channel and a clear bug-report template. Public content and waitlist acquisition can proceed in parallel, but tester access should be granted only to the validated build.
