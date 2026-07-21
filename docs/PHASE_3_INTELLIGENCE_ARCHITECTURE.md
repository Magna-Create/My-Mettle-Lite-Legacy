# My Mettle — Phase 3 Intelligence Architecture

_Last updated: 21 July 2026_

This document records accepted decisions made after the original Phase 3 roadmap. It supersedes older model-role assumptions where they conflict.

## Product boundary

My Mettle is a focused personal performance-optimisation application, not an autonomous internet research platform or general chatbot.

External research remains a manual escalation:

1. local intelligence may prepare up to three precise research requests per month;
2. the user exports an approved request to ChatGPT;
3. the completed cited dossier is imported back into My Mettle;
4. local semantic retrieval and reasoning may then use that dossier.

There is no paid search API, crawler or always-connected research agent in the accepted Phase 3 topology.

## Lean local model topology

### EmbeddingGemma 300M

Responsibility: semantic retrieval only.

It:

- indexes provenance-linked training, experiment, belief and imported-research documents;
- retrieves relevant chunks within a hard context budget;
- never creates recommendations, beliefs or user-facing prose.

Target artefacts:

- `embeddinggemma-300M_seq512_mixed-precision.qualcomm.sm8750.tflite`;
- `sentencepiece.model`.

The Qualcomm SM8750 build prefers NPU execution with CPU fallback. Both files are manually selected through Android's document picker and copied into app-private storage.

### Gemma 4 E2B IT

Responsibility: everyday language and bounded intelligence.

It handles:

- note extraction and classification;
- single-record and short-window summaries;
- concise user-facing explanation;
- memory curation;
- bounded Analyst/Auditor passes that do not require deep causal reasoning;
- triage only when deterministic routing cannot classify a request confidently.

CPU is the default backend because device measurements showed much lower cold-load cost than GPU.

E2B is not the sole gatekeeper for Qwen. Obvious routing is deterministic, and recognised complex work goes directly to the deep-reasoning capability.

### Qwen deep thinker

Responsibility: infrequent deep analysis.

It handles:

- competing causal hypotheses;
- plateau, regression and confound analysis;
- experiment design and evaluation;
- deterministic analysis-recipe generation;
- declarative widget-code generation later;
- manual research-request drafting.

Current development stand-in:

- Qwen3-8B mixed INT4;
- 2,048-token compiled context;
- CPU only on the target phone because repeated GPU attempts crashed the application and destabilised System UI.

Final intended artefact:

- Qwen3-4B-Thinking-2507;
- mixed INT4;
- 12,288-token compiled context;
- GPU preferred after device validation;
- imported or downloaded as a separate verified `.litertlm` artefact.

The rest of MAIS requests a `deep_reasoning` capability rather than hard-coding the temporary binary. Development therefore proceeds against the 2K stand-in without pretending that its compiled context is 12K.

### Retired production candidates

- Gemma 4 E4B remains a benchmark artefact only.
- Jan-nano is removed.
- MedGemma is removed.
- CodeGemma is removed.
- Community fitness fine-tunes are excluded because dataset provenance and domain reliability are inadequate.

## Routing policy

Every request enters at the cheapest competent layer:

1. deterministic engine or template;
2. E2B everyday-language capability;
3. E2B triage only for ambiguous middle cases;
4. Qwen deep-reasoning capability for recognised complex work;
5. deterministic validation and capability boundaries;
6. E2B presentation where natural language is required;
7. exact user approval before permanent state changes.

Examples routed directly to Qwen include:

- causal analysis;
- experiment design or evaluation;
- routine-change reasoning;
- contradictory longitudinal evidence;
- generated analysis or widget code;
- explicit `Think deeply` requests.

Formatting and extraction do not require model routing when deterministic code can do the job reliably.

## Analysis execution boundary

Qwen does not execute arbitrary JavaScript or Python.

The Coding Analyst receives an immutable, provenance-linked exposure snapshot and emits a `MaisAnalysisRecipeV1` programme. The host validates and executes that recipe through a deterministic operation set:

- count;
- sum, mean, median, minimum and maximum;
- standard deviation;
- Pearson correlation;
- linear regression;
- grouped means;
- trimmed means.

No `eval`, dynamic function construction, network, storage, process, Android or host API is exposed. Inputs, generated programmes and completed runs persist separately for replay and audit.

Generated interface widgets remain declarative and permission-scoped through Widget Foundry rather than arbitrary native or DOM code.

## Evidence and belief boundary

Deterministic systems create comparable exposures and derived metrics for all tracking types. Each metric records its algorithm version, assumptions and source references.

Analyst output may create or update explicit beliefs. Auditor output may attach supporting or counter-evidence. Persistent state records:

- probability and confidence;
- support and counter-evidence weight;
- unresolved questions;
- superseded beliefs;
- exact rejected-proposal memory;
- evidence required before a rejected proposal may return.

Models never receive direct database write access. They create typed Workbench artefacts that are validated and reduced into controlled state.

## Interface boundary before Phase 3.5

Lab is an action surface for controlled experiments only.

Technical controls belong under:

`Settings → Intelligence`

including:

- local-model installation/import/removal;
- runtime benchmarks;
- Heart activity;
- role execution diagnostics;
- task and checkpoint ledgers;
- Report Card export.

Phase 3.5 will replace plain functional surfaces with the accepted polished intelligence interface.

## Overnight deep work

A charging-only overnight worker is accepted in principle for bounded heavy analysis. The intended policy is:

- queued deep work must exist;
- device must be charging, sufficiently charged and idle;
- Battery Saver and active workout interaction block execution;
- one generative model is loaded at a time;
- each episode checkpoints, unloads and pauses before another episode;
- unplugging, resource pressure or runtime failure stops work cleanly;
- the morning interface reports completed and deferred work.

Android WorkManager/foreground execution will be implemented and device-tested before this behaviour is enabled by default. Until then, the foreground Heart remains the authoritative execution path.
