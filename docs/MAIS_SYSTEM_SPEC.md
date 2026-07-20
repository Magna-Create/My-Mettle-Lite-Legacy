# MAIS — Mettle Artificial Intelligence System

Status: Phase 3A architectural contract.

MAIS is the persistent local intelligence layer inside My Mettle. It is not a chatbot, copy-rewriter or single long-running conversation. It is an event-driven research and action system that wakes while the app is available, advances bounded work, persists useful state, unloads models and resumes later.

## System goal

Continuously construct and revise a personal model of how the user responds to training; discover meaningful relationships in accumulating evidence; design and evaluate reversible experiments; and deploy context-sensitive training decisions while preserving provenance, inspectability and final human authority over permanent changes.

## Core principle

Deterministic systems establish trustworthy evidence, enforce hard constraints and execute transactions. MAIS conducts inquiry: it decides what warrants attention, retrieves relevant evidence, forms competing hypotheses, plans analyses, invokes tools, critiques results, designs experiments and determines what matters today.

## System anatomy

### MAIS Heart

The Heart advances the system through cheap pulses and bounded episodes.

A pulse normally performs no model inference. It checks for new events, unfinished tasks, available resources and whether a model episode is justified.

An episode performs one bounded piece of work:

1. load the required capability model;
2. compile a fresh task context;
3. execute one role step;
4. persist structured artefacts and a checkpoint;
5. unload the model;
6. terminate or schedule the next step.

No episode depends on retaining a model's transient conversation state.

### MAIS Workbench

Models communicate through durable typed artefacts rather than one growing transcript.

The Workbench contains:

- immutable event journal;
- task ledger;
- checkpoints;
- evidence inbox;
- agent mailbox;
- analysis artefacts;
- hypothesis and belief records;
- research requests;
- generated widget drafts;
- approval receipts;
- operational diagnostics.

### Context Compiler

Every model invocation receives a newly compiled context containing only:

- current task and step;
- latest checkpoint;
- directly relevant raw evidence;
- relevant beliefs and counter-evidence;
- prior analyses of the same question;
- user corrections and rejected proposals;
- applicable scientific knowledge;
- resource/tool permissions;
- required output schema.

Long context is available but is not the memory architecture. Persistent memory remains structured and independently retrievable.

### MAIS Capability Protocol

The internal application capability layer is MCP-compatible in concept but initially implemented as typed in-process APIs.

Capability classes:

- **Resources** — read-only application context;
- **Actions** — validated proposals and transactions;
- **Events** — passive input to the Heart;
- **UI capabilities** — approved declarative surfaces and generated widgets.

Initial protocol operations:

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

MAIS never receives direct database write access. It creates typed proposals. Domain services validate and execute approved changes transactionally.

## Authority model

### Level 0 — Read

MAIS may inspect authorised evidence and current application state.

### Level 1 — Internal reversible work

MAIS may update derived evidence, hypotheses, task state, analysis artefacts, cached explanations and private widget drafts without interrupting the user.

### Level 2 — Temporary deployment

Narrow approval or standing policy may permit active experiments, temporary session ordering, reversible widgets and supporting-record links.

### Level 3 — Persistent product state

Explicit approval is required to change the base routine, add a permanent exercise, archive an exercise, promote an experiment, install a persistent generated widget or convert inferred information into permanent exercise memory.

### Level 4 — Destructive or external

Stronger confirmation is required for destructive deletion, external transmission, network research, data export or intelligence-report sharing.

Approval applies only to the exact proposed change set. A general “yes” grants no adjacent authority.

## Lifecycle and resource modes

MAIS initially operates only while the application process is available. Closing or killing the app stops model execution while preserving task state.

### Full

Permits retrieval, ordinary reasoning, deep reasoning, generated-code analysis, auditing and memory consolidation.

Expected when the app is foregrounded, Battery Saver is disabled, thermal state is healthy and the user is not manipulating time-sensitive workout controls.

### Standard

Permits ordinary analysis and short model episodes. Deep work may be deferred.

### Light

Permits event logging, deterministic calculations, lightweight retrieval/routing, cached output and checkpointing. Heavy model work is deferred.

Expected during Battery Saver, active workout interaction, background visibility or elevated thermal pressure.

### Paused

No model work begins. A running bounded step is checkpointed as soon as safely possible.

Expected when the app is closed, severe thermal pressure occurs or the user pauses MAIS.

Budgets begin permissively. Telemetry, not premature fear, will guide later tightening.

## Initial specialist roles

Roles are capability contracts, not a requirement for one model binary per role.

