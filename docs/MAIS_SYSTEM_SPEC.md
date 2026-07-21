# MAIS — Mettle Artificial Intelligence System

Status: Phase 3A substrate implementation candidate.

MAIS is the persistent local intelligence layer inside My Mettle. It is not a chatbot, copy-rewriter or one long-running conversation. It is an event-driven research and action system that wakes while the app is available, advances bounded work, persists useful state, releases models and resumes later.

## System goal

Continuously construct and revise a personal model of how the user responds to training; discover meaningful relationships in accumulating evidence; design and evaluate reversible experiments; and deploy context-sensitive training decisions while preserving provenance, inspectability and final human authority over permanent changes.

## Core division of labour

Deterministic systems:

- preserve raw evidence;
- calculate exact quantities;
- enforce domain constraints;
- validate schemas;
- grant or deny authority;
- execute and roll back transactions.

MAIS:

- decides what warrants attention;
- retrieves relevant evidence;
- forms competing hypotheses;
- plans analyses;
- routes specialist roles and models;
- critiques results;
- designs experiments;
- determines what matters in context.

The deterministic layer is the laboratory equipment. MAIS is the researcher using it.

## System anatomy

### MAIS Heart

The Heart advances the system through cheap pulses and bounded episodes.

A pulse normally performs no model inference. It checks:

- newly recorded events;
- resumable tasks;
- app visibility;
- Battery Saver;
- active workout interaction;
- explicit pause state;
- available memory;
- model-lease availability.

An episode performs one bounded role step:

1. select the required capability tier;
2. acquire one exclusive model lease;
3. compile a fresh task context;
4. run one role;
5. persist structured artefacts and a checkpoint;
6. release the model;
7. terminate or schedule the next step.

No episode depends on retaining transient conversation state.

### MAIS Workbench

Models communicate through durable typed artefacts rather than a growing transcript.

The Workbench contains:

- immutable event journal;
- task ledger;
- episodes and checkpoints;
- evidence inbox;
- prior role artefacts;
- analysis programmes and results;
- hypotheses and belief records;
- capability proposals and approvals;
- research dossiers;
- generated widget definitions;
- strategy reinforcement records;
- diagnostics and Parent Reviews.

### Independent persistence

MAIS is stored separately from the training database.

Current browser/WebView implementation:

- database: `my-mettle-mais`;
- store: `system-state`;
- key: `primary`.

Clearing MAIS state does not clear training history. Process interruption must leave the last persisted checkpoint recoverable.

### Context Compiler

Every model invocation receives a newly compiled context containing only:

- current task and role step;
- latest checkpoint;
- triggering events;
- directly relevant raw evidence;
- relevant beliefs and counter-evidence;
- prior analyses of the same question;
- corrections and rejected proposals;
- applicable research;
- available capabilities;
- resource mode;
- required output schema.

The compiler:

- resolves direct provenance references first;
- retrieves additional evidence through a provider interface;
- deduplicates evidence;
- ranks relevance;
- enforces a hard token budget;
- records included and excluded evidence IDs;
- emits a reproducible context manifest.

Long context is a tool, not the memory architecture.

## MAIS Capability Protocol

The internal application capability layer is MCP-compatible in concept but implemented as typed in-process APIs.

Capability classes:

- **Resources** — read-only application context;
- **Actions** — validated proposals and transactions;
- **Events** — passive input to the Heart;
- **UI capabilities** — approved declarative surfaces.

Protocol concepts:

- `capabilities/list`
- `resources/read`
- `actions/propose`
- `actions/approve`
- `actions/execute`
- `actions/revert`
- `widgets/preview`
- `widgets/install`
- `widgets/update`
- `widgets/remove`
- `events/append`
- `tasks/checkpoint`
- `tasks/resume`

MAIS never receives direct database write access.

### Exact authority

Every proposal contains:

- capability ID;
- reason;
- typed payload;
- deterministic payload fingerprint;
- authority level;
- reversibility state;
- creation time.

