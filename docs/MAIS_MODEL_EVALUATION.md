# MAIS Model and Runtime Evaluation

Status: Phase 3B benchmark contract; Phase 3A registry and lease framework implemented.

Model selection is empirical. My Mettle evaluates a complete deployment unit:

> model + quantisation + runtime + hardware backend + context configuration + role prompt

No model weights belong in the source repository. Git stores manifests, download/conversion recipes, checksums, licences, prompts, evaluation cases and measured results.

## Candidate topology

### Retrieval — EmbeddingGemma

Intended work:

- semantic retrieval across reflections, analyses and imported research;
- matching new evidence to existing hypotheses;
- clustering recurring themes;
- near-duplicate detection;
- Context Compiler retrieval.

### Fast Governor — Gemma 4 E2B

Intended work:

- event triage;
- task routing;
- context selection;
- lightweight memory work;
- deciding whether Deep Lab is justified;
- cached Brief preparation.

### General reasoning and audit — Gemma 4 E4B

Intended work:

- longitudinal interpretation;
- hypothesis development;
- proposal drafting;
- coaching;
- multimodal context later;
- independent audit and counter-explanation.

### Deep Lab — Qwen3-8B

Intended work:

- difficult longitudinal reasoning;
- generated analysis code;
- sensitivity testing;
- experiment design;
- complex capability sequencing;
- high-value investigations.

The topology remains provisional. Benchmarks may collapse roles onto fewer models or reassign a role.

## Current official deployment references

### Gemma 4

Google positions E2B and E4B for mobile/edge deployment with configurable reasoning, function calling and multimodal input. LiteRT-LM is the primary Android runtime candidate.

Official references:

- https://ai.google.dev/gemma/docs/core/model_card_4
- https://developers.google.com/edge/litert-lm/models/gemma-4
- https://developers.google.com/edge/litert-lm/overview

Published mobile artefacts are useful planning references but are not accepted as My Mettle performance evidence. The target phone must be measured directly.

### Qwen3-8B

The official model card identifies:

- approximately 8.2B parameters;
- thinking and non-thinking modes;
- reasoning, coding and tool-use emphasis;
- 32K native context with extended-context options;
- Apache-2.0 licensing for the published model.

Official references:

- https://huggingface.co/Qwen/Qwen3-8B
- https://qwenlm.github.io/blog/qwen3/
- https://github.com/QwenLM/Qwen3

### Android runtimes

Primary candidate:

- LiteRT-LM for Gemma, Kotlin integration and Android hardware acceleration.

Comparison candidate:

- ExecuTorch for Qwen/PyTorch paths and XNNPACK, Vulkan or Qualcomm backends.

Official references:

- https://developers.google.com/edge/litert-lm/api_overview
- https://docs.pytorch.org/executorch/stable/using-executorch-android.html

## Artefact policy

Model files live outside Git in one of:

- developer-local model storage;
- app-private Android storage;
- controlled release/object storage;
- direct verified download from a declared source.

Every installed artefact requires:

- stable model ID;
- source and revision;
- licence identifier;
- runtime format;
- quantisation;
- byte size;
- SHA-256 checksum;
- conversion recipe/version;
- supported roles;
- context limits;
- hardware/backend compatibility;
- measured device profile;
- removal instructions.

The application must be able to remove an entire downloaded model pack and its active registry entry.

## First benchmark matrix

| Candidate | Runtime | Backend/format candidates | Intended role |
|---|---|---|---|
| EmbeddingGemma | LiteRT | verified mobile quantisation, CPU/GPU | retrieval |
| Gemma 4 E2B IT | LiteRT-LM | official/reproducible mobile format, CPU/GPU/NPU where available | fast governor |
| Gemma 4 E4B IT | LiteRT-LM | official/reproducible mobile format, CPU/GPU/NPU where available | general reasoner/auditor |
| Qwen3-8B | LiteRT-LM | reproducibly converted mobile candidate | Deep Lab |
| Qwen3-8B | ExecuTorch | XNNPACK, Vulkan or Qualcomm candidate | Deep Lab comparison |

Do not collect several unverified community quantisations at once. Begin with official or reproducibly converted artefacts, establish a baseline, then vary quantisation.

## Existing Phase 3A runtime framework

Before weights are introduced, the app already provides:

- model manifest schema and registry;
- role/tier based model selection;
- one exclusive model lease at a time;
- load, active, release and failure states;
- abandoned-process lease recovery;
- guaranteed release after bounded role work;
- simulated runtime replacement point;
- persistent lease history in the Report Card.