- **Governor** — chooses useful work, routes roles and allocates budget.
- **Analyst** — forms hypotheses and interprets longitudinal evidence.
- **Coding analyst** — generates constrained analysis programs and interprets tool output.
- **Auditor** — challenges comparison validity, confounds and overconfidence.
- **Coach** — deploys current knowledge through Brief and temporary session preparation.
- **Memory curator** — maintains summaries, semantic memory and unresolved questions.
- **Research broker** — formulates infrequent, batched external research requests.

## Model topology target

The architecture supports sequential model loading. Models do not need to coexist in memory.

Initial capability candidates:

- EmbeddingGemma for semantic retrieval;
- Gemma 4 E2B for lightweight routing and frequent work;
- Gemma 4 E4B for general reasoning, multimodal context and auditing;
- Qwen3-8B for Deep Lab reasoning, coding and complex experiment design.

The selected unit is always model + quantisation + runtime + backend + context configuration. Model names remain replaceable registry entries until device benchmarks pass.

## Generated analysis

The coding role receives immutable data snapshots and may generate constrained programs for approved analytical tasks.

The sandbox must provide:

- no network;
- no unrestricted filesystem;
- no Android APIs;
- no direct persistence writes;
- approved numerical/statistical libraries only;
- CPU, memory and time limits;
- structured output validation;
- complete storage of program, inputs, outputs and diagnostics.

A model may invent an analysis. It may not invent the result.

## Widget Foundry

Phase 3 begins with declarative widgets rendered by trusted built-in components.

MAIS may control layout, hierarchy, copy, data bindings, approved chart types, actions, visibility conditions and placement in permitted zones. It may not initially execute arbitrary JavaScript, native code, network calls or unrestricted styles.

Every generated widget is:

- attributable;
- permission-scoped;
- previewable;
- versioned;
- removable;
- disableable;
- prevented from automatic recreation when blocked;
- ignored by AI-safe mode.

A later tier may support sandboxed generated code after static analysis, automated tests, performance checks and rollback are proven.

## Research Broker

External research is a rare escalation tool, not a routine dependency.

A request is justified only when:

1. a local investigation has reached a meaningful knowledge gap;
2. the answer could materially affect an interpretation, experiment or policy;
3. cached knowledge is absent, stale or insufficient;
4. the question can be formulated precisely;
5. expected value exceeds interruption and network cost.

Requests are batched into a research dossier containing the blocked decision, local context, questions, preferred evidence classes, required output schema and expiry requirements.

The first implementation exports requests for manual higher-capability review and imports cited reports. Later versions may receive a constrained weekly network budget.

## Reinforcement Ledger

MAIS does not initially fine-tune model weights from one user's sparse outcomes. Instead, it maintains strategy-level credit across:

- predictive accuracy;
- calibration;
- information gain;
- training outcome;
- user acceptance and correction;
- novelty;
- reversibility;
- interruption cost;
- compute cost;
- scientific support.

Credit is domain-specific. A successful rest experiment does not make rest changes universally preferred. An explicit exploration allocation preserves novel hypotheses while penalising low-information repetition and overconfidence.

## Observability and Parent Review

The review surface is designed primarily for engineering and higher-capability AI oversight.

A MAIS Report Card includes:

- model/runtime versions;
- resource state and budgets;
- events processed;
- tasks and checkpoints;
- model-routing decisions;
- retrieved evidence manifests;
- tools and generated programs;
- outputs and diagnostics;
- claims created or revised;
- auditor disagreements;
- proposals and experiment predictions;
- reinforcement-ledger changes;
- user corrections;
- failures and retries;
- research requests.

It stores operational reasoning artefacts—plans, evidence, claims and results—not hidden model chain-of-thought.

## Phase 3A implementation order

1. Heart simulator and immutable event journal.
2. Task, episode and checkpoint state machine.
3. Resource Governor and app/device state contracts.
4. Workbench artefact and role handoff contracts.
5. Capability Protocol proposals, approvals and transactions.
6. Model registry and load/unload leases.
7. Context Compiler interfaces.
8. Declarative Widget Foundry schema and safe mode.
9. Generated-analysis sandbox contract.
10. Research Broker, Reinforcement Ledger and Report Card.
11. Native runtime laboratory and real model integration.

## Phase 3A exit demonstration

Phase 3A is complete when a synthetic completed workout can autonomously produce this tested sequence:

1. event enters the journal;
2. Heart wakes;
3. Governor selects useful work;
4. first role creates a plan and checkpoint;
5. model unloads;
6. coding role resumes from typed state and produces a reproducible analysis;
7. auditor challenges the result;
8. belief/workbench state updates;
9. potential Lab proposal is stored;
10. episode terminates and all model leases close;
11. process interruption preserves the checkpoint;
12. reopening resumes from that checkpoint;
13. Battery Saver forces Light mode;
14. app closure forces Paused mode;
15. no permanent training state changes without exact approval.
