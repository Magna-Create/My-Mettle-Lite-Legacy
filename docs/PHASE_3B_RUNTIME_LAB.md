# Phase 3B — MAIS Model and Runtime Laboratory

Status: active runtime evaluation.

Phase 3A proved the Heart, Workbench, persistence, capability protocol, model leases and resource governor with deterministic model-role simulators. Phase 3B replaces those simulated boundaries incrementally with measured Android runtimes and real local models.

## Accepted runtime paths

### Everyday model — Gemma 4 E2B IT

E2B remains the first active production language model through LiteRT-LM 0.14.0.

Two separately installable artefacts represent the same logical model:

- `gemma-4-E2B-it.litertlm` — generic CPU/GPU build;
- `gemma-4-E2B-it_qualcomm_sm8750.litertlm` — Qualcomm NPU build for Snapdragon 8 Elite.

Reasons:

- published mobile `.litertlm` artefacts;
- current Android Kotlin SDK and Gradle package;
- explicit `Engine` initialise/close lifecycle;
- controlled CPU, GPU and NPU comparison;
- native function-calling and reasoning support;
- small enough for frequent bounded foreground work.

The generic artefact on CPU remains the production default until repeated device results justify switching to the hardware-specific NPU build.

### Deep model — Qwen3-4B Thinking 12K

The deep model is a custom W4A16 GenieX QAIRT bundle hosted at:

```text
MagneRex/Qwen3-4B-Genie-Snapdragon-8-Elite-12K
```

It was compiled for Snapdragon 8 Elite for Galaxy with:

- QAIRT `2.45.0.260326154327`;
- 12,288-token context;
- sequence lengths 128 / 1;
- Qualcomm NPU/HTP execution target.

Qwen is not a LiteRT-LM file. Its install lifecycle is implemented separately from its native GenieX execution adapter.

Gemma 4 E4B and Qwen3-8B are retired from the active model laboratory.

## Artefact policy

Model weights never enter Git, the APK or JavaScript state.

Each model lives in app-private Android data and is identified by a repository manifest containing:

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

The upgrade that removes E4B deletes its final file, partial file and verification sidecar without touching the training database.

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

The generic E2B file is pinned to:

```text
ab7838cdfc8f77e54d8ca45eadceb20452d9f01e4bfade03e5dce27911b27e42
```

The Qualcomm SM8750 E2B file is pinned to:

```text
41dd675fbe735b6029012b5576a5716bac614fd8156de0128db4c9dff3cebd4e
```

### Multi-file Qwen pack

The TypeScript model-pack layer composes the existing single-file native downloader into a sequential resumable bundle installer.

The logical pack contains:

- four compiled context binaries;
- `genie_config.json`;
- HTP backend configuration;
- model metadata;
- tokenizer files;
- sample prompt.

The pack reports Ready only when every required member is installed and verified. Cancellation retains the active member's partial bytes. Delete removes every final, partial and verification file.

The first public revision uses trust on first use per member. A validated Hugging Face tag and declared per-file hashes are required before the release is considered final.

## Real E2B inference baseline

The app pins:

- LiteRT-LM Android 0.14.0;
- Kotlin Gradle plugin 2.2.20;
- kotlinx-coroutines 1.11.0.

Each E2B baseline performs:

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

Only one baseline may run at once. Results persist in app-private data and survive process death.

The valid comparison matrix is:

1. generic E2B / CPU;
2. generic E2B / GPU;
3. Qualcomm SM8750 E2B / NPU.

The NPU path declares optional OpenCL/VNDK libraries, requests `Backend.NPU` directly and does not silently fall back.

## Qwen GenieX execution gate

Installing the Qwen pack does not claim that it can already execute through the LiteRT-LM engine.

The pending native adapter must:

1. load the exported GenieX QAIRT bundle;
2. use the matching QAIRT runtime libraries;
3. preserve the exclusive model lease;
4. stream output with cancellation;
5. expose load, prefill, first-token, decode and unload telemetry;
6. separate any model thinking channel from the structured final MAIS artefact;
7. close every native handle on cancellation, failure and process teardown;
8. fail cleanly without CPU/GPU fallback when the NPU path is unavailable.

Until this adapter passes, deep episodes use the deterministic fallback and record Qwen as the intended model.

## Context gates

Initial benchmark contexts are:

- 2K ordinary Governor packet;
- 4K standard E2B packet;
- 8K high-value Qwen packet;
- 12,288-token Qwen ceiling for justified deep work.

A long advertised context is not a reason to fill it. The Context Compiler should supply the smallest complete typed packet.

## Report Card export

Android writes Report Cards natively through MediaStore into:

```text
Downloads/My Mettle
```

The UI confirms the exact filename and location after writing.

## Current autonomy boundary

A real model may enter autonomous work only after:

1. its exact installed artefact is verified;
2. at least one intended backend produces valid local output;
3. load/generate/unload telemetry is stable;
4. force-stop and cancellation release the runtime correctly;
5. output is persisted and inspectable;
6. a deterministic fallback remains available.

E2B satisfies the implemented LiteRT-LM execution path. Qwen remains behind the separate GenieX device gate.

## Remaining Phase 3B gates

- benchmark generic E2B on CPU/GPU;
- benchmark the SM8750 E2B build on NPU;
- confirm no silent NPU fallback;
- install/resume/delete/reinstall the Qwen multi-file pack;
- integrate matching GenieX QAIRT Android execution;
- run Qwen3-4B 12K memory, speed and stability tests;
- pin a stable Hugging Face revision and per-file hashes;
- complete cross-family audit and tool-call reliability tests;
- complete the final model-selection report.

## Resource policy

- no charging requirement;
- one generative model loaded at a time;
- no independent thermal gate;
- Android/device/runtime throttling is accepted;
- Battery Saver and active workout remain Light mode and block heavy inference;
- download and inference are foreground-only during this development phase;
- every expensive operation is cancellable or checkpointed.

## Explicit non-goals

- polished final model-management UI;
- background model downloads after the app process is killed;
- automatic use of generated training recommendations;
- unrestricted internet access for MAIS;
- shipping model weights inside the APK;
- committing model files to Git.
