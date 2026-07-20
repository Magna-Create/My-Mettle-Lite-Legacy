# My Mettle — Product Roadmap

_Last updated: 20 July 2026_

This document is the live product roadmap and the primary planning reference for development.

## Reference hierarchy

When project references disagree, use them in this order:

1. Current repository code and tests.
2. This roadmap and other current documents in `docs/`.
3. Accepted decisions recorded in active or merged pull requests.
4. The original master specification in `docs/spec/`.

The master specification remains the product foundation, but it is no longer assumed to describe every current decision. Later accepted decisions supersede it where they conflict.

Development should therefore be **Git-first**: inspect the current branch, repository documents and relevant pull-request history before relying on an older exported project file or conversational memory.

## Current product direction

My Mettle is an adaptive personal training system that meets the user where they are, records training accurately, explains useful decisions without becoming chatty, and gradually develops a more personal visual and intelligent layer.

The interaction tone should be concise, British, direct and occasionally funny. Avoid reassurance-for-its-own-sake, therapist-style language and unnecessary explanation.

## Accepted interface decisions

### Navigation and header

- The bottom navigation becomes icon-only and substantially narrower than the current full-width bar.
- It should remain comfortably tappable while reading as a compact floating object rather than a dock.
- The material becomes lighter, more translucent and more liquid-glass-like, with blur, subtle refraction, a fine highlight and colour interaction with content beneath.
- The selected icon is highlighted without expanding to show a text label.
- The current page name appears in the centre of the app header, slightly faded, between the `MY METTLE` wordmark and settings/profile controls.
- During an active workout, the header may show contextual session information while retaining the scroll-linked progress tint.
- The existing header progress-fill behaviour is accepted and should be preserved.

### Brief

- Brief should favour useful information over motivational or reassuring copy.
- Fuel and water guidance remain.
- Generic phrases such as “Ramp the first movement. No extra ceremony.” should be replaced by concrete movement-aware warm-up guidance.
- The primary Begin action remains lower in the briefing sequence.
- Future Brief content will be informed by the complete routine, recent training data and local intelligence.

### Workout cards

- The current compact/expanded exercise-card system is accepted as the working interaction model.
- A swipe-through deck is optional future exploration, not a requirement.
- Exercise cards need a separate Details action that can open a full-screen information surface.
- Details may contain setup, technique, notes, recent performance, substitutions, progression logic, Lab tests and later character imagery.

### Set editing

- The `Set updated` Undo toast should dismiss automatically after five seconds.
- A newer edit restarts the five-second timer.
- Undo and exercise completion clear the toast immediately.

### Rest timer

- The timer should become an app-level object rather than remaining embedded inside the exercise card.
- Expanded rest mode lifts above the workout and may soften or blur content beneath.
- Controls include Pause/Resume, `+30`, Skip and Minimise.
- Minimise collapses the timer into a compact header or dynamic-island-style widget that can be expanded again.
- Completion should support strong vibration and an optional short chime.
- Timer-completion preferences live under general app settings.
- Timing should be based on an absolute end timestamp so it remains accurate while backgrounded or throttled.

### Exercise creation and tracking

- The guided card-based creation flow and final review page are accepted.
- Inputs should display their unit or measurement suffix inside the field where relevant.
- “Planned load” should be replaced by clearer context-dependent language such as Starting load, Assistance, Added load, Duration or Distance.
- Exercises must define how performance is recorded rather than assuming every movement uses ordinary kilograms.

Initial tracking dimensions should support:

- external load;
- assisted bodyweight;
- bodyweight only;
- bodyweight plus external load;
- load per hand, per side or total;
- repetitions only;
- duration;
- distance.

Historical sessions must snapshot the applicable tracking definition so later edits do not reinterpret old training data.

### Body measurements

- Profile data should include timestamped weight and height records rather than one mutable value.
- Sessions should retain the bodyweight snapshot relevant at the time.
- Assisted and weighted bodyweight exercises can then calculate effective load historically, even after bodyweight changes.

### Health data architecture

- Health Connect is the primary Android interoperability layer and should be implemented as a provider interface rather than coupled directly to product logic.
- Phase 2 defines provider contracts, permission state, provenance, external-record identity and local observation storage; it does not require a live native connection to finish.
- Phase 3 adds a bidirectional Health Connect adapter.
- My Mettle may read supported Samsung Health data exposed through Health Connect, including exercise, heart rate, sleep and measurements when permission is granted.
- My Mettle may write completed strength-training sessions and supported measurements to Health Connect. Samsung Health can then synchronise supported Health Connect records into Samsung Health when the user enables the relevant permissions.
- Written exercise sessions should use stable client record IDs and include segment detail where Health Connect supports repetitions, weight and set index.
- My Mettle writes only records it owns. Data read from Health Connect must not be written back as though it originated in My Mettle.
- Before exporting a workout, detect materially overlapping external exercise sessions and ask the user which record should be kept to avoid duplicate Samsung/watch and My Mettle sessions.
- The Samsung Health Data SDK remains an optional richer read adapter. Direct writes through that SDK require Samsung partnership credentials and are not required for the personal alpha.
- Imported physiological information is recovery/readiness evidence, not a direct measurement of the central nervous system and not a medical diagnosis.
- A Wear OS companion and live sensor stream sit outside the first-alpha six-phase roadmap. Revisit only after the month-long alpha demonstrates a clear benefit.

