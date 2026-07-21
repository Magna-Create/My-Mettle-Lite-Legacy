# My Mettle — Product Roadmap

_Last updated: 21 July 2026_

This document is the live product roadmap and the primary planning reference for development.

## Reference hierarchy

When project references disagree, use them in this order:

1. Current repository code and tests.
2. This roadmap and other current documents in `docs/`.
3. Accepted decisions recorded in active or merged pull requests.
4. The original master specification in `docs/spec/`.

The master specification remains the product foundation, but later accepted decisions supersede it where they conflict. Development is **Git-first**: inspect the current branch, repository documents and relevant pull-request history before relying on an older exported project file or conversational memory.

## Current product direction

My Mettle is an adaptive personal training system that meets the user where they are, records training accurately and develops a persistent local intelligence capable of investigating accumulated evidence, designing reversible experiments and deploying context-sensitive training decisions.

The interaction tone remains concise, British, direct and occasionally funny. Avoid reassurance-for-its-own-sake, therapist-style language and unnecessary explanation.

The intelligence is structural rather than decorative. Deterministic systems establish trustworthy evidence, constraints and transactions; MAIS conducts inquiry, plans analyses, forms and revises hypotheses, proposes experiments and decides what matters in context.

## Accepted interface and product decisions

### Navigation and header

- The bottom navigation is icon-only, compact and narrower than a full-width dock.
- Its material is light, translucent and liquid-glass-like, with blur, restrained refraction and a thin highlight.
- The selected icon does not expand into a text label.
- The current page name appears in the centre of the app header.
- The accepted scroll-linked workout progress tint remains.
- Primary symbols remain locally bundled assets:
  - Brief: `cycle`;
  - Train: `sports_martial_arts`;
  - Progress: `analytics`;
  - Lab: `tactic`;
  - Library: `add_row_below`.

### Brief

- Brief favours useful information over motivational or reassuring copy.
- Fuel guidance includes carbohydrate, protein and water quantities.
- Warm-up guidance is movement-aware rather than generic.
- The primary Begin action remains lower in the briefing sequence.
- Preparation acknowledgement may use a deliberate tactile gesture without literal checkboxes, streaks or guilt.
- Brief becomes the deployment surface for current MAIS knowledge, active experiments and temporary session adaptations.

### Workout and exercise details

- The compact/expanded exercise-card system remains the working interaction model.
- A low-emphasis `Add set` action sits beneath prescribed sets.
- Additional sets remain explicitly distinguishable from prescribed work.
- Exercise Details includes setup, technique cues, common mistakes, machine settings, substitutions, video reference and recent evidence.
- Setup Notes and the video reference are editable during a workout and save to shared exercise memory.
- Exercise-level Personal Notes are retired; session-specific thoughts belong to reflections.
- Character imagery remains deferred to Phase 4.

### Routine and exercise management

- The current routine is fully editable.
- Exercises can be reordered, moved, duplicated, edited, removed, archived and restored.
- Permanent routine changes create a new immutable routine version.
- Historical sessions retain original routine and exercise snapshots.
- Updating an exercise affects future use without rewriting history.
- Normal removal uses routine removal or archive rather than destructive deletion.
- MAIS never receives direct database write access. It submits typed proposals through the Capability Protocol.
- Permanent AI-proposed changes require exact user approval tied to the proposed payload.

### Session history and amendments

- Profile contains chronological Session History.
- Completed and abandoned sessions can be reviewed individually.
- Completed sessions may be amended without mutating unrelated routine versions.
- Sessions may be excluded from intelligence while preserving raw evidence, or discarded with explicit confirmation.
- Amendments retain original completion and latest-edit metadata.

### Rest timer

- The timer is app-level rather than embedded in an exercise card.
- Expanded rest mode lifts above the workout and softens content beneath.
- Controls include Pause/Resume, `+30`, Skip and Minimise.
- Minimise produces a compact header widget.
- Completion supports optional chime and four vibration strengths.
- Android completion remains reliable while backgrounded or screen-off through native scheduling and notification delivery.

### Exercise creation and tracking

