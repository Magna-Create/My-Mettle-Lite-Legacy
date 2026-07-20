# My Mettle — Product Roadmap

_Last updated: 20 July 2026_

This document is the live product roadmap and the primary planning reference for development.

## Reference hierarchy

When project references disagree, use them in this order:

1. Current repository code and tests.
2. This roadmap and other current documents in `docs/`.
3. Accepted decisions recorded in active or merged pull requests.
4. The original master specification in `docs/spec/`.

The master specification remains the product foundation, but later accepted decisions supersede it where they conflict. Development is **Git-first**: inspect the current branch, current repository documents and relevant pull-request history before relying on an older exported project file or conversational memory.

## Current product direction

My Mettle is an adaptive personal training system that meets the user where they are, records training accurately, explains useful decisions without becoming chatty, and gradually develops a more personal visual and intelligent layer.

The interaction tone should be concise, British, direct and occasionally funny. Avoid reassurance-for-its-own-sake, therapist-style language and unnecessary explanation.

## Accepted interface and product decisions

### Navigation and header

- The bottom navigation is icon-only, compact and substantially narrower than a full-width dock.
- Its material should be light, translucent and liquid-glass-like, with blur, restrained refraction, a thin top highlight and colour interaction with content beneath.
- The selected icon is highlighted without expanding to reveal a text label.
- The current page name appears in the centre of the app header, slightly faded, between the `MY METTLE` wordmark and settings/profile controls.
- The accepted scroll-linked workout progress tint remains.
- Material Symbols selected for the primary bar are:
  - Brief: `cycle`;
  - Train: `sports_martial_arts`;
  - Progress: `analytics`;
  - Lab: `tactic`;
  - Library: `add_row_below`.
- Icons must be optically centred and use local bundled assets rather than network fonts.

### Brief

- Brief favours useful information over motivational or reassuring copy.
- Fuel guidance includes carbohydrate and protein quantities, plus water.
- Generic phrases such as “Ramp the first movement. No extra ceremony.” are replaced by concrete movement-aware warm-up guidance.
- The primary Begin action remains lower in the briefing sequence.
- A future preparation-confirmation gesture may let the user mark fuel, hydration and warm-up items as done without literal checkboxes; this belongs to Phase 3 unless required for dumb-input parity.

### Workout cards

- The current compact/expanded exercise-card system remains the working interaction model.
- Workout-card transitions should be slightly slower and calmer than the current implementation.
- A minimal, low-emphasis `Add set` action is available beneath prescribed sets.
- Additional sets remain visible as extra work and are distinguished from prescribed sets in stored data.
- Details opens a full-screen exercise surface.
- By Phase 2 completion, Details includes setup, technique cues, common mistakes, personal notes, equipment/machine settings, substitutions, recent performance and deterministic progression configuration.
- Character imagery remains deferred to the character/generative phase.

### Routine and exercise management

- The current routine is fully editable rather than append-only.
- Exercises can be reordered within a day, moved between days, edited, removed from the current routine, archived and restored.
- Permanent routine changes create a new immutable routine version; historical sessions retain their original routine and exercise snapshots.
- Exercise objects support category, equipment, target muscles, fatigue cost, skill difficulty, cues, common mistakes, personal setup/machine settings, notes and substitutions.
- Updating an exercise updates future routine use while historical session snapshots remain unchanged.
- Permanent deletion is only allowed for records with no historical references; normal removal uses routine removal or archive.

### Session history and amendments

- Profile contains a chronological Session History surface.
- Completed and abandoned sessions can be reviewed individually.
- A completed session can be amended: set values, notes and additional/accidental sets may be changed after completion.
- A session can be excluded from Progress/Lab while preserving the raw record, or permanently discarded with explicit confirmation.
- Amendments retain metadata such as original completion time and latest edit time.
- Historical calculations update from the amended session without mutating unrelated routine versions.

### Set editing

- The `Set updated` Undo toast dismisses after five seconds; a newer edit restarts the timer.
- Undo and exercise completion clear the toast immediately.
- Added sets use stable IDs and maintain contiguous display indices after removal.

### Rest timer

- The timer is an app-level object rather than part of an exercise card.
- Expanded rest mode lifts above the workout and softens content beneath.
- Controls include Pause/Resume, `+30`, Skip and Minimise.
- Minimise collapses the timer into a compact header widget that can be expanded again.
- Completion supports an optional chime and vibration levels: Low, Medium, Strong and Very strong.
- Timer settings live under `Settings → Workout → Rest timer`.
- Timing uses an absolute deadline.
- Android completion must remain reliable while My Mettle is backgrounded or the screen is off, using native scheduling and a timer notification.
- The project may request the permissions needed for exact alarms, notifications, vibration and foreground/background timer delivery; the personal user is expected to grant them.

### Settings architecture

- Settings use nested Android-style navigation rather than one continuously growing sheet.
- Initial groups are Workout, Units & measurements, Notifications & feedback, Data, Accessibility and About/diagnostics.
- Workout contains Rest timer and future set/session behaviour.
- Data contains export, restore and reset.

### Exercise creation and tracking

