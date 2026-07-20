# MAIS Model and Runtime Evaluation

Status: Phase 3A benchmark contract.

Model selection is empirical. My Mettle evaluates a complete deployment unit:

> model + quantisation + runtime + hardware backend + context configuration + role prompt

No model weights belong in the source repository. The repository stores manifests, download/conversion recipes, checksums, licences, prompts, evaluations and measured results.

## Current candidate topology

### Retrieval

- EmbeddingGemma

Purpose:

- semantic retrieval across reflections, analyses and imported research;
- matching new evidence to existing hypotheses;
- clustering recurring themes;
- near-duplicate detection;
- Context Compiler retrieval.

### Fast Governor

- Gemma 4 E2B

Purpose:

- event triage;
- task routing;
- context selection;
- lightweight memory work;
- deciding whether Deep Lab is justified;
- quick cached Brief preparation.

### General reasoning and audit

- Gemma 4 E4B

Purpose:

- ordinary longitudinal interpretation;
- hypothesis development;
- proposal drafting;
- multimodal context later;
- auditing and counter-explanation generation.

### Deep Lab

- Qwen3-8B

Purpose:

- difficult longitudinal reasoning;
- generated analysis code;
- sensitivity testing;
- experiment design;
- complex capability sequencing;
- high-value investigations.

The topology is provisional. Benchmarks may collapse roles onto fewer models or assign a role to another family.

## Current official deployment facts

### Gemma 4

Google positions Gemma 4 E2B and E4B for mobile and laptop deployment. Both support configurable reasoning, native function calling and text/image/audio input. LiteRT-LM currently supports both mobile variants.

Official references:

- https://ai.google.dev/gemma/docs/core/model_card_4
- https://developers.google.com/edge/litert-lm/models/gemma-4
- https://developers.google.com/edge/litert-lm/overview

Published LiteRT-LM mobile artefacts are approximately:

- E2B: 2.58 GB;
- E4B: 3.65 GB.

Published S26 Ultra results are useful reference points but are not accepted as My Mettle performance evidence. The target phone must be measured directly.

### Qwen3-8B

The official Qwen model card identifies:

- 8.2B parameters;
- hybrid thinking and non-thinking modes;
- strong reasoning, coding, tool-use and agent emphasis;
- 32,768 native context and extended long-context support;
- Apache-2.0 licence.

Official references:

- https://huggingface.co/Qwen/Qwen3-8B
- https://qwenlm.github.io/blog/qwen3/
- https://github.com/QwenLM/Qwen3

### Android runtimes

Primary candidate:

- LiteRT-LM for Gemma and cross-family evaluation, Kotlin integration, hardware acceleration and constrained tool use.

Secondary candidate:

- ExecuTorch for Qwen/PyTorch paths, explicit Android load/unload control and XNNPACK, Vulkan and Qualcomm backends.

Official references:

- https://developers.google.com/edge/litert-lm/api_overview
- https://docs.pytorch.org/executorch/stable/using-executorch-android.html

## Artefact policy

Model files live outside Git in one of:

- developer-local model registry;
- app-private Android storage;
- controlled release/object storage;
- direct verified download from the declared source.

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

## Candidate configurations

The first benchmark matrix should include:

| Candidate | Runtime | Quantisation/backend candidates | Intended role |
|---|---|---|---|
| EmbeddingGemma | LiteRT | mobile quantised CPU/GPU | retrieval |
| Gemma 4 E2B IT | LiteRT-LM | published mobile format, CPU/GPU/NPU where available | fast governor |
| Gemma 4 E4B IT | LiteRT-LM | published mobile format, CPU/GPU/NPU where available | general reasoner/auditor |
| Qwen3-8B | LiteRT-LM | supported mobile conversion candidates | Deep Lab |
| Qwen3-8B | ExecuTorch | XNNPACK, Vulkan, Qualcomm where available | Deep Lab comparison |

Do not benchmark several unverified community quantisations at once. Start with official or reproducibly converted artefacts, establish a baseline, then vary quantisation.

## MAIS-specific evaluation suites

### Heart and continuity

- classify whether an event warrants work;
- create a bounded task plan;
- select a role and model tier;
- checkpoint without relying on transcript history;
- resume from typed artefacts;
- terminate when the task is complete;
- avoid inventing unfinished steps.

### Capability protocol

- choose the correct capability;
- emit valid typed arguments;
- distinguish proposal from execution;
- respect exact approval scope;
- avoid unauthorised actions;
- recover cleanly from stale resources or rejected validation.

### Evidence analysis

- compare all supported tracking types;
- distinguish raw evidence from summaries;
- preserve `unsure` as uncertainty;
- identify conflicting evidence;
- avoid overstating sparse samples;
- retrieve the correct sessions and exercise versions;
- preserve counter-evidence.

### Hypothesis quality

- generate several plausible explanations;
- identify confounds;
- specify what evidence would distinguish them;
- avoid repeating a rejected proposal without meaningful new evidence;
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

Evaluate at synthetic histories of 10, 50, 200 and 1,000 sessions:

- relevant evidence recall;
- unrelated-evidence exclusion;
- belief update accuracy;
- counter-evidence retention;
- summary regeneration;
- duplicate detection;
- resistance to stale summaries.

### Surface generation

- generate schema-valid declarative widgets;
- use only approved components and bindings;
- provide removable and attributable metadata;
- fail safely when data is unavailable.

## Hardware measurements

Capture for every configuration:

- on-disk model size;
- cold and warm load time;
- first-token latency;
- prefill rate;
- decode rate;
- peak RAM;
- KV-cache growth at 2K, 4K, 8K and 16K contexts;
- unload time and reclaimed memory;
- battery delta;
- thermal status and surface temperature where available;
- app frame responsiveness;
- task completion time;
- useful work per episode;
- validation/retry frequency.

Long advertised context is not a default target. The Context Compiler should normally produce 2K–8K packets, with 16K permitted for justified Deep Lab investigations.

## Initial permissive resource policy

During Phase 3A testing:

- allow foreground Deep Lab episodes up to 15 minutes;
- allow one generative model resident at a time;
- do not require charging;
- pause only on severe thermal state, app closure or explicit user pause;
- record battery and thermal telemetry before tightening ordinary budgets;
- prioritise app responsiveness during active workout interaction.

## Selection score

Each candidate is scored across:

- task correctness;
- calibration and uncertainty;
- structured-output validity;
- capability-call accuracy;
- generated-code success;
- recovery and checkpoint compliance;
- latency;
- memory;
- thermal/battery cost;
- usefulness per episode;
- failure diversity relative to other selected models.

A faster model does not win if it creates substantially more invalid actions. A larger model does not win if a smaller model completes the same role reliably at lower cost.

## Pass gates

A model/runtime configuration may enter the app only when:

1. its manifest and checksum are valid;
2. licence and source are recorded;
3. load/unload succeeds repeatedly without process instability;
4. structured task outputs meet the role threshold;
5. invalid capability calls are rejected safely;
6. interruption produces a recoverable checkpoint;
7. resource telemetry remains within a documented device profile;
8. deterministic or alternative-model fallback exists;
9. model deletion removes the complete artefact and registry entry.

## Download order

No manual download is required until the runtime harness exists.

When ready, obtain candidates in this order:

1. EmbeddingGemma;
2. Gemma 4 E2B;
3. Gemma 4 E4B;
4. Qwen3-8B.

This proves the registry, retrieval and model lifecycle before introducing the largest artefact.