An approval receipt is valid only for the exact capability and fingerprint. A general “yes” grants no adjacent authority. The payload is fingerprinted again before execution.

### Authority levels

#### Level 0 — Read

Inspect authorised evidence and application state.

#### Level 1 — Internal reversible work

Update derived evidence, hypotheses, task state, cached explanations and private widget drafts.

#### Level 2 — Temporary deployment

Deploy a reversible experiment, temporary session change or temporary widget under narrow approval or a standing policy.

#### Level 3 — Persistent product state

Explicit approval is required to alter the base routine, add or archive an exercise, promote an experiment, install persistent generated UI or convert an inference into permanent exercise memory.

#### Level 4 — Destructive or external

Stronger confirmation is required for destructive deletion, external transmission, network research, data export or intelligence-report sharing.

### Implemented domain executors

Phase 3A includes real executors for:

- routine move operations;
- routine-slot duplication;
- routine-slot removal;
- adding a new exercise through the existing creation service.

They validate the current base routine, use existing domain services, create immutable routine versions and return rollback tokens. Rollback produces another valid routine version rather than rewriting history. A rolled-back newly created exercise is archived.

## Resource Governor

### Full

Permits retrieval, ordinary reasoning, Deep Lab, generated analysis, auditing and memory consolidation.

Expected while the app is foregrounded, Battery Saver is disabled, adequate memory is available and the user is not actively manipulating workout controls.

### Standard

Permits ordinary analysis and short episodes. Deep work is deferred.

### Light

Permits event logging, deterministic calculation, lightweight routing, cached output and checkpointing.

Expected during:

- Battery Saver;
- background visibility;
- active workout interaction;
- low available memory.

### Paused

No model work begins. Current bounded work checkpoints at the next safe boundary.

Expected when:

- the app is closed;
- the user explicitly pauses MAIS.

### Thermal policy

Phase 3A does not independently poll or gate on thermal state. Android, the device daemon and the selected inference runtime remain responsible for lower-level thermal throttling. Hardware evaluation may record temperature later, but thermal policy is not part of the current Heart state machine.

## Native Android resource bridge

The current native plugin exposes:

- foreground/background visibility;
- Battery Saver state;
- charging state;
- available memory;
- capture timestamp.

It publishes changes to the WebView through a Capacitor event. No background AI service is created. Closing the app stops model execution.

## Specialist roles

Roles are capability contracts, not a requirement for separate model binaries.

- **Governor** — chooses useful work, routes roles and allocates budget.
- **Analyst** — forms hypotheses and interprets longitudinal evidence.
- **Coding analyst** — creates constrained analysis programmes and interprets tool output.
- **Auditor** — challenges comparability, confounds and overconfidence.
- **Coach** — deploys current knowledge through Brief and temporary session preparation.
- **Memory curator** — maintains summaries, semantic memory and unresolved questions.
- **Research broker** — formulates infrequent, batched external research requests.

## Model registry and leases

The repository stores manifests and evaluation contracts, never weights.

Initial capability candidates:

- EmbeddingGemma — retrieval;
- Gemma 4 E2B — fast governor and frequent lightweight work;
- Gemma 4 E4B — ordinary analysis, coaching and audit;
- Qwen3-8B — Deep Lab reasoning and coding.

One generative model may be active at a time. A lease records:

- task and role;
- model tier;
- model ID;
- runtime and backend;
- context budget;
- acquisition, activation and release times;
- failure or abandoned-process state.

Phase 3A uses a deterministic simulated runtime. The same lease manager will wrap the real LiteRT-LM or ExecuTorch adapter in Phase 3B.

## Generated-analysis boundary

The coding role may create a constrained programme against an immutable evidence snapshot.

The validator prohibits:

- network access;
- unrestricted filesystem or process access;
- Android/device APIs;
- direct persistence access;
- dynamic code execution;
- unapproved libraries.

It requires:

