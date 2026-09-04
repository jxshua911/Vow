# VOW QA Checklist

## Core flow

- Create account with email and complete onboarding.
- Sign out and sign back in; confirm only the signed-in user's data is shown.
- Create a goal, decompose it, schedule sessions, and open the scheduled session from the dashboard/calendar.
- Complete, skip, and move sessions; confirm progress and review metrics update correctly.
- Create journal entries and link them to active, locked, completed, and abandoned goals.
- Delete a journal entry and confirm it disappears without affecting the goal.
- Generate a weekly review, inspect Raven feedback, regenerate, confirm next week's commitments, and delete a review.
- Delete a completed or abandoned goal from Goal History and confirm its dependent records are removed as intended.

## Account and isolation

- Sign out and sign in as a second VOW user on the same device; confirm no first-user calendar cache, icon preference, notification state, or connections appear.
- Connect Google Calendar for account A, sign out, sign in as account B, and confirm account A's Google events are absent.
- On a device with multiple Google accounts, confirm VOW writes sessions only into the dedicated VOW calendar belonging to the explicitly connected account.
- Revoke Google Calendar access and confirm VOW asks for reconnection rather than silently falling back to another account.

## Permissions and failure handling

- Deny calendar permission; confirm VOW shows a useful error and does not crash.
- Deny notifications; confirm VOW explains how to re-enable them in device settings.
- Disable network access while viewing existing content; confirm the offline banner appears.
- Attempt a write while offline; confirm the user receives an error and the UI does not pretend the change succeeded.
- Rapidly tap create/save/confirm controls; confirm at most one write is produced.
- Force an unexpected render error during development; confirm the recovery screen reloads the app.

## UI and edge cases

- Use very long goal titles, session titles, journal text, tags, and review text; confirm no horizontal overflow.
- Test empty states: no goals, no sessions, no journal, no review, no connected calendar.
- Test past/future dates around month and year boundaries and week view transitions.
- Test light and dark mode, including after relaunch.
- Test the smallest supported phone width and a large tablet/desktop width.
- Close and relaunch the app repeatedly; confirm account state and user-scoped preferences persist.

## Customisation

- Confirm a new user receives a random icon combination.
- Shuffle repeatedly; confirm the selected combination changes and is persisted per VOW account.
- Select several colour combinations and confirm the Android launcher icon matches the in-app preview.
- Sign out and use a different VOW account; confirm its icon preference is independent.

## Release gates

- Android CI: no Lucide dependency/imports, typecheck passes, lint passes, web build passes, Capacitor sync passes, APK assembles, and APK verification succeeds.
- iOS bootstrap: native project exists, Capacitor sync succeeds, required calendar usage descriptions exist, and the project opens/builds in Xcode before signing/distribution setup.
- Manual device QA must pass the core flow, account-isolation flow, calendar permission flow, notification permission flow, and custom-icon flow on each supported platform before release.
