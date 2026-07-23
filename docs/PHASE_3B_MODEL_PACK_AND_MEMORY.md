# Phase 3B — MAIS Model Pack, Role Routing and Semantic Memory

Status: device-validation candidate.

## Target topology

| Capability | Logical model | Installable artefact | Default backend | Context supplied by MAIS |
|---|---|---|---:|---:|
| Semantic retrieval | EmbeddingGemma 300M | Qualcomm SM8750 TFLite | Qualcomm NPU, CPU fallback | 512-token chunks; 256-dimensional stored vectors |
| Governor / analyst / auditor / coach / memory triage | Gemma 4 E2B IT | Generic LiteRT-LM | CPU | 4,096 tokens |
| Same-model acceleration comparison | Gemma 4 E2B IT | Qualcomm SM8750 LiteRT-LM | NPU | 4,096 tokens |
| Deep Lab / coding / experiment design | Qwen3-4B Thinking | W4A16 GenieX QAIRT bundle for Snapdragon 8 Elite for Galaxy | Qualcomm NPU/HTP | up to 12,288 tokens |

These are capability slots. The registry may replace an artefact or runtime without changing Heart task definitions.

Gemma 4 E4B and the temporary Qwen3-8B LiteRT-LM stand-in are retired. They are not present in the active registry or installer.

## Why E2B remains CPU-first

Measured on the target Galaxy S25 Ultra with the generic Gemma 4 E2B artefact:

- CPU: 402 ms load, 1.88 s first chunk, 3.96 s generation, 4.66 s total;
- GPU: 3.82 s load, 544 ms first chunk, 1.41 s generation, 5.58 s total.

Frequent short E2B episodes therefore continue to default to CPU. The production default changes only after repeated target-device measurements demonstrate that another path improves useful work, memory and battery cost rather than one isolated generation metric.

No charging requirement is imposed. Battery Saver and active workout interaction still prevent standard/deep Heart work.

## E2B same-model NPU comparison

LiteRT Community publishes a hardware-specific file:

```text
gemma-4-E2B-it_qualcomm_sm8750.litertlm
```

SM8750 is the Snapdragon 8 Elite target used by the Galaxy S25 Ultra. This is a separate compiled artefact of the same E2B model, not a different agent or role.

The Runtime Lab therefore exposes:

1. generic E2B on CPU;
2. generic E2B on GPU;
3. Qualcomm SM8750 E2B on NPU.

The NPU path:

- requests `Backend.NPU` directly;
- uses the Android native-library directory;
- never silently falls back to CPU/GPU;
- records unsupported artefacts/libraries as an ordinary failed benchmark;
- releases any partially initialised engine.

The Qualcomm accelerator is the NPU/HTP, not a TPU.

## Qwen3-4B Thinking 12K

The production deep model is hosted at:

```text
MagneRex/Qwen3-4B-Genie-Snapdragon-8-Elite-12K
```

Build contract:

- runtime: GenieX QAIRT;
- precision: W4A16;
- target: Snapdragon 8 Elite for Galaxy;
- context: 12,288 tokens;
- sequence lengths: 128 prompt processing / 1 decode;
- QAIRT compilation version: `2.45.0.260326154327`;
- bundle: four compiled `.bin` contexts plus Genie, HTP, metadata and tokenizer files.

This is not a `.litertlm` file and must never be passed to the LiteRT-LM engine. The TypeScript installer supports the multi-file pack now. Native GenieX execution remains a distinct Android adapter and device gate.

Until that adapter passes, a deep role records a deterministic fallback instead of attempting an incompatible runtime.

## Model artefact integrity

### Gemma E2B generic CPU/GPU

The selected generic file is pinned to its source revision and SHA-256:

```text
ab7838cdfc8f77e54d8ca45eadceb20452d9f01e4bfade03e5dce27911b27e42
```

### Gemma E2B Qualcomm SM8750 NPU

The hardware-specific file is pinned to its source revision, exact size and SHA-256:

```text
3016294400 bytes
41dd675fbe735b6029012b5576a5716bac614fd8156de0128db4c9dff3cebd4e
```

Downloaded bytes are promoted from `.part` only after the complete digest matches.

### Qwen3-4B GenieX pack

The initial public repository revision uses trust on first use per member:

1. download each required file over HTTPS;
2. calculate its SHA-256 locally;
3. write the digest with file length and modification timestamp;
4. require the same verification metadata on later launches;
5. report the logical pack Ready only when every member is Ready.

Cancellation retains the current `.part` file for resume. Deletion removes every final, partial and verification file in the logical pack.

After the first successful target-device pass, create a stable Hugging Face release tag and replace trust on first use with a pinned revision plus a declared digest for every member.

### EmbeddingGemma

Manual/gated until the user has accepted the source licence and an authenticated artefact workflow is implemented.

## Retired-model cleanup

An APK upgrade removes these old E4B files from app-private storage:

```text
gemma-4-E4B-it.litertlm
gemma-4-E4B-it.litertlm.part
gemma-4-E4B-it.litertlm.verified.json
```

This cleanup is idempotent and does not touch training data or other installed models.

## Autonomous role execution

The historical `createDeterministicMaisRoleRunner` entry point creates a hybrid runner:

1. select the role model from `models/registry.json`;
2. locate a compatible native runtime artefact;
3. check whether the exact artefact is installed and verified;
4. compile a bounded typed training-evidence packet;
5. run one fresh local conversation on the configured backend;
6. validate strict role JSON;
7. filter provenance references against supplied IDs;
8. persist the artefact plus runtime telemetry;
9. unload the model;
10. use the deterministic fallback when any gate fails.

The current native role runner is LiteRT-LM-backed for E2B. Qwen joins the same contract after the separate GenieX adapter is implemented.

A fallback is not hidden. The Workbench artefact records:

- intended model;
- fallback reason;
- source `deterministic_fallback`.

Real outputs record:

- model and runtime;
- backend;
- load, first-chunk, generation, unload and total time;
- peak process PSS.

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
- belief and imported-research documents.

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

This is the bridge between an accumulating local history and bounded model input. E2B normally receives compact 4K packets; justified Qwen deep episodes may use up to the compiled 12,288-token ceiling.

## Current boundary

Implemented:

- persistent installer for single-file and multi-file model packs;
- generic and Qualcomm SM8750 E2B artefacts;
- published Qwen3-4B Thinking 12K GenieX bundle metadata;
- E4B retirement and upgrade cleanup;
- CPU/GPU/NPU LiteRT-LM benchmark selection;
- capability-based role routing;
- real E2B Heart role execution with deterministic fallback;
- typed training evidence;
- semantic documents, chunking, vector records, retrieval and incremental manifests;
- separate vector persistence;
- development observability.

Still gated:

- target-device download/resume/delete test of the Qwen pack;
- Qualcomm SM8750 E2B NPU benchmark evidence;
- matching GenieX QAIRT Android runtime integration for Qwen;
- Qwen load/generation/memory/stability evidence at 12K;
- stable Hugging Face tag and per-file digest pinning;
- authenticated EmbeddingGemma installation;
- final model-selection report.
