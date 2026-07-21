# My Mettle roadmap

## Product direction

My Mettle is an offline-first personal training system. The deterministic training product remains authoritative; MAIS interprets evidence, proposes reversible tests and communicates uncertainty without silently changing the routine.

### Health and ownership principles

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
- External research is an infrequent, manually exported escalation tool with a three-request rolling monthly budget.
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

Status: **complete and merged**.

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
- automated web, strict TypeScript and Android regression coverage.

#### Phase 3B–3F — Functional alpha implementation

Status: **implementation complete on the Phase 3 draft branch; consolidated target-device gate pending**.

Completed implementation:

- verified app-private model installation, import, checksum and deletion;
- LiteRT-LM generative runtime and measured telemetry;
- role/capability model routing with deterministic fallback;
- Gemma 4 E2B ordinary language and triage path;
- Qwen deep path only after an explicit Governor `deep_analysis` route;
- temporary current Qwen 2K artefact isolated behind a capability boundary for later replacement by Qwen3-4B Thinking 12K;
- EmbeddingGemma model + SentencePiece import and native local embedding runtime;
- incremental semantic indexing over training history, beliefs, memories, imported research and analyses;
- bounded retrieval injected into role packets with provenance;
- comparable-exposure engine across all tracking types;
- stable muscle ontology and contribution metadata;
- belief graph with support, counter-evidence, uncertainty and unresolved questions;
- durable rejection memory and provenance-linked memory updates;
- deterministic 10/50/200/1,000-session fixtures;
- deterministic investigation candidates and explicit deep-routing expansion;
- immutable analysis snapshots and a non-evaluating `MaisAnalysisRecipeV1` executor;
- persistent input/programme/run artefacts and audit passes;
- Coach proposal reduction into proposed Lab experiments only;
- automatic experiment-threshold event after a tested session;
- inspectable adopt/extend/reject/defer recommendations that never act without the user;
- three-per-30-day manual research dossier export/import workflow;
- functional Brief, Progress, Lab and Settings intelligence surfaces;
- consolidated Report Card and target-device gate.

Current model topology:

- **EmbeddingGemma 300M** — semantic indexing and retrieval;
- **Gemma 4 E2B IT** — ordinary language, triage and bounded standard roles;
- **Qwen deep capability** — current 2K stand-in during integration, to be replaced with a custom Qwen3-4B Thinking 12K artefact before the first proper Phase 3 test.

Explicitly excluded from the intended topology:

- Jan-nano;
- MedGemma;
- CodeGemma;
- unvalidated fitness fine-tunes;
- Gemma E4B as a permanent role;
- Qwen3-8B as the production deep model.

#### Phase 3G — Integrated intelligence alpha

The north-star test is:

1. passive evidence wakes MAIS;
2. the Governor routes ordinary work cheaply and recognised complexity to deep analysis;
3. MAIS retrieves the right local evidence;
4. it creates and executes a reproducible analysis;
5. an Auditor challenges the result;
6. Lab proposes a reversible experiment;
7. Brief and Train deploy it only after approval;
8. later evidence is evaluated;
9. the belief is revised;
10. a permanent routine change is offered for exact approval;
11. the full trace survives interruption and appears in the Report Card.

The consolidated device gate is defined in `docs/PHASE_3_FUNCTIONAL_ALPHA_DEVICE_TEST.md`.

### Phase 3.5 — Intelligence interface and productisation

Transform the functional Phase 3 surfaces into the accepted My Mettle experience.

- body-region Progress interface;
- polished evidence, uncertainty and comparison views;
- Lab proposal cards, experiment timelines and decision sequences;
- final Brief hierarchy and contextual intervention language;
- 2.5D body, particles, motion and subtle-power energy;
- generated widget presentation and lifecycle controls;
- responsive, accessibility and performance refinement.