- input snapshot fingerprint;
- output schema;
- source limit;
- allowed library manifest;
- stored programme, input, output and diagnostics.

Phase 3A validates and simulates execution. A genuinely isolated runtime is selected and integrated later.

## Widget Foundry

Phase 3 begins with declarative widgets rendered by trusted built-in components.

Allowed primitives currently include:

- stack;
- text;
- metric;
- mini chart;
- comparison;
- evidence link;
- capability action;
- divider.

Every generated widget is:

- attributable;
- permission-scoped;
- versioned;
- previewable;
- disableable;
- removable;
- ignored by safe mode;
- preventable from recreation through a user blocklist.

Arbitrary JavaScript, native code, network calls and unrestricted styles are not permitted.

## Research Broker

External research is a rare escalation tool.

A dossier is accepted only when:

1. a local investigation has reached a meaningful knowledge gap;
2. the answer could materially affect a decision;
3. cached knowledge is absent or insufficient;
4. questions are precise and batched;
5. expected value crosses the threshold;
6. request cooldown and rolling budget permit it.

Initial policy:

- one active dossier at a time;
- two requests in a rolling 30-day window;
- seven-day cooldown;
- duplicate-topic rejection;
- cited report import only;
- every imported claim references a listed source;
- knowledge receives expiry metadata.

The first workflow exports a dossier for manual higher-capability review and imports the resulting report.

## Reinforcement Ledger

MAIS does not fine-tune model weights from one user’s sparse history.

It records domain-specific strategy credit across:

- predictive accuracy;
- calibration;
- information gain;
- training outcome;
- user acceptance;
- novelty;
- reversibility;
- interruption cost;
- compute cost;
- scientific support.

Poor outcomes lower domain-specific credit, trigger audit requirements or add a cooldown. Exploration remains available so one successful strategy does not dominate unrelated decisions.

## Observability and Parent Review

The MAIS Activity console is a plain Phase 3A framework surface in Lab. It exposes:

- current resource mode;
- event/task/checkpoint/artefact counts;
- proposal and model-lease counts;
- latest Heart decision;
- task ledger;
- diagnostics;
- synthetic heartbeat;
- one-step pulse;
- Report Card export;
- separate MAIS reset.

The Report Card contains operational artefacts rather than hidden chain-of-thought:

- system/model versions;
- events and tasks;
- checkpoints and role artefacts;
- capability proposals, approvals and executions;
- model leases;
- context manifests;
- analysis programmes/results;
- research requests;
- reinforcement changes;
- widgets;
- diagnostics and failures.

Keys representing hidden chain-of-thought, scratchpad or hidden reasoning are stripped during export.

A structured Parent Review may be imported later as engineering/audit direction.

## Phase 3A completion contract

Phase 3A is complete after automated validation and an Android device pass demonstrate:

1. app opening restores separate MAIS state;
2. a passive or synthetic event enters the journal;
3. Heart creates and prioritises a task;
4. each role acquires and releases one model lease;
5. role artefacts and checkpoints persist;
6. process/app restart resumes from typed state;
7. Battery Saver forces Light mode;
8. background state permits only Light work;
9. app closure stops model execution;
10. a capability proposal cannot execute without exact approval;
11. approved routine/exercise actions use existing domain services;
12. reversible actions produce valid rollback state;
13. Context Compiler records provenance and budget exclusions;
14. generated widgets can be disabled, removed and blocked;
15. Research Broker remains scarce and batched;
16. Report Card export contains reproducible operational evidence;
17. clearing MAIS state leaves training data untouched;
18. web tests, strict TypeScript, Vite and Android assembly are green.

## Explicit Phase 3A boundary

Phase 3A does **not** include:

- downloaded model weights;
- LiteRT-LM or ExecuTorch native inference;
- production embeddings;
- real generated-code execution;
- belief graph or longitudinal analytics;
- final Progress/Lab/Brief intelligence;
- polished intelligence UI.

Those begin in Phase 3B and later slices, using this substrate rather than changing its authority or lifecycle model.
