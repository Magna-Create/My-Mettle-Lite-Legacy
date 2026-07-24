# Phase 3 — Accepted Local Model Topology

Status: accepted architecture for Phase 3C–3G.

## Principle

MAIS uses the smallest competent component for each task. Agent roles are software contracts, not separate personalities or separate model downloads.

> EmbeddingGemma retrieves. Gemma E2B communicates. Qwen thinks. Deterministic code validates and applies only approved changes.

## Production model slots

### EmbeddingGemma 300M

Purpose: semantic retrieval over training history, experiments, routines, beliefs and imported research.

- active artefact: generic `embeddinggemma-300M_seq512_mixed-precision.tflite`;
- active runtime: `localagents-rag:0.3.0` on CPU;
- tokenizer: `sentencepiece.model`;
- no prose, recommendations or decisions;
- vectors remain a regenerable index; raw evidence remains authoritative;
- gated model files are installed through an explicit local-file import flow.

The initially selected Qualcomm SM8750 AOT file returned a null native model handle through the packaged `GemmaEmbeddingModel` wrapper. The app therefore rejects that combination instead of reporting the files as operational. A future direct QNN embedding adapter may reintroduce an SM8750 artefact without changing the semantic-memory contracts.

### Gemma 4 E2B IT

Purpose: ordinary language and lightweight interpretation.

Two public LiteRT-LM artefacts currently expose the same logical model and prompt contract:

1. `gemma-4-E2B-it.litertlm` — generic CPU/GPU baseline;
2. `gemma-4-E2B-it_qualcomm_sm8750.litertlm` — hardware-specific Qualcomm NPU package.

The Qualcomm accelerator is an NPU/HTP path, not a TPU. The generic model works on CPU/GPU. The public Qualcomm package currently fails NPU engine creation on the target phone with `TF_LITE_AUX not found`, so it is retained only as a documented upstream compatibility result and is not the production NPU route.

- production default: generic artefact on CPU;
- GPU: available for measured longer-run comparison;
- future NPU build: custom GenieX/QAIRT export after the Qwen native pipeline passes;
- Brief copy from deterministic facts;
- note extraction and classification;
- concise explanations and summaries;
- presentation of validated Qwen artefacts;
- ambiguous-task triage only after deterministic routing cannot decide;
- must emit an escalation rather than improvise when causal or longitudinal analysis is required.

The language-provider interface remains modular so the future custom E2B GenieX build can reuse the native runtime lifecycle without changing role contracts.

### Qwen3-4B Thinking · custom 12K GenieX QAIRT

Purpose: infrequent deep analysis.

- repository: `MagneRex/Qwen3-4B-Genie-Snapdragon-8-Elite-12K`;
- runtime: GenieX QAIRT;
- precision: W4A16;
- compiled target: Snapdragon 8 Elite for Galaxy;
- QAIRT compilation identifier: `2.45.0.260326154327`;
- context: 12,288 tokens;
- prompt/decode sequence lengths: 128 / 1;
- preferred backend: Qualcomm NPU/HTP;
- thinking mode: enabled explicitly with `/think`;
- competing hypotheses, confounds and causal challenges;
- experiment design and evaluation;
- generated-analysis and declarative widget-code authoring within validated sandboxes;
- monthly external-research request drafting;
- runs only for recognised complex tasks, explicit user requests or bounded overnight work.

The app installs the complete multi-file GenieX bundle through resumable Hugging Face downloads. Runtime Lab can re-verify all 15 files at any time.

The native Android adapter is implemented as:

- an open, statically linked ARM64 JNI bridge included in the repository;
- private QAIRT 2.45 build assets staged locally before APK assembly;
- Qualcomm-style legacy extraction of Genie, QNN host libraries, HTP stubs and v73 skeletons;
- absolute runtime rewriting of tokenizer, backend extension and context-binary paths;
- one bounded thinking-enabled dialog lifecycle with profiler, timing and process-memory capture;
- final-answer extraction after the `<think>...</think>` section;
- ephemeral reasoning content: the transcript is not persisted, displayed or exported;
- deterministic cleanup and persistent final-result/error reporting.

This is now a target-device validation candidate, not yet a production-proven runtime. Qwen remains outside autonomous role execution until it creates a dialog, thinks, generates final text and unloads cleanly on the S25 Ultra in repeated tests.

Qwen produces structured Workbench artefacts rather than final UI prose. It never applies a database mutation directly.

## Excluded or blocked models

The following are not part of the active Phase 3 production topology:

- Qwen3-8B: removed after GPU crashes and impractical CPU memory/speed on the target phone;
- Gemma 4 E4B: retired because its role overlaps with E2B plus the dedicated Qwen deep thinker;
- public Gemma 4 E2B Qualcomm LiteRT-LM NPU package: blocked by the current `TF_LITE_AUX` package/runtime incompatibility;
- EmbeddingGemma Qualcomm AOT through `localagents-rag`: blocked by a null native model handle;
- Jan-nano: unnecessary network/tooling complexity;
- MedGemma: outside the performance-optimisation scope;
- CodeGemma and unverified fitness fine-tunes.

App upgrades delete the retired E4B model, partial download and verification record from app-private storage. They also remove the incompatible EmbeddingGemma Qualcomm AOT import so it cannot be mistaken for the active generic retrieval model.

## Routing

1. Deterministic code handles known calculations, templates and obvious task classes.
2. E2B handles ordinary language work on the generic CPU runtime.
3. E2B may classify only genuinely ambiguous routes and cannot answer during the routing pass.
4. Qwen receives longitudinal, causal, contradictory, experiment or routine-change work only after its native device gate passes.
5. Qwen uses thinking mode for those deep tasks; only its validated final artefact is retained.
6. Until the gate passes, deep Qwen episodes record a deterministic fallback instead of attempting native inference.
7. The user may explicitly choose Quick, Deep or Automatic during beta evaluation after the runtime gate passes.

## External research

MAIS does not autonomously browse the web. It may prepare up to three research dossiers per month for explicit user export. A cited result can later be imported, validated, indexed by EmbeddingGemma and used as evidence.