- The guided creation flow and review screen remain.
- Exercises define their tracking semantics rather than assuming ordinary kilograms.
- Tracking supports external load, assistance, bodyweight, bodyweight plus external load, per-hand/per-side/total entry, repetitions, duration and distance.
- Historical sessions snapshot tracking definitions and bodyweight context.

### Health data

- Health Connect is the primary Android interoperability layer behind a provider interface.
- My Mettle may read supported Samsung Health data exposed through Health Connect and write My Mettle-owned sessions and measurements.
- Stable client IDs, ownership and overlap detection prevent duplicate workouts.
- Samsung Health Data SDK remains an optional richer read adapter.
- Imported physiology is contextual readiness evidence, not a direct CNS measurement or medical diagnosis.
- Wear OS sits outside the first-alpha roadmap.

### MAIS operating principles

- MAIS is an event-driven local research and action system, not a chatbot or one long conversation.
- The Heart advances bounded role steps and persists checkpoints between model loads.
- Models communicate through typed Workbench artefacts rather than transcript accumulation.
- One generative model is leased at a time.
- Context is compiled afresh with provenance and a hard budget.
- External research is an infrequent, batched escalation tool.
- Generated widgets are declarative, attributable, permission-scoped and removable.
- AI-created UI has safe mode and a user blocklist.
- The app stops model work when closed. Battery Saver, background state and active workout interaction reduce work to Light mode.
- Thermal throttling is delegated to Android and the selected runtime during the current development phase; MAIS does not independently poll or gate on thermal state.
- Permanent product-state changes remain subject to exact approval.

## Development phases

### Phase 1 — Functional training loop

Status: **complete foundation**.

- Offline-first shell and persistence.
- Routine/version foundations.
- Session creation, sequence and set entry.
- Cycle logic and day selection.
- Brief, Train, Progress, Lab and Library foundations.
- Android build and local installation workflow.

### Phase 2 — Complete non-intelligent training product

Status: **complete and device accepted**.

My Mettle can replace the original gym web app as a reliable day-to-day tracker without AI.

Completed scope includes:

- all supported tracking schemas and effective-load calculations;
- body measurements and historical snapshots;
- app-level native rest timer and completion feedback;
- additional sets and set amendment;
- Session History, exclusion, discard and restoration;
- exercise reflection and editable exercise memory;
- routine reconstruction, drag movement, duplication, archive and recovery;
- nested functional settings and data controls;
- schema v4 migration, backup coverage and Android device testing.

### Phase 3 — MAIS functional intelligence platform

Phase 3 prioritises a working intelligence system and basic framework UI. Final presentation belongs to Phase 3.5.

#### Phase 3A — MAIS substrate

Status: **implementation candidate complete; device framework pass pending**.

- MAIS system and autonomy contract.
- Immutable event journal and Heart pulse/episode state machine.
- Persistent Workbench, checkpoints and process recovery.
- independent MAIS IndexedDB database.
- MCP-like Capability Protocol.
- exact proposal fingerprints and approval receipts.
- transactional execution and rollback.
- real routine-rearrangement and add-exercise domain executors.
- model registry and exclusive load/run/unload leases.
- deterministic simulated runtime for framework testing.
- resource modes driven by visibility, Battery Saver, workout interaction, explicit pause and available memory.
- native Android lifecycle/Battery Saver/memory bridge.
- provenance-first Context Compiler and evidence manifests.
- declarative Widget Foundry, safe mode and recreation blocklist.
- generated-analysis sandbox contract and validator.
- infrequent Research Broker.
- domain-specific Reinforcement Ledger.
- Report Card export and Parent Review import.
- basic Lab-based MAIS Activity console.
- automated web, strict TypeScript and Android regression coverage.

Phase 3A ends after the device verifies persistence, Battery Saver behaviour, passive event ingestion, simulated lease cycles and Report Card export.

#### Phase 3B — Runtime laboratory and real model integration

