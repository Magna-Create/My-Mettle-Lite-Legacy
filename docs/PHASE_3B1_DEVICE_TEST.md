# Phase 3B.1 — Model Installer Device Test

This pass validates model artefact installation only. It does not run inference yet.

## Before testing

- Use stable Wi-Fi.
- Keep My Mettle open during the first download.
- Confirm at least 3.5 GB of free storage.
- Battery Saver may remain off for the first complete download.

## Install build

Build the branch APK, install it over the existing app and open **Lab**.

The new **MAIS Runtime Lab · Phase 3B** panel should show:

- Gemma 4 E2B IT;
- LiteRT-LM 0.14.0;
- approximate model size;
- current free storage;
- `Not installed` state.

## Test A — Start and cancel

1. Tap **Download model**.
2. Confirm the progress bar and byte count advance.
3. Navigate to another tab and return to Lab.
4. Confirm progress continues and the UI remains responsive.
5. Tap **Cancel download**.
6. Confirm the state becomes `Partial download` and retained bytes are shown.

Pass condition: cancellation does not delete the partial file and does not disturb training data.

## Test B — Resume

1. Tap **Resume download**.
2. Confirm progress resumes from the retained byte count rather than zero.
3. Leave the screen on Lab or another app tab until completion.

Pass condition: the download reaches verification without restarting the whole file.

## Test C — Verification

After download completion:

1. The panel may remain on `Verifying` while Android hashes the 2.59 GB file.
2. Confirm the final state becomes **Verified and ready**.
3. Confirm Integrity reads **SHA-256 verified**.
4. Force-stop My Mettle and reopen it.
5. Return to Lab.

Pass condition: the verified state persists without rehashing the file on every launch.

## Test D — Battery Saver and navigation

1. Enable Battery Saver during an active or partial download.
2. Confirm the download itself remains controllable.
3. Confirm the existing MAIS Heart resource mode still changes to Light.
4. Navigate through Train, Brief, Progress and Library.

Pass condition: the installer does not break Phase 2 or Phase 3A behaviour.

## Test E — Delete and reinstall state

1. Tap **Delete model** and confirm.
2. Confirm the state returns to `Not installed`.
3. Confirm retained partial bytes are zero.
4. Force-stop and reopen the app.
5. Confirm the model remains absent.

Pass condition: final model, partial file and verification sidecar are all removed while sessions, routines and MAIS Heart history remain intact.

## Expected limitations

- the model does not generate text yet;
- download is foreground-process development behaviour;
- Android may stop the operation if the process is killed;
- a killed partial download should remain resumable on reopening;
- the first full verification may take noticeable time;
- model bytes are not included in app backup/export.

## Failure information

Record:

- panel state;
- displayed downloaded/partial bytes;
- available storage;
- exact error message;
- whether resume restarted at zero;
- whether the app was foregrounded, backgrounded or force-stopped;
- whether Battery Saver was active.
