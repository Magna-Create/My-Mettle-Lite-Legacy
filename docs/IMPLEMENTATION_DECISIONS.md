# Phase 1 Implementation Decisions

## Working identity

`Gym App` and `dev.kian.gymapp` are development placeholders. They do not resolve the open product-name decision.

## Storage

The browser/development build stores one versioned application aggregate in IndexedDB behind `GymRepository`. This is intentionally temporary infrastructure, not permission for features to access IndexedDB directly. The next persistence adapter should normalise records in native SQLite while keeping the repository and application contracts stable.

## State and autosave

Persistent operations are serialised through an application queue. This prevents rapid set-entry changes from racing and overwriting one another while preserving immediate autosave behaviour.

## Training cycles

Training-cycle state is explicit. Completing ψ, φ and π makes & eligible. Beginning a core day at that point closes the old cycle and creates a new one; completing & also closes the old cycle and opens the next. This is a conservative Phase 1 interpretation pending the final calendar/cycle edge-case rules.

## Experiments

A progression experiment belongs to an exact routine slot rather than merely an exercise identity. Its temporary load is applied only at the next matching exposure. Promotion creates a new routine version and requires explicit user confirmation.

## Analytics

The first metric is work volume: load × repetitions across completed work sets. Estimated-strength formulae remain unresolved in the specification, so none were silently selected.

## Visual layer

The current light-paper palette, system/Georgia typography, glyph icons and abstract body surface are implementation scaffolding. They establish hierarchy, atmosphere and component contracts but are not final brand or body assets.
