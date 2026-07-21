# Phase 3B — MAIS Model Pack, Role Routing and Semantic Memory

Status: device validation candidate.

## Target topology

| Capability | Model | Default backend | Context supplied by MAIS |
|---|---|---:|---:|
| Semantic retrieval | EmbeddingGemma 300M | Qualcomm NPU, CPU fallback | 512-token chunks; 256-dimensional stored vectors |
| Governor / frequent coach / memory triage | Gemma 4 E2B IT | CPU | 4,096 tokens |
| Analyst / auditor / richer coach | Gemma 4 E4B IT | GPU | 8,192 tokens |
| Deep Lab / coding / experiment design | Qwen3-8B mixed INT4 | GPU | 2,048 tokens |

These are capability slots. The registry may replace a model or runtime without changing Heart task definitions.

## Why CPU for E2B and GPU for larger work

Measured on the target Galaxy S25 Ultra with Gemma 4 E2B:

- CPU: 402 ms load, 1.88 s first chunk, 3.96 s generation, 4.66 s total;
- GPU: 3.82 s load, 544 ms first chunk, 1.41 s generation, 5.58 s total.

Frequent short E2B episodes therefore default to CPU. Standard/deep episodes default to GPU because their longer prompts and outputs can amortise model initialisation while benefiting from faster prefill and generation.

No charging requirement is imposed. Battery Saver and active workout interaction still prevent standard/deep Heart work.

## NPU policy

The earlier CPU/GPU baselines did not use the Qualcomm NPU. Phase 3B adds an explicit LiteRT-LM NPU probe for Gemma E2B and E4B.

The probe:

- requests `Backend.NPU` directly;
- uses the app native-library directory;
- never silently falls back to CPU/GPU;
- records unsupported artefacts/libraries as an ordinary failed benchmark;
- releases any partially initialised engine.

A generic `.litertlm` file being listed as NPU-capable does not prove it is compatible with this phone's Qualcomm path. The device probe remains authoritative.

EmbeddingGemma is the preferred first production NPU workload because LiteRT Community publishes an AOT artefact targeted at Qualcomm SM8750. That source is licence-gated, so My Mettle does not attempt an unauthenticated background download.

Qwen3-8B initially uses LiteRT-LM GPU. ExecuTorch with the Qualcomm QNN backend remains the later NPU comparison path.

## Model artefact integrity

### Gemma E2B / E4B

Both use published SHA-256 values. Downloaded bytes are promoted from `.part` only after the complete digest matches.

### Qwen3-8B mixed INT4

The indexed official model card does not publish a stable checksum for the selected file. The development installer therefore uses trust on first use:

1. download the complete file over HTTPS;
2. calculate SHA-256 locally;
3. write that digest with file length and modification timestamp;
4. display the pinned digest in Runtime Lab;
5. require the same pinned metadata on later launches.

This policy is explicit in `models/artifacts.json` and can be replaced by a published checksum without changing the installer.

### EmbeddingGemma

Manual/gated until the user has accepted the source licence and an authenticated artefact workflow is implemented.

## Autonomous role execution

The historical `createDeterministicMaisRoleRunner` entry point now creates a hybrid runner:

1. select the role model from `models/registry.json`;
2. check whether its exact artefact is installed and verified;
3. compile a bounded typed training-evidence packet;
4. run one fresh local conversation on the configured backend;
5. validate strict role JSON;
6. filter provenance references against supplied IDs;
7. persist the artefact plus load/generation/unload telemetry;
8. unload the model;
9. use the deterministic fallback when any gate fails.

A fallback is not hidden. The Workbench artefact records:

- intended model;
- fallback reason;
- source `deterministic_fallback`.

Real outputs record:

- model and runtime;
- backend;
- load, first-chunk, generation, unload and total time;
- peak process PSS.

The development Activity console exposes recent role execution directly.

## Training evidence supplied to roles

For relevant event references, MAIS reads the Phase 2 database and supplies:

- direct completed/amended sessions;
- session day, mode, routine and bodyweight snapshot;
- exercise identity and historical tracking snapshot;
- prescribed/work/warm-up sets;
- reflection values and note;
- exercise memory;
- current and source routine versions;
- up to five comparable exposures per affected exercise;
- related experiments;
- recent body measurements;
- warnings for excluded/incomplete evidence.

Large packets are reduced through valid JSON tiers. They are never cut mid-object.

## EmbeddingGemma and large histories

EmbeddingGemma is not asked to process the complete database in one input. The semantic-memory pipeline creates:

- one stable document per completed session;
- one evolving document per exercise history;
- one document per routine version;
- one document per experiment;
- later, belief and research documents.

Documents are split into provenance-linked chunks, currently targeting roughly 384 tokens. Vectors use 256 dimensions by default to reduce storage and comparison cost while retaining the option to regenerate 128/512/768-dimensional indexes.

Vectors live in a separate IndexedDB database:

```text
my-mettle-mais-vectors
```

The main MAIS snapshot stores only semantic manifests, not large `Float32Array` values.

Each indexing pass compares stable document hashes:

- unchanged documents keep their vectors;
- a new session indexes that session and changed exercise histories;
- changed reflections re-index affected documents;
- removed documents delete their vectors;
- raw training evidence always remains authoritative.

Retrieval applies:

- cosine similarity;
- type filters;
- maximum matches per document to avoid one long history dominating;
- downstream token budgets;
- provenance retention;
- explicit omitted-match counts.

This is the bridge between accumulating data and the 2K Qwen artefact context: EmbeddingGemma retrieves the useful evidence, then the Context Compiler builds a small valid packet for Deep Lab.

## Current boundary

Implemented:

- multi-model persistent installer;
- E2B/E4B/Qwen generative registry;
- CPU/GPU/NPU runtime selection;
- role routing;
- real Heart role execution with fallback;
- typed training evidence;
- semantic documents, chunking, vector records, retrieval and incremental manifests;
- separate vector persistence;
- development observability.

Still gated:

- device download/benchmark of E4B and Qwen;
- successful/failed Qualcomm NPU evidence;
- authenticated EmbeddingGemma installation;
- real EmbeddingGemma inference adapter;
- automated vector indexing after training events;
- Qwen generated-analysis sandbox execution;
- final model-selection report.
