# Phase 3A — MAIS Device Test

Status: exit checklist for `agent/phase-3a-mais-foundations`.

Phase 3A is framework-focused. The Lab console is intentionally plain and uses the deterministic simulated role/runtime adapter. The test verifies lifecycle, persistence, authority and Android resource behaviour—not intelligence quality.

## Before testing

- Install the debug APK over the existing Phase 2 installation.
- Do not clear app data.
- Confirm ordinary Brief, Train, Progress, Lab and Library pages still open.
- Keep Battery Saver disabled for the first pass.

## 1. Separate persistence

1. Open **Lab**.
2. Find **MAIS Activity · Phase 3A**.
3. Press **Run synthetic heartbeat**.
4. Verify the console shows increased Events, Tasks, Checkpoints, Artefacts and Model leases.
5. Force-close My Mettle.
6. Reopen it and return to Lab.
7. Verify the counts remain.

Pass condition: MAIS state survives restart independently from training data.

## 2. Heart and model-lease cycle

1. Clear MAIS state from its console.
2. Press **Run synthetic heartbeat** once.
3. Expand **Task ledger**.
4. Verify the task reaches `completed`.
5. Confirm model lease count increases once for each role step.
6. Leave the app open for at least 20 seconds.
7. Verify no new model leases appear when no queued work exists.

Pass condition: one bounded role uses one load/run/unload lease, and idle heartbeats invoke no model.

## 3. Self-advancing heartbeat

1. Clear MAIS state.
2. Begin and complete a short valid training session, or use a real session you intend to record.
3. Open Lab immediately.
4. Verify a `session_completed` task exists and has advanced at least one role.
5. Leave the app open for approximately 35 seconds.
6. Verify later role steps advance without pressing **Pulse once**.

Pass condition: passive app use wakes MAIS, and foreground pulses resume typed checkpoints.

## 4. Battery Saver

1. Keep My Mettle open on Lab.
2. Enable Android Battery Saver.
3. Return to the app.
4. Verify the MAIS mode chip becomes `light`.
5. Run a synthetic heartbeat.
6. Verify lightweight work may advance but Deep Lab work is deferred.
7. Disable Battery Saver.
8. Verify the mode returns to `full` when the app is foregrounded and no workout interaction is active.

Pass condition: native Battery Saver state reaches the WebView and controls the Resource Governor.

## 5. Active workout protection

1. Begin a workout.
2. Open Lab through the bottom navigation without completing the session.
3. Verify MAIS mode is `light`.
4. Complete or exit the session normally.
5. Verify mode returns to `full` afterwards.

Pass condition: active workout interaction protects responsiveness without stopping event capture.

## 6. Background and closure

1. Leave a resumable task in the ledger by pressing **Run synthetic heartbeat**, then immediately background the app during a later manual test using **Pulse once** as needed.
2. Return to My Mettle.
3. Verify task state is intact and can continue.
4. Force-close the app and wait briefly.
5. Reopen it.
6. Verify no work was performed while closed, but the saved checkpoint remains.

Pass condition: no background AI service runs after closure, and continuity is preserved.

## 7. Report Card

1. Generate at least one completed synthetic task.
2. Press **Export report card**.
3. Confirm a JSON file is saved/opened by Android.
4. Verify it includes events, tasks, checkpoints, artefacts, diagnostics and model leases.
5. Verify it does not contain fields named `chainOfThought`, `scratchpad` or `hiddenReasoning`.

Pass condition: a higher-capability reviewer receives reproducible operational evidence without hidden model reasoning.

## 8. Safe reset boundary

1. Note the current routine and recent session count.
2. Press **Clear MAIS state** and confirm.
3. Verify MAIS counts reset.
4. Return to Train, Library and Session History.
5. Verify routine, exercises and training history remain unchanged.

Pass condition: the independent MAIS database can be reset without touching the training database.

## 9. Regression pass

Verify:

- existing Phase 2 data opens without migration/reset;
- routine edit mode still moves, duplicates and saves cards;
- exercise reflections and haptics still work;
- Setup Notes and video reference still persist;
- rest timer still starts and completes;
- session completion still creates its ordinary deterministic progression proposal where eligible;
- app remains responsive while the Heart is idle.

## Exit decision

Phase 3A passes when all sections above are accepted and the exact branch head has green:

- automated tests;
- strict TypeScript;
- Vite production build;
- Capacitor sync;
- Android Gradle assembly;
- debug APK artefact upload.

Real model quality is not evaluated in this pass. That begins in Phase 3B after the model-download/runtime harness is implemented.
