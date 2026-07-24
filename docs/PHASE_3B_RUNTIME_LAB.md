# Phase 3B — MAIS Model and Runtime Laboratory

Status: active runtime evaluation.

Phase 3A proved the Heart, Workbench, persistence, capability protocol, model leases and resource governor with deterministic model-role simulators. Phase 3B replaces those simulated boundaries incrementally with measured Android runtimes and real local models.

## Accepted runtime paths

### Everyday model — Gemma 4 E2B IT

E2B remains the first active production language model through LiteRT-LM 0.14.0.

Two separately installable artefacts represent the same logical model:

- `gemma-4-E2B-it.litertlm` — generic CPU/GPU build;
- `gemma-4-E2B-it_qualcomm_sm8750.litertlm` — public Qualcomm NPU package.

The generic artefact works on CPU/GPU and remains the ordinary-work default. The public Qualcomm package currently fails on the target phone with `TF_LITE_AUX not found`; it is retained as a documented compatibility result, not the production NPU route. A custom E2B GenieX export follows after the Qwen pipeline passes.

### Deep model — Qwen3-4B Thinking 12K

The deep model is a custom W4A16 GenieX QAIRT bundle hosted at:

```text
MagneRex/Qwen3-4B-Genie-Snapdragon-8-Elite-12K
```

It was compiled for Snapdragon 8 Elite for Galaxy with:

- QAIRT compilation identifier `2.45.0.260326154327`;
- 12,288-token context;
- sequence lengths 128 / 1;
- Qualcomm NPU/HTP execution target.

Qwen is not a LiteRT-LM file. Its model-pack installer and execution runtime remain separate concerns.

Gemma 4 E4B and Qwen3-8B are retired from the active model laboratory.

## Runtime distribution

My Mettle uses Qualcomm's supported Android binding:

```gradle
implementation 'com.qualcomm.qti:geniex-android:0.3.5'
```

Gradle resolves GenieX and its native QAIRT plugin from Maven Central. The resulting APK/AAB is self-contained from the installer's perspective. Users do not install QAIRT, WSL, a private runtime ZIP, the Android NDK or a custom JNI bridge.

Model weights remain separate and are downloaded in-app to persistent app-private storage. A normal signed app update replaces the bundled runtime while preserving downloaded models and training data.

## Artefact policy

Model weights never enter Git, the APK or JavaScript state.

Each model is identified by a manifest containing:

- stable artefact and model IDs;
- source repository and revision;
- one or more download URLs;
- filenames and formats;
- expected sizes;
- pinned SHA-256 values or an explicit temporary trust-on-first-use policy;
- licence;
- runtime and version;
- backend candidates.

Normal signed APK updates preserve installed model data. Uninstalling the app or using Android **Clear data** removes models. **Clear cache** does not.

## Verified installation

### Single-file artefacts

The native installer supports:

- direct HTTPS streaming into app-private storage;
- partial `.part` files;
- HTTP Range resume;
- cancellation;
- free-space preflight;
- progress events;
- native SHA-256 verification;
- atomic promotion after verification;
- verification sidecar metadata;
- complete deletion.

### Multi-file Qwen pack

The TypeScript model-pack layer composes the existing single-file native downloader into a sequential resumable bundle installer.

The logical pack contains four compiled context binaries, Genie/HTP configuration, model metadata, tokenizer files and a sample prompt. It reports Ready only when every required member is installed and verified. Cancellation retains partial bytes; deletion removes every final, partial and verification file.

The first public revision uses trust on first use per member. A validated Hugging Face tag and declared per-file hashes are required before release finalisation.

## Real E2B inference baseline

Each E2B baseline verifies the artefact, creates the LiteRT-LM engine on the selected supported backend, runs one bounded prompt, records timing and process memory, then closes the conversation and engine.

The valid working comparison is generic E2B on CPU and GPU. The public SM8750 NPU package is marked blocked by the upstream package/runtime incompatibility and should not be retried repeatedly.

## Qwen GenieX execution gate

The supported Android adapter now:

1. initialises `GenieXSdk` from the ordinary APK;
2. registers the bundled QAIRT plugin;
3. opens the existing verified Qwen bundle directory through `LlmWrapper`;
4. selects `runtime_id=qairt` and NPU compute;
5. uses model-default QAIRT context settings;
6. applies the chat template with thinking enabled;
7. streams tokens through Kotlin Flow;
8. supports cancellation through `stopStream()`;
9. captures GenieX profiling data;
10. destroys the wrapper in final cleanup;
11. separates ephemeral reasoning from the saved final MAIS artefact;
12. fails cleanly without CPU/GPU fallback when the NPU path is unavailable.

Until the device gate passes repeatedly, deep episodes use deterministic fallback and record Qwen as the intended model.

## Context gates

Initial benchmark contexts are:

- 2K ordinary Governor packet;
- 4K standard E2B packet;
- 8K high-value Qwen packet;
- 12,288-token Qwen ceiling for justified deep work.

A long advertised context is not a reason to fill it. The Context Compiler supplies the smallest complete typed packet.

## Current autonomy boundary

A real model may enter autonomous work only after:

1. its exact installed artefact is verified;
2. the intended backend produces valid local output;
3. load/generate/unload telemetry is stable;
4. force-stop and cancellation release the runtime correctly;
5. output is persisted and inspectable;
6. a deterministic fallback remains available.

E2B satisfies the generic LiteRT-LM path. Qwen remains behind the GenieX device gate.

## Remaining Phase 3B gates

- confirm the Maven-delivered GenieX runtime initialises on the S25 Ultra;
- verify the Qwen multi-file pack;
- run Qwen3-4B 12K thinking, memory, speed and stability tests;
- confirm supported cancellation and destruction;
- pin a stable Hugging Face revision and per-file hashes;
- compile custom GenieX E2B and EmbeddingGemma NPU variants after the shared Qualcomm path is proven;
- complete cross-family audit and the final model-selection report.

## Resource policy

- no charging requirement;
- one generative model loaded at a time;
- no independent thermal gate;
- Android/device/runtime throttling is accepted;
- Battery Saver and active workout remain Light mode and block heavy inference;
- download and inference are foreground-only during development;
- every expensive operation is cancellable or checkpointed.

## Explicit non-goals

- automatic use of generated training recommendations;
- unrestricted internet access for MAIS;
- shipping model weights inside the APK;
- committing model files to Git;
- requiring end users to install or build native runtime dependencies.
