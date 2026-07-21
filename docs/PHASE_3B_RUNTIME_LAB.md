# Phase 3B — Real Model and Runtime Laboratory

Status: active development.

Phase 3B replaces the Phase 3A simulated runtime with measured on-device inference. It does not yet make model conclusions authoritative. Its purpose is to prove model artefact management, runtime lifecycle, structured generation, interruption recovery and device telemetry on the target Android phone.

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

## Official first artefact

- Model ID: `google.gemma-4-e2b-it`
- Repository: `litert-community/gemma-4-E2B-it-litert-lm`
- File: `gemma-4-E2B-it.litertlm`
- Format: `.litertlm`
- Approximate size: 2.59 GB
- SHA-256: `181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c`
- Licence: Apache-2.0

The source repository does not store this file. Android downloads it directly into app-private storage and validates the complete SHA-256 before the model can be selected.

## Phase 3B.1 — Artefact installation gate

Deliver:

1. app-private `mais-models` directory;
2. resumable foreground download;
3. free-space check;
4. partial-file recovery;
5. download progress events;
6. cancellation;
7. SHA-256 verification;
8. atomic promotion from `.part` to the final filename;
9. verified sidecar metadata;
10. delete/reinstall;
11. no model bytes crossing the Capacitor JavaScript bridge;
12. simple Runtime Lab panel in Lab.

Exit test:

- download begins from the official source;
- progress survives ordinary UI navigation;
- cancellation leaves a resumable partial file;
- completion validates the expected hash;
- force-close/reopen reports the installed model correctly;
- delete removes final, partial and verification files;
- APK and Git repository remain small.

## Phase 3B.2 — LiteRT-LM inference gate

Deliver:

1. pinned `litertlm-android` dependency;
2. Kotlin native runtime adapter;
3. CPU baseline first;
4. GPU path with required native-library declarations;
5. model load and explicit close;
6. one-shot conversation per MAIS role episode;
7. deterministic benchmark prompts;
8. structured result validation;
9. load time, first-token time, total generation time and output length;
10. process interruption recovery;
11. lease telemetry written into the MAIS Report Card.

Initial benchmark contexts:

- 2K ordinary Governor packet;
- 4K Analyst packet;
- 8K high-value analysis packet.

Initial output budgets:

- 128 tokens for Governor routing;
- 256 tokens for ordinary analysis;
- 512 tokens for structured investigation planning.

## Later Phase 3B gates

- Gemma 4 E4B general reasoning and audit comparison;
- EmbeddingGemma retrieval integration;
- Qwen3-8B through LiteRT-LM and ExecuTorch;
- cross-family audit tests;
- tool-call reliability;
- capability proposal generation;
- generated-analysis programme generation;
- model selection report.

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