### Visual atmosphere

- The current calm visual base is accepted, but it is intentionally incomplete.
- Full cinematic energy should be applied after the main product surfaces and interaction architecture are mature.
- Character creation precedes the final cinematic integration because it affects composition, card design and motion.

## Development phases

### Phase 1 — Functional training loop

Status: foundation established.

- Offline-first application shell and persistence.
- Routine and immutable routine-version foundations.
- Session creation, exercise sequence and set entry.
- Cycle logic and day selection.
- Brief, Train, Progress, Lab and Library foundations.
- Initial mobile Android build and local installation workflow.

### Phase 2 — Accurate training representation

Status: **implementation complete; bug testing only.**

The Phase 2 completion candidate passed the automated test suite, production web build, Capacitor synchronisation and Android debug APK build. No new Phase 2 features should be added. Changes are limited to defects discovered through `docs/PHASE_2_BUG_TEST_PLAN.md`.

Implemented scope:

- Exercise tracking schemas and adaptive input fields.
- External, assisted, bodyweight and weighted-bodyweight calculations.
- Per-hand, per-side and total-load configuration.
- Repetition, duration and distance tracking.
- Timestamped body-measurement history.
- Session bodyweight and tracking snapshots.
- App-level rest timer with pause, minimise and completion feedback.
- General timer settings.
- Exercise Details overlay.
- Set correction, five-second Undo lifecycle and interrupted-session recovery.
- Narrow icon-only liquid-glass navigation and centred header page labels.
- Visible layout, clipping, shadow and contrast fixes.
- Health-data provider contracts, permission state, provenance and external-record identity.
- Database migrations that preserve existing local data while adding the Phase 2 schema.

Phase 2 exits bug testing only after its defects are accepted or resolved. Phase 3 feature work must not begin before that decision.

### Phase 3 — Product completion and training intelligence

Complete the major product surfaces while intelligence is built into them.

- Useful Progress views, trends and comparisons.
- Full Lab experiment creation, operation and evaluation.
- Profile and measurement-history management.
- Complete settings and routine-management flows.
- Contextual Brief suggestions.
- Dynamic warm-ups, fuel, water and readiness guidance.
- Progression, regression and training-recommendation logic.
- Clear explanation surfaces showing why a recommendation was made.
- Local AI/model integration where useful.
- Deterministic fallbacks so core behaviour never depends entirely on model output.
- Bidirectional Health Connect adapter for supported reads and My Mettle-owned writes.
- Duplicate detection and record-ownership controls for watch-recorded and My Mettle-recorded workouts.
- Optional Samsung Health Data SDK read adapter where it offers data or provenance not available through Health Connect.

### Phase 4 — Character and generative visual system

Develop the character and the AI-assisted tools used to create consistent visual content.

- Base character identity, proportions and body model.
- Consistent face, clothing and rendering language.
- Exercise pose generation and pose-control pipeline.
- Dot, particle or 2.5D visual treatment.
- Exercise-card imagery and expanded exercise visuals.
- Character progression over time.
- Consistency checks, image correction, caching and local asset management.
- Generative-image assistance that supports the defined art direction rather than deciding it.

### Phase 5 — Cinematic integration

Apply the mature motion, sound and visual-world language throughout the product.

- Animated Brief environments and blurred video/light backgrounds.
- Character integration across appropriate surfaces.
- Particles, atmospheric depth and scroll-linked effects.
- Card transitions and spatial choreography.
- Timer focus mode and completion sequences.
- Tactile and audio language.
- Refined liquid-glass materials.
- Shared spring, blur, elevation and timing rules.
- Reduced-motion equivalents.

### Phase 6 — Alpha hardening and personal release

Prepare the first complete alpha for a genuine month-long personal test.

- End-to-end and regression testing.
- Schema migration and data-integrity testing.
- Crash, interruption and background recovery.
- Battery, performance and local-model optimisation.
- Notification, vibration and timer reliability.
- Accessibility and reduced-motion verification.
- Exercise-tracking edge cases.
- Export, backup and restoration.
- Stable signing and upgrade installation.
- Local diagnostic logs.
- Final copy and visual-consistency pass.

Target output:

> **My Mettle Alpha 0.1 — personal month-long test**

That month should produce evidence for Alpha 0.2: which recommendations help, which interactions become irritating through repetition, which data is missing and which cinematic elements remain useful in daily use.

## Roadmap maintenance

Update this document whenever an accepted decision materially changes scope, phase order, product behaviour or the reference hierarchy. Do not rewrite the original master specification merely to make it appear current; retain it as the historical foundation and record active direction here.
