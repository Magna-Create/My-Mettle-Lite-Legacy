# Phase 3B — MAIS Model Pack, Role Routing and Semantic Memory

Status: native Qwen device-validation candidate.

## Target topology

| Capability | Model | Default backend | Context supplied by MAIS |
|---|---|---:|---:|
| Semantic retrieval | EmbeddingGemma 300M | CPU through localagents-rag | 512-token chunks; 256-dimensional stored vectors |
| Governor / frequent coach / memory triage | Gemma 4 E2B IT | CPU | 4,096 tokens |
| Deep Lab / coding / experiment design | Qwen3-4B Thinking W4A16 | Qualcomm NPU/HTP through GenieX QAIRT | up to 12,288 tokens |

These are capability slots. The registry may replace a model or runtime without changing Heart task definitions.

## Working retrieval path

EmbeddingGemma now uses:

```text
embeddinggemma-300M_seq512_mixed-precision.tflite
sentencepiece.model
```

through `localagents-rag:0.3.0` on CPU.

Confirmed S25 Ultra retrieval probe:

- matching score: `0.7881`;
- unrelated score: `0.2535`;
- margin: `0.5346`;
- document pass: `1040 ms`;
- query pass: `408 ms`.

The initially selected Qualcomm SM8750 AOT file returned a null native model handle through the wrapper and is rejected. A direct QNN embedding adapter remains future work after the generative Qualcomm pipeline is proven.

## Gemma 4 E2B

The generic `gemma-4-E2B-it.litertlm` remains the ordinary-work default and exposes CPU/GPU baselines.

Measured previously on the target phone:

- CPU: 402 ms load, 1.88 s first chunk, 3.96 s generation, 4.66 s total;
- GPU: 3.82 s load, 544 ms first chunk, 1.41 s generation, 5.58 s total.

Frequent short E2B episodes therefore default to CPU. GPU remains available for explicit longer comparisons.

The public `gemma-4-E2B-it_qualcomm_sm8750.litertlm` NPU package is no longer treated as a production candidate. It reaches the LiteRT-LM NPU executor but fails engine creation with `TF_LITE_AUX not found`. The next E2B NPU route is a custom GenieX/QAIRT export after Qwen passes the native device gate.

## Qwen3-4B Thinking · 12K

The app installs the complete custom W4A16 bundle compiled for Snapdragon 8 Elite for Galaxy:

```text
MagneRex/Qwen3-4B-Genie-Snapdragon-8-Elite-12K
```

The installer supports:

- sequential resumable downloads;
- 15-member atomic readiness;
- per-file trust-on-first-use hashes;
- explicit complete-pack re-verification;
- complete deletion and clean reinstall.

## Native GenieX QAIRT Android adapter

Implemented:

1. open C++17 JNI bridge with no redistributed Qualcomm headers or linked SDK binaries;
2. statically linked Android C++ runtime so the bridge is self-contained;
3. private QAIRT 2.45 packager for local SDK assets;
4. transitive Android shared-library dependency validation;
5. Termux staging script with version, target and SHA-256 checks;
6. Qualcomm-style `arm64-v8a` packaging with legacy extraction;
7. v73 HTP stub/skeleton detection for Snapdragon 8 Elite;
8. dynamic loading of QNN host libraries and `libGenie.so`;
9. in-memory absolute path rewriting for tokenizer, backend extension and all four context binaries;
10. Genie configuration, profiler and dialog lifecycle;
11. bounded non-thinking Qwen prompt;
12. final-output extraction;
13. load, first-callback, generation, unload, total and PSS telemetry;
14. QAIRT profiler parsing where metrics are supplied;
15. persistent result/error reporting;
16. dedicated Settings status and native benchmark panels.

The open JNI bridge passes native compilation and is packaged in the ARM64 APK. Licensed QAIRT assets remain excluded from Git and CI; the final runtime test therefore requires a local APK built with the user's matching SDK package.

## Runtime safety

- only one Qwen native baseline may run at once;
- the current probe is intentionally non-cancellable until Qualcomm's exact dialog-signal ABI is validated;
- dialog/configuration/profiler handles are released after every run;
- Qwen is not yet called by autonomous MAIS roles;
- deep episodes continue to record deterministic fallback until repeated on-device success;
- failed runtime setup does not mutate training state.

## Autonomous role execution

The historical `createDeterministicMaisRoleRunner` entry point creates a hybrid runner:

1. select the role model from `models/registry.json`;
2. check whether its exact artefact is installed and verified;
3. compile a bounded typed training-evidence packet;
4. run one fresh local conversation only when the compatible native runtime is approved;
5. validate strict role JSON;
6. filter provenance references against supplied IDs;
7. persist the artefact plus runtime telemetry;
8. unload the model;
9. use the deterministic fallback when any gate fails.

Qwen's GenieX provider remains disabled inside this runner until the device gate passes repeatedly.

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

## Semantic memory

EmbeddingGemma does not process the complete database in one input. The semantic-memory pipeline creates:

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

## Remaining gate

1. obtain the matching QAIRT 2.45 SDK package locally;
2. create and transfer the private Android build-assets ZIP;
3. build the APK in Termux with those assets;
4. confirm QAIRT status is Ready;
5. create the Qwen Genie dialog;
6. generate non-empty text on NPU;
7. unload cleanly;
8. repeat after force-stop/reopen;
9. record performance, memory and stability;
10. pin a validated Hugging Face tag and per-file hashes;
11. only then enable Qwen inside the autonomous native role runner.

Detailed procedure:

```text
docs/PHASE_3B_QWEN_NATIVE_DEVICE_TEST.md
```
