# Phase 2 — Device Bug-Test Plan

This is a **bug-testing-only** checklist for the Phase 2 completion candidate. Do not add new product features during this pass. Record failures, confusing behaviour, broken layouts, inaccurate calculations and reliability problems.

## Build under test

Branch: `agent/phase-1-refinement-phase-2-foundations`

```bash
cd ~/projects/My-Mettle
git fetch origin
git checkout agent/phase-1-refinement-phase-2-foundations
git pull origin agent/phase-1-refinement-phase-2-foundations
npm install
npm test
npm run android:sync
cd android
./gradlew assembleDebug --no-daemon
```

APK:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Install this APK over the previous development build. The Phase 1 local database should migrate rather than reset.

## 1. Migration and persistence

- Open the updated app without clearing its storage.
- Confirm existing routine versions, sessions and experiments remain visible.
- Close the app fully and reopen it.
- Confirm the active tab-independent data, body measurements and active session remain intact.
- Export a JSON backup and confirm the file is created.
- Do not use Reset unless migration recovery is being deliberately tested.

## 2. Header and navigation

- Confirm the bottom navigation is compact, icon-only and comfortably tappable.
- Confirm each selected icon is visibly highlighted.
- Confirm the current page name appears in the centre of the header.
- Start a workout, scroll the main progress bar away and confirm the header progress fill remains accurate.
- Confirm the wordmark, centred label, settings and profile controls do not collide at the smallest text/display size used on the phone.

## 3. Exercise creation

Create at least one movement of each type:

- External load + reps.
- Assistance + reps.
- Bodyweight + reps.
- Added load + reps.
- Repetitions only.
- Duration.
- Distance.

For each:

- Confirm the wizard asks only relevant fields.
- Confirm unit suffixes remain visible when the keyboard opens.
- Confirm Back, swipe and Next preserve entered values.
- Confirm Review describes the tracking method correctly.
- Confirm creation makes a new immutable routine version.
- Confirm JSON import accepts the new structure and rejects malformed data clearly.

## 4. Body measurements

- Add weight and height together.
- Add a later weight-only entry.
- Close and reopen the app.
- Confirm the history remains dated and the latest values are shown correctly.
- Begin a session and confirm its bodyweight snapshot matches the latest measurement at or before the session time.
- Add a newer measurement after the session begins and confirm the active session snapshot does not change.

## 5. Set tracking

Test each created tracking type in a workout:

- External load: entered load and repetitions save correctly.
- Per-hand/per-side: evidence uses both sides while the field remains the per-hand/per-side value.
- Assistance: effective resistance equals session bodyweight minus assistance.
- Bodyweight: repetitions save without requiring a load field.
- Added load: effective resistance equals bodyweight plus entered load.
- Duration: seconds save and count toward the prescribed target.
- Distance: metres save and count toward the prescribed target.

Correct a value and confirm:

- The Undo toast appears.
- It disappears after roughly five seconds.
- A newer edit restarts the five-second window.
- Undo restores the previous value.

## 6. Rest timer

- Complete a set and confirm the timer opens automatically when enabled.
- Check Pause, Resume, `+30`, Skip and Minimise.
- Minimise and navigate/scroll; confirm the header timer remains visible.
- Tap the header timer and confirm it expands.
- Background the app for part of a rest interval and return; confirm the remaining time catches up from the absolute deadline.
- Let the timer finish and confirm completion vibration.
- Enable the chime in Settings and repeat.
- Disable automatic rest timing and confirm completing a set does not open the timer.
- Force-close and reopen during a timer; confirm the stored timer recovers sensibly.

## 7. Exercise details

- Open Details from an active exercise.
- Confirm tracking relationship, entry basis, progression step and bodyweight snapshot are correct.
- Confirm the setup cue is visible.
- After completed sessions exist, confirm recent evidence lists the correct exercise history.
- Confirm the overlay scrolls and closes reliably.

## 8. Lab progression semantics

- Complete all prescribed work for an external-load exercise and confirm a higher-load proposal may be created.
- Complete all prescribed work for an assisted-bodyweight exercise and confirm the proposal uses **less assistance**.
- Activate, test and promote a proposal.
- Confirm promotion creates a new routine version rather than rewriting old sessions.

## 9. Interrupted sessions

- Begin a session, enter some data, close the app and reopen it.
- Confirm the active session resumes with the entered values and session bodyweight snapshot intact.
- Complete the resumed session and confirm the cycle advances correctly.

## 10. Layout and accessibility

Check the Brief, Train, Progress, Lab, Library, Profile, Settings, exercise wizard, timer and Details surfaces with:

- Keyboard open and closed.
- Long exercise names.
- Android display/font scaling used day to day.
- Reduced Motion enabled.
- Portrait orientation on the target Samsung phone.

Look specifically for clipped labels, hidden actions, stray shadows, content beneath the navigation, focus traps and controls that are difficult to reach one-handed.

## Reporting format

For each bug, record:

```text
Area:
Steps:
Expected:
Observed:
Frequency:
Screenshot/video:
Data risk: none / incorrect display / incorrect saved data / data loss
```

Phase 2 remains frozen except for defects found through this checklist. Feature development resumes in Phase 3 only after the Phase 2 bug pass is accepted.
