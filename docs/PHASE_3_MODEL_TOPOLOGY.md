# Phase 3 — Accepted Local Model Topology

Status: accepted architecture for Phase 3C–3G.

## Principle

MAIS uses the smallest competent component for each task. Agent roles are software contracts, not separate personalities or separate model downloads.

> EmbeddingGemma retrieves. Gemma E2B communicates. Qwen thinks. Deterministic code validates and applies only approved changes.

## Production model slots

### EmbeddingGemma 300M

Purpose: semantic retrieval over training history, experiments, routines, beliefs and imported research.

- preferred artefact: Qualcomm SM8750 LiteRT build;
- preferred backend: NPU, CPU fallback;
- no prose, recommendations or decisions;
- vectors remain a regenerable index; raw evidence remains authoritative;
- gated model files are installed through an explicit local-file import flow.

### Gemma 4 E2B IT

Purpose: ordinary language and lightweight interpretation.

- default backend: CPU;
- Brief copy from deterministic facts;
- note extraction and classification;
- concise explanations and summaries;
- presentation of validated Qwen artefacts;
- ambiguous-task triage only after deterministic routing cannot decide;
- must emit an escalation rather than improvise when causal or longitudinal analysis is required.

The language-provider interface remains modular so a smaller model may be compared later if battery testing justifies it.

### Qwen3-4B-Thinking-2507 · custom 12K LiteRT-LM

Purpose: infrequent deep analysis.

- preferred backend: GPU, subject to target-device validation;
- custom mixed-INT4/OCTAV LiteRT-LM export with a 12,288-token KV cache;
- competing hypotheses, confounds and causal challenges;
- experiment design and evaluation;
- generated-analysis and declarative widget-code authoring within validated sandboxes;
- monthly external-research request drafting;
- runs only for recognised complex tasks, explicit user requests or bounded overnight work.

Qwen produces structured Workbench artefacts rather than final UI prose. It never applies a database mutation directly.

## Excluded models

The following are not part of the Phase 3 production topology:

- Qwen3-8B: GPU crashes on the target phone and CPU inference is too slow and memory-heavy;
- Gemma 4 E4B: retained only as a temporary benchmark artefact, with no permanent role;
- Jan-nano: unnecessary network/tooling complexity;
- MedGemma: outside the performance-optimisation scope;
- CodeGemma and unverified fitness fine-tunes.

## Routing

1. Deterministic code handles known calculations, templates and obvious task classes.
2. E2B handles ordinary language work.
3. E2B may classify only genuinely ambiguous routes and cannot answer during the routing pass.
4. Qwen receives longitudinal, causal, contradictory, experiment or routine-change work.
5. The user may explicitly choose Quick, Deep or Automatic during beta evaluation.

## External research

MAIS does not autonomously browse the web. It may prepare up to three research dossiers per month for explicit user export. A cited result can later be imported, validated, indexed by EmbeddingGemma and used as evidence.
