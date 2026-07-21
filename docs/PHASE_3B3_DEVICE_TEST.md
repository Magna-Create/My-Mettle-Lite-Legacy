# Phase 3B.3 Device Gate — Model Pack and Real Heart

## Preparation

- Install this APK as an update over the existing My Mettle app.
- Do not uninstall or clear app data.
- Keep at least 12 GB free before downloading both additional generative models.
- Use stable Wi-Fi.
- Keep Battery Saver off for standard/deep inference tests.

## 1. Existing E2B persistence

1. Open Lab.
2. Confirm Gemma 4 E2B shows **Verified and ready** without downloading again.
3. Confirm the existing CPU/GPU benchmark result is still present.
4. Force-stop and reopen once more.
5. Confirm E2B remains ready.

Pass: the APK update reuses the 2.41 GB model already stored in app data.

## 2. Model-pack presentation

The Runtime Lab should show four capability entries:

- Gemma 4 E2B IT;
- Gemma 4 E4B IT;
- Qwen3-8B mixed INT4;
- EmbeddingGemma 300M Qualcomm SM8750.

Pass:

- E2B defaults to CPU;
- E4B defaults to GPU;
- Qwen defaults to GPU and shows 2,048-token context;
- EmbeddingGemma states that licence/access is required rather than offering a broken download.

## 3. E4B installation

1. Start the E4B download.
2. After progress advances, cancel it.
3. Confirm the partial size remains.
4. Resume.
5. Let download and SHA-256 verification complete.
6. Force-stop and reopen.
7. Confirm E4B remains **Verified and ready**.

Expected installed size is roughly 3.41 GiB as displayed by Android/Runtime Lab.

## 4. E4B benchmark

Run in this order:

1. GPU baseline;
2. CPU baseline;
3. NPU probe.

Record or screenshot each result.

The NPU probe may pass or fail. A valid failure:

- displays an error/result;
- does not crash My Mettle;
- does not silently report CPU/GPU;
- leaves the runtime idle afterwards;
- allows another CPU/GPU run.

## 5. Qwen3-8B installation

1. Start the Qwen download.
2. Test cancel/resume once.
3. Let the complete download finish.
4. Confirm Runtime Lab displays a **Pinned on device** SHA-256 digest.
5. Copy or screenshot that digest.
6. Force-stop and reopen.
7. Confirm Qwen remains ready and the same digest remains visible.

Expected installed size is roughly 4.55 GiB.

## 6. Qwen runtime

1. Select Qwen for benchmark.
2. Run the GPU baseline.
3. Confirm output is returned and the model unloads.
4. CPU is optional; stop it if the device becomes unresponsive or the run is excessively slow.

Pass:

- GPU run completes or fails cleanly with a visible runtime error;
- the app remains responsive after unload;
- result survives force-stop/reopen;
- peak PSS and timing are recorded.

Qwen does not expose an NPU button in this build.

## 7. Real autonomous Heart

With E2B and E4B installed:

1. Open MAIS Activity.
2. Press **Run synthetic heartbeat**.
3. Let the task settle.
4. Open **Role execution**.

Expected:

- Governor shows `google.gemma-4-e2b-it · CPU`;
- Analyst shows `google.gemma-4-e4b-it · GPU`;
- Auditor shows `google.gemma-4-e4b-it · GPU`;
- entries show `local_model`, not deterministic fallback;
- load/generation/unload timing is shown;
- each role advances through its persisted checkpoint;
- no model remains loaded after completion.

Then enable Battery Saver and create/pulse another task.

Expected:

- the Resource Governor remains Light;
- standard/deep steps defer;
- no E4B/Qwen inference begins.

## 8. Missing-model fallback

Before downloading one model—or temporarily after deleting E4B only:

1. Run a synthetic heartbeat.
2. Inspect **Role execution**.

Expected:

- E2B Governor can run locally;
- unavailable E4B roles complete through deterministic fallback;
- the exact missing-model reason is shown;
- the task does not become corrupt or permanently stuck.

Reinstalling E4B should make later matching role steps local again.

## 9. Typed evidence smoke test

Complete or amend a real training session, then let the Heart pulse.

Inspect the resulting Governor/Analyst artefacts through Role execution and the exported Report Card.

Pass:

- source is labelled `local_model` when its model is installed;
- provenance includes the real session/event IDs;
- no invented ID survives output validation;
- reflection and completed set evidence can influence the artefact;
- an excluded session is not silently treated as ordinary comparable evidence.

## 10. Report Card

1. Press **Export report card**.
2. Confirm the Android message names a file in `Downloads/My Mettle`.
3. Verify the JSON file exists.
4. Confirm it includes recent artefacts with `execution.source`, model ID, backend and timings.

## 11. Persistence and cleanup

1. Force-stop and clear cache.
2. Reopen.
3. Confirm installed models, pinned Qwen digest, runtime results, Heart tasks and role-execution records remain.
4. Delete one model from Runtime Lab.
5. Confirm only that model and its partial/verification state disappear.
6. Confirm training history and other models remain.

## Stop conditions

Stop a benchmark and report the visible error if:

- the whole app closes;
- Android reports repeated application crashes;
- the phone UI freezes after the model should have unloaded;
- a run claims a different backend than the selected one;
- the existing E2B model disappears after the update;
- Qwen's pinned digest changes across an ordinary force-stop/reopen;
- Heart applies any routine/database mutation without explicit approval.
