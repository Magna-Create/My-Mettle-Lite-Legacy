# Changelog

## 0.5.0 — Phase 3A MAIS substrate

- Added the MAIS Heart with passive events, prioritised tasks, bounded role episodes and durable checkpoints.
- Added a self-advancing foreground heartbeat that performs no model work while idle.
- Added a separate persistent MAIS IndexedDB database and process-recovery coordinator.
- Added Full, Standard, Light and Paused resource modes using app visibility, Battery Saver, active workout state, explicit pause and available memory.
- Added a native Android bridge for lifecycle, Battery Saver, charging and memory state; thermal policy remains delegated to Android and the inference runtime.
- Added the MCP-like MAIS Capability Protocol with exact proposal fingerprints, approval receipts, validated transactions and rollback.
- Added real capability executors for routine movement, slot duplication/removal and approved new-exercise creation through existing domain services.
- Added model manifests, role/tier routing and exclusive load/run/unload leases using a deterministic simulated runtime.
- Added a provenance-first Context Compiler with evidence inclusion/exclusion manifests and hard context budgets.
- Added the declarative Widget Foundry with safe mode, removal and recreation blocking.
- Added the generated-analysis sandbox contract and prohibited-API validator.
- Added the scarce, batched Research Broker and cited-report import contract.
- Added the domain-specific Reinforcement Ledger.
- Added MAIS Report Card export and Parent Review import contracts.
- Added a basic MAIS Activity framework console inside Lab and a comprehensive Android device-test checklist.
- Separated Phase 3 functional intelligence from Phase 3.5 interface productisation and moved real model/runtime evaluation into Phase 3B.

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
