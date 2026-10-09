# VOW S24 Ultra UX Remediation — Engineering Brief
**Date:** 9 October 2026  
**Repository:** jxshua911/Vow  
**Branch:** capacitor-mobile  
**Scope:** UX-first remediation from the S24 Ultra audit. Goal-generation/backend work is deliberately outside this phase.

## Execution summary
The existing UX pass is commit `5e6c37869b2d2865c6f2fc31da5d3013e18325e0` (“Polish support, reminders, scheduling controls, review and premium UX”). Follow-up changes harden notification permission state, the native launch window background, launcher resource cache invalidation, goal confirmation wording, and calendar collision preflight. Build #535 passed for code commit `06ad65840eda96be313ecf32364dc5744f53e815`; device behaviour still requires S24 Ultra retesting.

## Existing UX changes in the branch
- **Calendar sync panel:** after access is granted, the component fetches upcoming scheduled sessions, syncs them, reports the result, and begins dismissing the panel. It guards against duplicate effect-triggered sync during the permission flow.
- **Notification switch appearance:** conventional track-and-thumb switch with blue ON and grey OFF states, accessible `role="switch"` and `aria-checked`.
- **Support form autofill:** pre-fills name and email from auth context while preserving user edits.
- **Time picker:** compact row with native time input and ±5-minute controls; removes the oversized wheel interaction and verbose 24-hour label.
- **Weekly review language:** action is “Confirm next week”; explanatory copy says confirmation schedules sessions and later changes happen at the next weekly review.
- **Premium page:** reduces overlapping feature/usage/pricing copy and reorganises purchase information.

## Follow-up hardening in this change
### Notification permission state
After native notification permission is granted, the switch is set ON immediately before reminder reconciliation completes. If reconciliation fails after permission is granted, the UI derives the switch from the saved preference and presents a more accurate message instead of silently leaving the switch OFF. This separates OS permission from successful reminder scheduling and makes partial failure visible.

### Native launch background
The post-splash no-action-bar theme now uses the same white background colour as the native splash theme rather than a null window background. This is intended to reduce a blank/white frame during the transition; it must be verified on physical Android hardware because launch behaviour varies by Android version.

## Remaining audit items / acceptance criteria
1. **Calendar collision warning — implemented in source, device validation required.** When native calendar sync is already enabled, the planner checks proposed session intervals against events in the plan's date range, ignores VOW's own events, and offers Adjust schedule or Continue anyway. A failed calendar lookup is non-blocking but is surfaced to the user. Confirm this works on-device, including date ranges, all-day events, duplicate warnings, and no surprise permission prompt.
2. **Launcher icon cache invalidation — implemented in source, visual result unverified.** The manifest now points to fresh `ic_vow_app_icon_v2` and round variants across adaptive-icon and legacy resources to force Android to resolve a new resource identity. Verify after a clean install on the S24 Ultra; if the shape still looks compressed, adjust the actual foreground artwork safe zone rather than repeating the cache workaround.
3. **Support send failure — diagnosed to a live server error, root cause not yet confirmed.** The app invokes `vow-website-chat` action `contact`; the Edge Function exists and is active at version 14. Supabase logs show a POST returning HTTP 500 at 2026-10-09 09:00 UTC, and the contact table had no row for that test window. The catch handler logs non-Error objects as `[object Object]`, hiding the underlying PostgREST error. Table and columns exist, and service_role has schema/table privileges. Next: improve structured server-side error logging, reproduce once, then fix the exact failing operation. The handler currently stores submissions in the database; no email delivery is implemented in the `contact` action, so delivery/notification requirements must be addressed separately.
4. **Goal-plan generation — deliberately deferred until UX phase is accepted.** After UX validation, investigate backend deployment/routing mismatch and the `GENERIC_SESSION_TASK` plan-validation failure separately.
5. **Calendar sync — device validation required.** Confirm permission prompt, sync result, one-time dismissal, re-entry after the user re-enables sync, and no duplicate calendar events.
6. **Notifications — device validation required.** Test permission granted, denied, denied-then-enabled in Android Settings, local reminder scheduling, and optional remote push registration failure. UI must distinguish OS permission from successfully scheduled reminders.
7. **Premium and time picker — device validation required.** Check compactness, native keyboard/time entry, accessibility labels, current plan, usage, product prices, restore and purchase flows.
8. **Weekly review — device validation required.** Confirm copy makes the editing rule clear and existing confirmed reviews remain stable.

## Build and release gates
- CI build must pass on the exact branch head.
- Review CI logs for build/type errors; compilation alone does not prove runtime correctness.
- Install the generated APK on the Samsung Galaxy S24 Ultra.
- Execute the acceptance criteria above and record observed outcomes.
- Keep goal-generation/backend deployment changes out of this UX phase.
- Do not call the release production-ready until both CI and device validation pass.

## Status vocabulary
- **Implemented in source:** code change is committed to the branch.
- **Build verified:** CI succeeded for that exact commit.
- **Device verified:** behaviour was manually observed on the S24 Ultra.
- **Deployed:** the intended backend/function version is confirmed live.
These statuses are independent and must not be conflated.


## CI record
- **Build #535:** success — [workflow run](https://github.com/jxshua911/Vow/actions/runs/37910820575)
- **Built source SHA:** `06ad65840eda96be313ecf32364dc5744f53e815`
- **Artifact:** `VOW APK 1.6 Production CI`, 4,812,188 bytes; [download from workflow artifacts](https://github.com/jxshua911/Vow/actions/runs/37910820575)
- Typecheck, lint, web build, Capacitor sync, APK assembly, APK verification and artifact upload all passed.
- **Not yet proven:** physical-device UI behaviour, launcher icon appearance, splash transition, calendar collision detection, permission callbacks, support request success, and email delivery.
