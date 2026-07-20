# Changelog

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
