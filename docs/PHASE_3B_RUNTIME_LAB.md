# Phase 3B — MAIS Model and Runtime Laboratory

Status: active runtime evaluation.

Phase 3A proved the Heart, Workbench, persistence, capability protocol, model leases and resource governor with deterministic model-role simulators. Phase 3B replaces those simulated boundaries incrementally with measured Android runtimes and real local models.

## Accepted first path

The first production candidate is **Gemma 4 E2B IT** through **LiteRT-LM 0.14.0**.

Reasons:

- official mobile `.litertlm` artefact;
- current Android Kotlin SDK and Gradle package;
- explicit `Engine` initialise/close lifecycle;
- CPU, GPU and NPU backend support;
- native function calling and reasoning support;
- small enough to establish the complete lifecycle before E4B and Qwen3-8B.

ExecuTorch remains the comparison runtime for Qwen3-8B. It is not added until the LiteRT-LM lifecycle is proven.

## Artefact policy

Model weights never enter Git, the APK or JavaScript state.

Each model lives in app-private Android data and is identified by a repository manifest containing:

- stable artefact and model IDs;
- source repository and revision;
- download URL;
- filename and format;
- expected SHA-256;
- licence;
- runtime and version;
- backend candidates;
- expected size.

Normal signed APK updates preserve installed model data. Uninstalling the app or using Android **Clear data** removes models. **Clear cache** does not.

## 3B.1 — Verified installation

The first artefact is the official LiteRT Community Gemma 4 E2B IT package:

- model: `google.gemma-4-e2b-it`;
- runtime: LiteRT-LM 0.14.0;
- file: `gemma-4-E2B-it.litertlm`;
- expected SHA-256: `181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c`;
- licence: Apache-2.0.

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

The target-device pass confirmed interrupted-network recovery, retained partial bytes, resumed transfer, full verification and persistence after force-stop and cache clearing.

## 3B.2 — Real inference baseline

The app pins:

- LiteRT-LM Android 0.14.0;
- Kotlin Gradle plugin 2.2.20;
- kotlinx-coroutines 1.11.0.

The first runtime gate is deliberately manual. The verified Gemma file can be run through CPU or GPU without granting the model autonomous Heart work.

Each baseline performs:

```text
verify installed artefact
→ create LiteRT-LM Engine
→ initialise selected backend
→ create bounded conversation
→ run one fixed local prompt
→ collect output
→ close conversation
→ close engine
→ persist result
```

The result records:

- runtime/backend;
- start/completion timestamps;
- load time;
- first response-chunk latency;
- generation time;
- unload time;
- total time;
- process PSS before, peak and after;
- generated output;
- cancellation or failure.

Only one baseline may run at once. Results persist in app-private data and survive process death. The GPU path declares optional OpenCL/VNDK libraries; clean GPU failure is acceptable during evaluation and does not invalidate a working CPU path.

Initial later benchmark contexts remain:

- 2K ordinary Governor packet;
- 4K Analyst packet;
- 8K high-value analysis packet.

Those broader packets begin only after the fixed baseline proves load/generate/unload reliability.

## Report Card export

The previous browser-Blob export was ignored by Android WebView. Android now writes Report Cards natively through MediaStore into:

```text
Downloads/My Mettle
```

The UI confirms the exact filename and location after writing.

## Current autonomy boundary

The MAIS Heart still uses the deterministic Phase 3A role runner. This is intentional.

A real model may enter autonomous work only after:

1. at least one backend produces valid local output;
2. load/generate/unload telemetry is stable;
3. force-stop and cancellation release the engine correctly;
4. output is persisted and inspectable;
5. a deterministic fallback remains available.

## Later Phase 3B gates

- route one bounded Heart role through the selected real backend;
- Gemma 4 E4B general reasoning and audit comparison;
- EmbeddingGemma retrieval integration;
- Qwen3-8B through LiteRT-LM and ExecuTorch;
- cross-family audit tests;
- tool-call reliability;
- capability proposal generation;
- generated-analysis programme generation;
- final model-selection report.

## Resource policy

- no charging requirement;
- one generative model loaded at a time;
- no independent thermal gate;
- Android/device/runtime throttling is accepted;
- Battery Saver and active workout remain Light mode and block heavy inference;
- download and inference are foreground-only during this development phase;
- every expensive operation is cancellable or checkpointed.

## Explicit non-goals

- polished model-management UI;
- background model downloads after the app process is killed;
- automatic use of generated training recommendations;
- unrestricted internet access for MAIS;
- shipping multiple model weights inside the APK;
- committing model files to Git.
