# Vow — Consolidated Feature Build

This document defines the next product implementation pass. It is intentionally one lumped build, with Android/iOS delivery handled separately. iOS remains postponed for this pass.

## 1. Goals ↔ Journal

- Preserve and fully use the existing `journal_entries.linked_goal_id` relationship.
- Allow a journal entry to be linked to an existing goal while writing or editing it.
- Show linked journal reflections from the goal detail view.
- Allow a journal reflection to open its linked goal.
- Add goal-aware reflection prompts where appropriate.
- On goal completion, offer a reflection and retain it as part of goal history rather than deleting the goal context.
- Surface useful goal history: progress, sessions, milestones, reflections, setbacks and completion.
- Where a journal entry clearly represents an intention, provide a natural path to create a goal from it.

## 2. Calendar ↔ Goals

- Sessions/milestones created from goals should remain first-class calendar items.
- Add an explicit “Add to phone calendar” action for scheduled Vow items.
- Create a native-calendar-compatible event containing title, date/time, duration and useful description.
- Prevent duplicate external events when the same Vow item is exported more than once.
- Persist `external_event_id` where a provider exposes a stable identifier.
- When Vow scheduling changes, offer/update the corresponding external event when supported.
- Handle calendar permission denial and unsupported providers gracefully.
- Do not require Google Calendar specifically; use the device/provider where possible, with a safe fallback for Android.

## 3. Connect — first-time and first-hand experience

- Do not expose an overwhelming feed on a user's first Connect visit.
- Prioritise first-hand/directly relevant content and meaningful interactions over broad discovery.
- Establish a deliberate initial content limit.
- Expand discovery progressively as the user interacts with Connect.
- Avoid engagement-farming patterns and unnecessary infinite-feed behaviour.
- Keep Connect aligned with Vow's personal-growth purpose.

## 4. Notifications

Implement a unified notification model and delivery path for:

- Connect interactions and relevant social activity.
- Goal/session reminders.
- Journal prompts/reminders.
- Important Vow activity.
- Future notification types without requiring a new architecture each time.

Requirements:

- Persist notification state/read status.
- Keep in-app badges and notification state synchronised.
- Support unread/read transitions reliably.
- Respect user notification preferences.
- Avoid duplicate notifications.
- Use native Android notification delivery for the Android build where available.
- Notification sounds must respect Android system volume, silent mode and Do Not Disturb behaviour.
- Use sensible notification importance so Vow does not become noisy.

## 5. Android delivery

- Keep Android as the active mobile target for this pass.
- Maintain broad Android compatibility.
- Preserve the current working APK baseline while implementing the changes.
- Ensure the GitHub Actions APK workflow uploads an artifact after successful builds.
- Fix any workflow failure that prevents an APK artifact from being produced.
- Run lint/typecheck/build and a regression pass before treating the build as release-ready.

## 6. Data/security requirements

- All new database tables/columns must have appropriate Row Level Security.
- Users may only read/write their own private goals, journals, notifications and calendar metadata.
- Social/Connect data must follow the intended visibility model.
- Do not expose service-role credentials to the client.
- Validate all new writes and handle loading, empty and error states.

## Definition of done

The lumped build is complete only when the implementation is integrated, lint/typecheck/build passes, Android packaging succeeds, the APK artifact is attached to the workflow run, and the complete feature set has received a regression/security review.
