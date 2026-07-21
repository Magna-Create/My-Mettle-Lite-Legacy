# Phase 3B.2 — Real LiteRT-LM Device Gate

Status: device test for the first real on-device model inference.

## Purpose

This pass verifies that the previously downloaded and SHA-256-verified Gemma 4 E2B artefact can be reused after an APK update, loaded through LiteRT-LM 0.14.0, prompted locally, measured and fully unloaded.

The MAIS Heart remains on its deterministic Phase 3A role runner during this gate. A successful baseline proves the runtime; it does not yet grant the model autonomous work.

## Install without deleting the model

Build and install this branch as an update over the existing app.

Do not uninstall the app and do not use Android **Clear data**. Both remove app-private model storage. Normal updates and **Clear cache** preserve it when the application ID and signing certificate remain unchanged.

After updating:

1. Open Lab.
2. Confirm Gemma 4 E2B still shows **Verified and ready** without downloading again.
3. Confirm training data and the MAIS task ledger are unchanged.

## Report Card export regression

1. Tap **Export report card**.
2. Confirm Android reports a saved filename.
3. Open the Files app.
4. Locate the JSON file in `Downloads/My Mettle`.
5. Confirm it is non-empty and opens as text/JSON.

## CPU baseline

1. Keep Battery Saver off and do not begin a workout.
2. Tap **Run CPU baseline**.
3. The state should progress through loading and generating.
4. The app must remain responsive enough to scroll and navigate.
5. Wait for a persisted result card.
6. Confirm the result includes:
   - generated local text;
   - model load time;
   - first chunk latency;
   - generation time;
   - unload time;
   - total time;
   - peak PSS memory.
7. Confirm the output follows the bounded two-sentence request reasonably closely.
8. Note any heat, severe stutter or Android process termination.

## Persistence

1. Force-stop My Mettle after the CPU result completes.
2. Reopen Lab.
3. Confirm:
   - the model remains **Verified and ready**;
   - the CPU result remains visible;
   - no new model download occurs;
   - the runtime says idle rather than incorrectly claiming a run is active.

## GPU baseline

1. Tap **Run GPU baseline**.
2. Confirm the run either:
   - completes with generated text and telemetry; or
   - fails cleanly with a visible diagnostic rather than crashing the app.
3. Compare CPU and GPU:
   - load time;
   - first chunk latency;
   - generation time;
   - peak PSS;
   - app responsiveness.
4. Force-stop and reopen once more to confirm the latest result persists.

GPU failure does not invalidate the CPU runtime path. It determines whether the first production backend is CPU or GPU on the target phone.

## Cancellation

1. Start either backend again.
2. Tap **Cancel run** while it is loading or generating.
3. Confirm the app returns to an idle state.
4. Confirm a cancelled/failed result is visible rather than a permanently active runtime.
5. Start a fresh baseline to prove cleanup released the previous engine.

## Regression checks

- Battery Saver still changes MAIS to Light.
- Starting a workout still changes MAIS to Light.
- The rest timer still works.
- Training history, routine versions and model verification remain intact.
- Clearing MAIS state does not delete the model.
- Deleting the model remains a separate explicit action.

## Exit gate

Phase 3B.2 passes when:

- an APK update reuses the existing model without redownload;
- native Report Card export works;
- at least one LiteRT-LM backend produces real local text;
- full load/generate/unload telemetry is persisted;
- force-stop recovery is correct;
- cancellation leaves no stuck engine;
- Phase 2 and Phase 3A behaviour remains intact.

After this gate, one bounded MAIS role may be routed through the real model while all other roles retain deterministic fallback.
