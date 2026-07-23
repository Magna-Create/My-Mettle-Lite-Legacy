# Phase 3B — MAIS Model Pack, Role Routing and Semantic Memory

Status: device validation candidate.

## Target topology

| Capability | Model | Default backend | Context supplied by MAIS |
|---|---|---:|---:|
| Semantic retrieval | EmbeddingGemma 300M | CPU through localagents-rag | 512-token chunks; 256-dimensional stored vectors |
| Governor / frequent coach / memory triage | Gemma 4 E2B IT | CPU | 4,096 tokens |
| Deep Lab / coding / experiment design | Qwen3-4B Thinking W4A16 | Qualcomm NPU/HTP through GenieX QAIRT | up to 12,288 tokens |

These are capability slots. The registry may replace a model or runtime without changing Heart task definitions.

## Why CPU for E2B and GPU for longer generic runs

Measured on the target Galaxy S25 Ultra with the generic Gemma 4 E2B artefact:

- CPU: 402 ms load, 1.88 s first chunk, 3.96 s generation, 4.66 s total;
- GPU: 3.82 s load, 544 ms first chunk, 1.41 s generation, 5.58 s total.

Frequent short E2B episodes therefore default to CPU. GPU remains available for explicit longer comparisons. No charging requirement is imposed. Battery Saver and active workout interaction still prevent standard/deep Heart work.

## NPU policy

The generic E2B `.litertlm` file is CPU/GPU-only and is never passed to the Qualcomm NPU executor. The separate `gemma-4-E2B-it_qualcomm_sm8750.litertlm` artefact is the only E2B file registered for an NPU probe. The runtime never silently falls back to CPU/GPU.

The first EmbeddingGemma attempt used `embeddinggemma-300M_seq512_mixed-precision.qualcomm.sm8750.tflite` through `localagents-rag:0.3.0`. The packaged Java wrapper loaded but its native initialiser returned a null model handle. That combination is now rejected. Semantic retrieval uses the generic `embeddinggemma-300M_seq512_mixed-precision.tflite` file on CPU through the wrapper, while a direct LiteRT NPU adapter remains separate future work.

Qwen3-4B uses the custom 12K GenieX QAIRT bundle compiled for Snapdragon 8 Elite for Galaxy. The app can download, resume, verify and delete the complete 15-file pack. Native QAIRT generation remains the final runtime adapter gate.

## Model artefact integrity

### Gemma E2B

Both generic and Qualcomm artefacts use published SHA-256 values. Downloaded bytes are promoted from `.part` only after the complete digest matches.

### Qwen3-4B Thinking · 12K

The first public repository revision uses trust on first use per bundle member:

1. download the complete file over HTTPS;
2. calculate SHA-256 locally;
3. write that digest with file length and modification timestamp;
4. require the same pinned metadata on later launches;
5. expose **Verify 12K pack** to re-check all 15 files.

Pack verification proves installation integrity. It does not claim successful text generation before the GenieX QAIRT Android adapter exists.

### EmbeddingGemma

The generic seq512 `.tflite` file and `sentencepiece.model` remain manual/gated imports until an authenticated artefact workflow is implemented.

## Autonomous role execution

The historical `createDeterministicMaisRoleRunner` entry point now creates a hybrid runner:

1. select the role model from `models/registry.json`;
2. check whether its exact artefact is installed and verified;
3. compile a bounded typed training-evidence packet;
4. run one fresh local conversation on the configured backend when a compatible native runtime exists;
5. validate strict role JSON;
6. filter provenance references against supplied IDs;
7. persist the artefact plus load/generation/unload telemetry;
8. unload the model;
9. use the deterministic fallback when any gate fails.

A fallback is not hidden. The Workbench artefact records the intended model, fallback reason and source `deterministic_fallback`.

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
- belief, memory, research and completed-analysis documents.

Documents are split into provenance-linked chunks targeting roughly 384 tokens. The model produces 768-dimensional vectors, which are truncated and re-normalised to 256 dimensions for storage.

Vectors live in a separate IndexedDB database:

```text
my-mettle-mais-vectors
```

Each indexing pass compares stable document hashes. Unchanged documents keep their vectors, changed evidence is re-indexed, removed documents lose their vectors, and raw training evidence remains authoritative.

## Current boundary

Implemented:

- multi-model persistent installer;
- generic and Qualcomm E2B artefacts;
- Qwen3-4B 12K multi-file installer;
- CPU/GPU/NPU runtime selection with artefact compatibility gates;
- role routing and deterministic fallback;
- typed training evidence;
- semantic documents, chunking, retrieval and incremental manifests;
- separate vector persistence;
- development observability;
- Qwen pack re-verification.

Still gated:

- successful E2B Qualcomm NPU generation on the target phone;
- successful generic EmbeddingGemma retrieval probe;
- direct LiteRT NPU adapter for EmbeddingGemma, if retained;
- native GenieX QAIRT execution adapter;
- Qwen 12K load, generation, memory and stability evidence;
- authenticated EmbeddingGemma installation;
- final model-selection report.
