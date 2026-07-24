# Changelog

## 0.5.1 — Qwen GenieX Android integration

- Added the supported `com.qualcomm.qti:geniex-android:0.3.5` Maven dependency.
- Replaced the custom JNI/dlopen and private QAIRT ZIP path with Qualcomm's public `GenieXSdk` and `LlmWrapper` APIs.
- Bundled the QAIRT plugin through the ordinary APK/AAB build so users do not need WSL, a Qualcomm SDK installation, Termux runtime staging or a manual runtime import.
- Preserved the existing resumable, verified 15-file Qwen3-4B 12K model installer.
- Added thinking-enabled chat-template generation, streaming output, supported cancellation, profiler telemetry and deterministic wrapper destruction.
- Kept raw Qwen reasoning ephemeral while persisting the final response and aggregate runtime metrics.
- Raised the Android minimum from API 26 to API 27 to meet the supported GenieX Android library contract rather than forcing an unsafe manifest override.

## 0.5.0 — MAIS runtime laboratory

- Added resumable, SHA-256-verified installation of app-private local model artefacts.
- Installed the first official Gemma 4 E2B LiteRT-LM model outside Git and the APK.
- Added native LiteRT-LM 0.14.0 CPU/GPU baseline inference with explicit load, generation and unload lifecycle.
- Added persistent runtime telemetry for load time, first response chunk, generation, unload, total duration and peak PSS memory.
- Added cancellable one-shot runtime checks while keeping the autonomous MAIS Heart on deterministic fallback.
- Replaced the Android-incompatible browser Blob Report Card export with native MediaStore export to `Downloads/My Mettle`.
- Documented update persistence: signed APK updates retain model files; uninstalling or clearing app data removes them.

## 0.4.1 — Phase 2 final polish

- Removed visible numeric pills from exercise-reflection sliders.
- Added crisp tactile feedback to reflection sliders and response buttons, with stronger feedback at scale extremes.
- Split target engagement into a documented 0–7 scale while keeping enjoyment on 1–7.
- Made setup notes editable from workout Additional Details and saved them back to the shared exercise record on close.
- Added an editable YouTube/video-reference field to Additional Details and Library exercise management.
- Retired exercise-level Personal Notes so session-specific thoughts remain attached to session reflections.
- Added the Phase 3 AI-interface contract describing subjective scale semantics, uncertainty and inference boundaries.
- Bumped the local data schema to version 4 with migration and backup coverage.

## 0.4.0 — Phase 2 completion candidate

- Added versioned exercise-tracking definitions for external load, assistance, bodyweight, added load, repetitions, duration and distance.
- Added per-hand, per-side and total-load entry semantics.
- Added timestamped weight and height history with session bodyweight snapshots.
- Added non-destructive migration from the Phase 1 local database schema.
- Made exercise creation, set entry, work-volume evidence and Lab progression tracking-aware.
- Made assisted-bodyweight progression reduce assistance rather than increase it.
- Rebuilt the rest timer as a recoverable app-level focus surface with pause, resume, minimise, `+30`, skip, vibration and optional chime.
- Added general rest-timer preferences.
- Added a five-second Undo lifecycle for set edits.
- Added the full-screen exercise Details foundation.
- Replaced the expanding navigation labels with a narrower icon-only liquid-glass bar and centred header context.
- Preserved the scroll-linked workout progress tint.
- Added health-provider contracts, provenance, stable export identities and duplicate-detection boundaries for later Health Connect integration.
- Added Phase 2 migration, tracking and assisted-bodyweight tests.

## 0.3.1 — Mobile hardening

- Kept the exercise-card wizard inside the dynamic mobile viewport when the keyboard opens.
- Added sticky wizard actions for small screens.
- Added clear keyboard-focus treatment.
- Added a reduced-motion fallback for atmospheric and card animations.

## 0.3.0 — Phase 2 foundations

- Replaced the single exercise form with a card-based guided flow.
- Added local JSON exercise import with validation.
- Added automatic rest timing, +30-second extension and skip controls.
- Added one-step undo for load and repetition edits.

## 0.2.0 — Phase 1 interaction refinement

- Renamed the in-app shell to My Mettle and split profile/settings controls.
- Reworked Brief copy, pre-session suggestions and action placement.
- Replaced A/B/C display language with compact, human mode names.
- Added stacked compact/expanded exercise-card states.
- Added persistent workout progress tint in the sticky app header.
- Reduced navigation mass and increased card/background separation.

## 0.1.0 — Phase 1 foundation

- Added React/TypeScript/Vite application shell and five-area navigation.
- Added Capacitor Android project.
- Added repository-based IndexedDB persistence and serialised autosave.
- Added explicit training cycles, ψ/φ/π/& gate and neutral A/B/C selection.
- Added session/set workflow, rep-drop protection and work-volume evidence.
- Added exercise creation and immutable routine versioning.
- Added controlled micro-load experiment and explicit promotion workflow.
- Added JSON export/reset controls and automated tests.
