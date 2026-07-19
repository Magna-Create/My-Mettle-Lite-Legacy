# Phase 1 — Foundation and First Vertical Slice

This is an internal development build, not the release-gated usable product.

## Implemented

- React + TypeScript + Vite application shell.
- Capacitor configuration for Android.
- Five persistent top-level product areas: Brief, Train, Progress, Lab and Library.
- Repository abstraction with IndexedDB development adapter.
- Clean seeded dataset with ψ, φ, π and & routine structure.
- Deterministic & eligibility gate.
- Neutral A/B/C mode selection.
- Session creation using a routine-version snapshot.
- Immediate set autosave and active-session recovery from persisted state.
- Retained v8 rep-drop warning rule.
- Deterministic work-volume metric and calibration language.
- Micro-load experiment proposal, temporary activation, tested exposure and explicit routine promotion.
- Immutable routine version creation for manual edits and experiment promotion.
- JSON backup export and local reset.
- Unit tests for core constraints and the first vertical slice.

## Deliberately deferred

- Final product name, typefaces, palette and icon family.
- Native SQLite adapter and Kotlin storage bridge.
- Full exercise schema, reviews, timers, gestures and undo.
- Dynamic scheduler beyond the explicit & gate and active-experiment load override.
- Final personalised body assets and muscle graph.
- Sound, haptics and cinematic motion assets.
- Local AI bridge and knowledge packs.
- Full backup restore, migrations and Android file picker.
- Production onboarding and accessibility validation.

## Architectural decision

The browser build persists a single versioned aggregate through a repository interface. This keeps the first slice coherent while presentation and application code remain unaware of IndexedDB. The next storage work replaces the adapter with normalised native SQLite without changing feature contracts.
