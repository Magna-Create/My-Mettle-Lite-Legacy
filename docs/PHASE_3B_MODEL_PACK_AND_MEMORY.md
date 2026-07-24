# Phase 3B — MAIS Model Pack, Role Routing and Semantic Memory

Status: Qwen device-validation candidate.

## Target topology

| Capability | Model | Default backend | Context supplied by MAIS |
|---|---|---:|---:|
| Semantic retrieval | EmbeddingGemma 300M | CPU through localagents-rag | 512-token chunks; 256-dimensional stored vectors |
| Governor / frequent coach / memory triage | Gemma 4 E2B IT | CPU | 4,096 tokens |
| Deep Lab / coding / experiment design | Qwen3-4B Thinking W4A16 | Qualcomm NPU/HTP through GenieX QAIRT | up to 12,288 tokens |

These are capability slots. The registry may replace a model or runtime without changing Heart task definitions.

## Working retrieval path

EmbeddingGemma uses:

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

The public `gemma-4-E2B-it_qualcomm_sm8750.litertlm` NPU package is no longer treated as a production candidate. It reaches the LiteRT-LM NPU executor but fails engine creation with `TF_LITE_AUX not found`. The next E2B NPU route is a custom GenieX/QAIRT export after Qwen passes the device gate.

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

## Supported GenieX Android adapter

The runtime is consumed normally from Maven Central:

```gradle
implementation 'com.qualcomm.qti:geniex-android:0.3.5'
```

Implemented:

1. GenieX SDK initialisation from the APK;
2. automatic QAIRT plugin registration;
3. direct use of the existing verified Qwen bundle directory;
4. `LlmWrapper` creation with model-default QAIRT context values;
5. explicit NPU compute selection;
6. chat-template application with thinking enabled;
7. token streaming through Kotlin Flow;
8. supported stop-stream cancellation;
9. profiler capture for TTFT, prompt/decode time, token counts and rates;
10. final-output extraction after the model's reasoning section;
11. ephemeral reasoning handling: only the final answer and reasoning-length telemetry are retained;
12. deterministic wrapper destruction and process-memory telemetry;
13. persistent final-result/error reporting;
14. dedicated Settings status and benchmark controls.

The runtime ships inside every ordinary APK/AAB resolved by Gradle. There is no private QAIRT SDK, runtime ZIP, custom JNI bridge, WSL setup or per-user build dependency.

## Runtime safety

- only one Qwen baseline may run at once;
- thinking is enabled for every Qwen baseline and future deep role call;
- raw reasoning content is not persisted, displayed or exported;
- cancellation uses GenieX's supported `stopStream()` path;
- destruction happens only in final cleanup;
- Qwen is not yet called by autonomous MAIS roles;
- deep episodes continue to record deterministic fallback until repeated on-device success;
- failed runtime setup does not mutate training state.

## Autonomous role execution

The historical `createDeterministicMaisRoleRunner` entry point creates a hybrid runner:

1. select the role model from `models/registry.json`;
2. check whether its exact artefact is installed and verified;
3. compile a bounded typed training-evidence packet;
4. run one fresh local conversation only when the compatible runtime is approved;
5. validate strict role JSON;
6. filter provenance references against supplied IDs;
7. persist the final artefact plus runtime telemetry, not the model's private reasoning transcript;
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

1. build and install the ordinary APK;
2. confirm GenieX and the QAIRT plugin initialise from the bundled Maven dependency;
3. verify the Qwen 12K pack;
4. load the Qwen wrapper on NPU;
5. confirm thinking produces reasoning followed by non-empty final text;
6. confirm the reasoning transcript is discarded and only final output/telemetry remain;
7. test supported cancellation;
8. unload cleanly;
9. repeat after force-stop/reopen;
10. record performance, memory and stability;
11. pin a validated Hugging Face tag and per-file hashes;
12. only then enable Qwen inside the autonomous role runner.

Detailed procedure:

```text
docs/PHASE_3B_QWEN_NATIVE_DEVICE_TEST.md
```