The real runtime adapter must implement the same load/unload contract without changing Heart behaviour.

## MAIS-specific evaluation suites

### Heart and continuity

- classify whether an event warrants work;
- create a bounded task plan;
- select a role and model tier;
- checkpoint without transcript history;
- resume from typed artefacts;
- terminate when complete;
- avoid inventing unfinished steps.

### Capability protocol

- choose the correct capability;
- emit valid typed arguments;
- distinguish proposal from execution;
- respect exact approval scope;
- avoid unauthorised actions;
- recover from stale base versions and rejected validation.

### Evidence analysis

- compare all supported tracking types;
- distinguish raw evidence from summaries;
- preserve `unsure` as uncertainty;
- identify conflicting evidence;
- avoid overstating sparse samples;
- retrieve correct sessions and exercise versions;
- preserve counter-evidence.

### Hypothesis quality

- generate several plausible explanations;
- identify confounds;
- specify distinguishing evidence;
- avoid repeating rejected proposals without new evidence;
- recognise when no useful conclusion is available.

### Generated analysis

- write valid constrained code;
- use only approved libraries;
- handle missing data;
- produce schema-valid output;
- run sensitivity checks;
- interpret actual tool output without changing values;
- record limitations.

### Experiment design

- isolate one meaningful variable where possible;
- define baseline and intervention;
- specify exposure target;
- state success, failure and ambiguity conditions;
- preserve reversibility;
- avoid permanent action without approval.

### Retrieval and memory

Evaluate synthetic histories of 10, 50, 200 and 1,000 sessions for:

- relevant-evidence recall;
- unrelated-evidence exclusion;
- belief update accuracy;
- counter-evidence retention;
- summary regeneration;
- duplicate detection;
- stale-summary resistance.

### Surface generation

- generate schema-valid declarative widgets;
- use approved components and bindings only;
- include attributable/removable metadata;
- fail safely when data is unavailable;
- honour safe mode and user blocklists.

## Hardware measurements

Capture for every configuration:

- on-disk model size;
- cold and warm load time;
- first-token latency;
- prefill and decode rate;
- peak RAM;
- KV-cache growth at 2K, 4K, 8K and 16K;
- unload time and reclaimed memory;
- battery delta;
- app frame responsiveness;
- task completion time;
- useful work per episode;
- validation/retry frequency.

Temperature may be recorded during manual/runtime evaluation, but MAIS does not implement its own thermal gate in Phase 3B. Android, the device daemon and the inference runtime are expected to throttle as required.

Long advertised context is not a default target. The Context Compiler should normally produce 2K–8K packets, with 16K reserved for justified Deep Lab work.

## Initial permissive resource policy

During early device evaluation:

- allow foreground Deep Lab episodes up to 15 minutes;
- allow one generative model resident at a time;
- do not require charging;
- stop new work when the app is closed or MAIS is explicitly paused;
- reduce work under Battery Saver, background state and active workout interaction;
- record battery, memory and responsiveness before tightening budgets;
- rely on Android/runtime thermal management rather than duplicate policy.

## Selection score

Each configuration is scored across:

- task correctness;
- calibration and uncertainty;
- structured-output validity;
- capability-call accuracy;
- generated-code success;
- checkpoint/recovery compliance;
- latency;
- memory;
- battery cost;
- usefulness per episode;
- failure diversity relative to other selected models.

A faster model does not win if it creates substantially more invalid actions. A larger model does not win when a smaller model completes the same role reliably at lower cost.

## Pass gates

A model/runtime configuration may enter the active app topology only when:

1. manifest and checksum are valid;
2. source, revision and licence are recorded;
3. load/unload succeeds repeatedly without process instability;
4. structured outputs meet the role threshold;
5. invalid capability calls are rejected safely;
6. interruption leaves a recoverable checkpoint;
7. measured memory/battery/responsiveness fit a documented device profile;
8. deterministic, simulated or alternative-model fallback exists;
9. model deletion removes the complete artefact and active registry entry.

## Download order

No manual download is required until the real runtime harness is ready.

Obtain candidates in this order:

1. EmbeddingGemma;
2. Gemma 4 E2B;
3. Gemma 4 E4B;
4. Qwen3-8B.

This proves storage, checksum, registry, retrieval and lifecycle behaviour before introducing the largest artefact.