- verified model-download and deletion pipeline;
- app-private model storage and manifest/checksum enforcement;
- LiteRT-LM adapter;
- ExecuTorch comparison adapter where useful;
- EmbeddingGemma retrieval benchmark;
- Gemma 4 E2B fast-governor benchmark;
- Gemma 4 E4B general reasoning/audit benchmark;
- Qwen3-8B Deep Lab benchmark;
- load/unload, context, memory, latency and battery measurements;
- MAIS-specific structured-output and capability-call evaluations;
- selected model topology with deterministic/simulated fallback.

#### Phase 3C — Evidence, memory and belief system

- comparable-exposure engine across all tracking types;
- derived metrics with algorithm provenance;
- stable muscle ontology and contribution metadata;
- hierarchical episodic and semantic memory;
- embeddings and retrieval indexes;
- belief/hypothesis graph with support, counter-evidence and uncertainty;
- unresolved-question and rejection memory;
- synthetic histories at 10, 50, 200 and 1,000 sessions.

#### Phase 3D — Analyst, code laboratory and auditor

- AI-driven investigation selection;
- competing hypotheses and confound identification;
- isolated generated-code execution against immutable snapshots;
- reproducible analyses and sensitivity checks;
- independent audit passes;
- background task queue while the app remains open;
- reinforcement updates from experiment and user outcomes;
- higher-capability Report Card review workflow.

#### Phase 3E — Functional Progress, Lab and Brief

Use plain, test-oriented interfaces first.

- Progress exposes beliefs, trends, uncertainty and evidence.
- Lab generates, activates, monitors and evaluates controlled experiments.
- Successful experiments may create routine proposals for approval.
- Brief selects relevant current knowledge and active interventions.
- Scheduler applies reversible temporary session changes.
- Versioned nutrition and warm-up rules.
- simple generated widgets and activity/debug views.

#### Phase 3F — Health Connect and external evidence

- bidirectional Health Connect adapter;
- ownership and duplicate-workout linking;
- physiological context in readiness evidence;
- research dossier export/import;
- optional constrained network broker later;
- optional Samsung Health Data SDK read adapter.

#### Phase 3G — Integrated intelligence alpha

The north-star test is:

1. passive evidence wakes MAIS;
2. MAIS notices a non-obvious relationship;
3. it retrieves the right evidence;
4. it creates and executes a reproducible analysis;
5. an auditor challenges the result;
6. Lab proposes a reversible experiment;
7. Brief and Train deploy it;
8. later evidence is evaluated;
9. the belief is revised;
10. a permanent routine change is offered for exact approval;
11. the full trace survives interruption and appears in the Report Card.

### Phase 3.5 — Intelligence interface and productisation

Transform the functional Phase 3 surfaces into the accepted My Mettle experience.

- body-region Progress interface;
- polished evidence, uncertainty and comparison views;
- Lab proposal cards, experiment timelines and decision sequences;
- intelligence-led Brief hierarchy and preparation interactions;
- generated-widget design system;
- MAIS Creations manager and safe mode;
- Intelligence Activity, model/resource and research surfaces;
- final copy, motion, haptics, accessibility and loading states.

### Phase 4 — Character and generative visual system

- base character identity, proportions and body model;
- consistent face, clothing and rendering language;
- exercise pose generation/control pipeline;
- dot, particle or 2.5D treatment;
- exercise-card imagery;
- character progression, caching and correction.

### Phase 5 — Cinematic integration

- animated Brief environments;
- character integration and atmospheric depth;
- spatial choreography and card transitions;
- timer focus/completion sequences;
- tactile/audio language and refined liquid glass;
- shared motion rules with reduced-motion equivalents.

### Phase 6 — Alpha hardening and personal release

Prepare **My Mettle Alpha 0.1** for a genuine month-long personal test:

- end-to-end and regression testing;
- migration and data-integrity testing;
- crash, interruption and recovery;
- battery/performance/local-model optimisation;
- timer and notification reliability;
- accessibility and reduced-motion verification;
- tracking edge cases;
- export, restore, stable signing and upgrade installation;
- diagnostic logs and final consistency.

## Roadmap maintenance

Update this document whenever an accepted decision changes scope, phase order, product behaviour or the reference hierarchy. Retain the original master specification as the historical foundation rather than rewriting it to appear current.
