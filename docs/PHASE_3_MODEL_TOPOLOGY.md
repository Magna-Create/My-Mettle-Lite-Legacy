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

Two artefacts expose the same logical model and prompt contract:

1. `gemma-4-E2B-it.litertlm` — generic CPU/GPU baseline;
2. `gemma-4-E2B-it_qualcomm_sm8750.litertlm` — hardware-specific Qualcomm NPU build for Snapdragon 8 Elite.

The Qualcomm accelerator is an NPU/HTP path, not a TPU. Both artefacts remain separately installable so the target phone can compare CPU, GPU and NPU without changing the underlying model family.

- production default: generic artefact on CPU until device evidence justifies changing it;
- NPU build: explicit SM8750 benchmark and candidate production replacement;
- Brief copy from deterministic facts;
- note extraction and classification;
- concise explanations and summaries;
- presentation of validated Qwen artefacts;
- ambiguous-task triage only after deterministic routing cannot decide;
- must emit an escalation rather than improvise when causal or longitudinal analysis is required.

The language-provider interface remains modular so a smaller model may be compared later if battery testing justifies it.

### Qwen3-4B Thinking · custom 12K GenieX QAIRT

Purpose: infrequent deep analysis.

- repository: `MagneRex/Qwen3-4B-Genie-Snapdragon-8-Elite-12K`;
- runtime: GenieX QAIRT;
- precision: W4A16;
- compiled target: Snapdragon 8 Elite for Galaxy;
- QAIRT compilation version: `2.45.0.260326154327`;
- context: 12,288 tokens;
- prompt/decode sequence lengths: 128 / 1;
- preferred backend: Qualcomm NPU/HTP;
- competing hypotheses, confounds and causal challenges;
- experiment design and evaluation;
- generated-analysis and declarative widget-code authoring within validated sandboxes;
- monthly external-research request drafting;
- runs only for recognised complex tasks, explicit user requests or bounded overnight work.

The app installs the complete multi-file GenieX bundle through resumable Hugging Face downloads. Native GenieX execution remains the final target-device integration gate; until that adapter passes, deep episodes fall back deterministically rather than attempting to load the bundle through LiteRT-LM.

Qwen produces structured Workbench artefacts rather than final UI prose. It never applies a database mutation directly.

## Excluded models

The following are not part of the Phase 3 production topology:

- Qwen3-8B: removed after GPU crashes and impractical CPU memory/speed on the target phone;
- Gemma 4 E4B: retired and removed because its role overlaps with E2B plus the dedicated Qwen deep thinker;
- Jan-nano: unnecessary network/tooling complexity;
- MedGemma: outside the performance-optimisation scope;
- CodeGemma and unverified fitness fine-tunes.

App upgrades delete the retired E4B model, partial download and verification record from app-private storage.

## Routing

1. Deterministic code handles known calculations, templates and obvious task classes.
2. E2B handles ordinary language work.
3. E2B may classify only genuinely ambiguous routes and cannot answer during the routing pass.
4. Qwen receives longitudinal, causal, contradictory, experiment or routine-change work.
5. The user may explicitly choose Quick, Deep or Automatic during beta evaluation.

## External research

MAIS does not autonomously browse the web. It may prepare up to three research dossiers per month for explicit user export. A cited result can later be imported, validated, indexed by EmbeddingGemma and used as evidence.