- The guided card-based creation flow and review screen remain.
- Inputs display measurement suffixes inside the field.
- Exercises define how performance is recorded rather than assuming ordinary kilograms.
- Tracking supports external load, assisted bodyweight, bodyweight, bodyweight plus external load, total/per-hand/per-side entry, repetitions, duration and distance.
- Historical sessions snapshot the applicable tracking definition so later edits do not reinterpret old data.

### Body measurements

- Profile contains timestamped weight and height records rather than one mutable value.
- Sessions retain the relevant bodyweight snapshot.
- Assisted and weighted bodyweight exercises can therefore calculate effective load historically.

### Health data architecture

- Health Connect is the primary Android interoperability layer and is implemented behind a provider interface.
- Phase 2 defines provider contracts, permission state, provenance, external-record identity and local observation storage.
- Phase 3 adds a bidirectional Health Connect adapter.
- My Mettle may read supported Samsung Health data exposed through Health Connect and write My Mettle-owned completed sessions and measurements.
- Stable client record IDs, record ownership and overlap detection prevent duplicate watch/My Mettle workouts.
- The Samsung Health Data SDK remains an optional richer read adapter.
- Imported physiological information is recovery/readiness evidence, not a direct CNS measurement or medical diagnosis.
- A Wear OS companion sits outside the first-alpha six-phase roadmap.

### Visual atmosphere

- The calm visual base is accepted but intentionally incomplete.
- Character creation precedes final cinematic integration because it affects composition and motion.
- The full cinematic pass happens after the main product surfaces and interaction architecture are mature.

## Development phases

### Phase 1 — Functional training loop

Status: foundation established.

- Offline-first application shell and persistence.
- Routine and immutable routine-version foundations.
- Session creation, exercise sequence and set entry.
- Cycle logic and day selection.
- Brief, Train, Progress, Lab and Library foundations.
- Initial Android build and local installation workflow.

### Phase 2 — Complete non-intelligent training product

Status: **reopened; implementation in progress.**

Phase 2 is complete only when My Mettle can replace the original gym web app as a reliable day-to-day “dumb input” tracker without depending on AI.

Already implemented:

- Tracking schemas and adaptive input fields.
- External, assisted, bodyweight and weighted-bodyweight calculations.
- Per-hand, per-side and total-load configuration.
- Repetition, duration and distance tracking.
- Timestamped body measurements and session snapshots.
- App-level rest timer, five-second Undo, Details foundation and schema migration.
- Compact navigation, centred header labels and health-provider foundations.

Remaining completion scope:

- Full routine editing: reorder, move, edit, remove, archive and restore.
- Complete exercise Details data: notes, substitutions, mistakes, setup and machine settings, deterministic progression configuration.
- Minimal additional-set creation and correction.
- Session history, completed-session amendment, exclusion and discard.
- Nested settings architecture.
- Native Android background timer scheduling and notification delivery.
- Four vibration strengths and reliable completion feedback outside the foreground app.
- Final Material Symbol hotbar assets and optical alignment.
- Slower workout-card transitions and remaining glass/highlight refinements.
- Concrete carbohydrate, protein and hydration quantities in Brief.
- Tests, migration coverage and an updated device bug-test plan for all parity functions.

Phase 2 exits into **bug testing only** after every item above is implemented and the automated web/Android build is green. No Phase 3 feature work begins before the Phase 2 device pass is accepted.

### Phase 3 — Product completion and training intelligence

- Useful Progress views, trends and comparisons.
- Full Lab experiment creation, operation and evaluation.
- Contextual Brief suggestions and preparation feedback.
- Dynamic warm-ups, fuel, water and readiness guidance.
- Progression, regression and training-recommendation logic.
- Clear explanation surfaces.
- Local AI/model integration with deterministic fallbacks.
- Bidirectional Health Connect adapter and duplicate controls.
- Optional Samsung Health Data SDK read adapter.

### Phase 4 — Character and generative visual system

- Base character identity, proportions and body model.
- Consistent face, clothing and rendering language.
- Exercise pose generation and control pipeline.
- Dot, particle or 2.5D treatment.
- Exercise-card imagery and expanded visuals.
- Character progression, consistency checks, correction, caching and local asset management.

### Phase 5 — Cinematic integration

- Animated Brief environments and blurred video/light backgrounds.
- Character integration, particles and atmospheric depth.
- Card transitions and spatial choreography.
- Timer focus and completion sequences.
- Tactile/audio language and refined liquid glass.
- Shared spring, blur, elevation and timing rules with reduced-motion equivalents.

### Phase 6 — Alpha hardening and personal release

Prepare **My Mettle Alpha 0.1** for a genuine month-long personal test:

- End-to-end and regression testing.
- Schema migration and data-integrity testing.
- Crash, interruption and background recovery.
- Battery, performance and local-model optimisation.
- Notification, vibration and timer reliability.
- Accessibility and reduced-motion verification.
- Exercise-tracking edge cases.
- Export, backup, restoration, stable signing and upgrade installation.
- Local diagnostic logs and final copy/visual consistency.

## Roadmap maintenance

Update this document whenever an accepted decision materially changes scope, phase order, product behaviour or the reference hierarchy. Retain the original master specification as the historical foundation rather than rewriting it to appear current.