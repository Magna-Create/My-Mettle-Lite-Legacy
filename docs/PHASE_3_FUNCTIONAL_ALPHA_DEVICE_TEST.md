# Phase 3 functional alpha — device gate

Run this gate on the target Galaxy S25 Ultra after installing the consolidated debug APK over the existing app. Do not uninstall or clear app data.

## Preconditions

- Existing training history and installed model files remain present across the APK update.
- Settings → Intelligence → Local models lists:
  - Gemma 4 E2B IT · CPU/GPU;
  - Gemma 4 E2B IT · Qualcomm SM8750 NPU;
  - Qwen3-4B Thinking · 12K · Snapdragon 8 Elite NPU;
  - EmbeddingGemma 300M · CPU;
  - QAIRT 2.45 runtime status;
  - Qwen3-4B native NPU benchmark.
- The Qwen repository is `MagneRex/Qwen3-4B-Genie-Snapdragon-8-Elite-12K`.
- Qwen is a multi-file GenieX QAIRT bundle, not a LiteRT-LM file.
- EmbeddingGemma setup contains both:
  - `embeddinggemma-300M_seq512_mixed-precision.tflite`;
  - `sentencepiece.model`.
- The private QAIRT 2.45 Android build assets have been staged before building the APK, following `docs/PHASE_3B_QWEN_NATIVE_DEVICE_TEST.md`.

## 1. Upgrade persistence and retired-model cleanup

1. Install the APK over the current app.
2. Open Brief, Progress, Lab and Library.
3. Confirm training history, routine, settings, installed models and prior MAIS state remain present.
4. Confirm Gemma 4 E4B no longer appears in the model pack.
5. Confirm the retired Qualcomm EmbeddingGemma AOT import is no longer treated as the active retrieval model.
6. Force-stop and reopen once.

Pass: no data reset, boot loop or unnecessary redownload; retired E4B storage is reclaimed.

## 2. Settings structure

Open **Settings → Intelligence**.

Pass when:

- Local models contains model installation, retrieval, QAIRT status and benchmark controls;
- Research exchange contains the rolling three-request budget and import/export controls;
- Activity & diagnostics contains the Heart and Report Card controls;
- Lab contains experiments rather than runtime diagnostics.

## 3. Model-pack installation and integrity

### Gemma E2B generic CPU/GPU

1. Install or resume `gemma-4-E2B-it.litertlm`.
2. Confirm SHA-256 verification succeeds against:

   `ab7838cdfc8f77e54d8ca45eadceb20452d9f01e4bfade03e5dce27911b27e42`

### Gemma E2B Qualcomm SM8750 NPU

1. Install or resume `gemma-4-E2B-it_qualcomm_sm8750.litertlm`.
2. Confirm the downloaded size is approximately 3,016,294,400 bytes.
3. Confirm SHA-256 verification succeeds against:

   `41dd675fbe735b6029012b5576a5716bac614fd8156de0128db4c9dff3cebd4e`

This public LiteRT-LM NPU artefact currently fails engine creation with `TF_LITE_AUX not found` on the target phone. Record it as an upstream runtime/package incompatibility rather than retrying repeatedly. It is not the production NPU path; a custom GenieX/QAIRT E2B build follows after the Qwen native pipeline passes.

### Qwen3-4B Thinking 12K

1. Start the Qwen installation.
2. Interrupt it during one of the four large context binaries.
3. Reopen the app and resume.
4. Confirm all required bundle members finish in app-private storage, including:
   - `genie_config.json`;
   - `htp_backend_ext_config.json`;
   - `metadata.json`;
   - `part1_of_4.bin` through `part4_of_4.bin`;
   - tokenizer files.
5. Confirm the aggregate installed size is approximately 3.12 GB.
6. Confirm the pack reaches **Verified and ready** only after every member is present and individually hashed.
7. Tap **Verify 12K pack** and confirm it returns to **Verified and ready**.

The initial public repository revision uses trust-on-first-use per-file hashes. After the native device pass, publish a stable Hugging Face tag and pin every file hash in the app registry.

Pass: partial downloads resume, incomplete packs never appear ready, verification covers all 15 files and normal app interaction remains responsive.

## 4. EmbeddingGemma runtime probe

Open **Settings → Intelligence → Local models → EmbeddingGemma**.

Use:

```text
embeddinggemma-300M_seq512_mixed-precision.tflite
sentencepiece.model
```

Do not use the Qualcomm SM8750 AOT `.tflite` file with the current `localagents-rag` wrapper.

1. Confirm both files show Ready.
2. Run the semantic retrieval probe.
3. Record:
   - runtime path;
   - document and query latency;
   - matching score;
   - unrelated score;
   - margin.
4. Run the probe a second time after force-stop/reopen.

Current confirmed device result:

- matching score: `0.7881`;
- unrelated score: `0.2535`;
- margin: `0.5346`;
- document pass: `1040 ms`;
- query pass: `408 ms`.

Pass when the relevant training passage ranks above the unrelated passage, vectors use the expected 256 stored dimensions and no native crash occurs.

## 5. Gemma E2B generic backend comparison

Use the same bounded prompt, sampler settings and output limit for every run.

1. Run the generic artefact CPU baseline twice.
2. Run the generic artefact GPU baseline twice.
3. Confirm no NPU control is offered for the generic CPU/GPU file.

For every run record:

- model load time;
- first-chunk latency;
- generation time;
- unload time;
- total time;
- peak PSS;
- output validity;
- app and launcher stability.

Pass when each successful result identifies its actual backend. Retain generic E2B on CPU as the ordinary-work default until a custom GenieX NPU build is compiled and measured.

## 6. Qwen native GenieX/QAIRT runtime gate

Follow the complete setup and failure-capture procedure in:

```text
docs/PHASE_3B_QWEN_NATIVE_DEVICE_TEST.md
```

1. Confirm **QAIRT 2.45** reports **Runtime ready**.
2. Confirm the open JNI bridge is loaded.
3. Confirm the Qwen pack is verified.
4. Run **Qwen NPU baseline** once.
5. Record:
   - runtime and QAIRT version;
   - load time;
   - first callback/TTFT;
   - prompt-processing rate;
   - token-generation rate;
   - peak process memory;
   - unload time and reclaimed memory;
   - final output;
   - sustained stability.
6. Force-stop and reopen, then run once more after a clean first pass.

Pass when Qwen creates a Genie dialog, generates non-empty text through the intended Qualcomm NPU/HTP path, unloads cleanly and does not destabilise System UI. Until this passes repeatedly, deep roles continue to produce a deterministic fallback record.

## 7. Ordinary session path

Complete a normal short session that is not testing an active experiment.

Expected bounded path:

1. `session_completed` is journalled;
2. Governor runs through E2B or clean deterministic fallback;
3. ordinary integration remains on the light/standard route unless the Governor explicitly returns `deep_analysis`;
4. Analyst and Auditor artefacts persist;
5. any accepted belief appears in Progress with provenance and uncertainty;
6. no permanent routine change occurs.

Pass: the app remains responsive, only one generative model is leased at a time, and force-stop/reopen preserves the task and artefacts.

## 8. Explicit deep-analysis path

Use the Activity & diagnostics test control or a sufficiently complex real session case to produce a Governor `deep_analysis` route.

Expected expanded path:

1. Governor;
2. Analyst;
3. Coding Analyst using Qwen3-4B Thinking 12K only after the native GenieX gate passes repeatedly, otherwise a recorded deterministic fallback;
4. deterministic analysis execution against an immutable snapshot;
5. Auditor challenge;
6. Coach reversible experiment draft.

Pass when:

- Qwen is not loaded unless the deep route is explicit;
- generated analysis is a `MaisAnalysisRecipeV1`, not arbitrary executable code;
- the analysis input, programme and result persist after model unload;
- a valid Coach draft appears in Lab as a **proposed** experiment;
- the base routine remains unchanged.

A Qwen failure must produce a clean fallback record and must not crash the app or launcher.

## 9. Lab experiment lifecycle

1. Review the proposed experiment and its provenance, success criteria and stop conditions.
2. Activate it explicitly.
3. Complete the next matching session.
4. Confirm the experiment becomes ready for decision.
5. Allow the queued evaluation task to run.
6. Confirm Lab shows an inspectable recommendation: adopt, extend, reject or defer.
7. Choose either promote or keep baseline yourself.

Pass when:

- the temporary condition affects only the tested session;
- completion automatically journals `experiment_threshold_reached`;
- the recommendation does not act by itself;
- promotion creates a new routine version only after confirmation;
- rejection leaves the base routine unchanged and creates durable rejection memory.

## 10. Research exchange

When a research request exists:

1. Export it from Settings.
2. Confirm the JSON appears in `Downloads/My Mettle`.
3. Inspect that it contains the precise question, local context, desired evidence and required response envelope.
4. Import a valid cited `MaisResearchReportEnvelopeV1` test report.
5. Reject an unused request as a separate test where available.

Pass when:

- the rolling budget reports three requests per 30 days;
- every imported claim refers to a listed citation;
- the imported report is queued as `external_research_imported` and becomes retrievable local evidence;
- malformed or uncited reports are rejected without changing state.

## 11. Functional surfaces

### Brief

Confirm it shows only relevant current items: current finding, active intervention, queued deep task or pending research.

### Progress

Confirm it shows:

- belief status and calibrated confidence;
- support and counter-evidence separately;
- unresolved questions;
- reproducible analysis records;
- provenance IDs.

### Lab

Confirm it shows:

- proposed, active and ready-for-decision experiments;
- model proposal provenance;
- success and stop criteria;
- completed-experiment recommendations;
- explicit user actions only.

## 12. Resource and recovery behaviour

Repeat one pending task under each condition:

- Battery Saver on;
- active workout interaction;
- app backgrounded;
- force-stop during or between role steps;
- reopen after interruption.

Pass when work is deferred or checkpointed according to policy, model leases do not overlap, and the task resumes or fails cleanly without losing training data.

## 13. Report Card

Export a Report Card after the tests.

Confirm it includes:

- events, tasks, episodes and checkpoints;
- model leases and measured runtime data;
- semantic manifests and retrieval diagnostics;
- beliefs, evidence, unresolved questions and rejection memory;
- analysis inputs, programmes and runs;
- memories, Lab proposals and experiment recommendations;
- research requests/reports;
- no hidden reasoning or chain-of-thought fields.

## Stop conditions

Stop testing and capture `logcat` if any run causes:

- app process death without a clean error;
- launcher or System UI restart;
- repeated native runtime crash;
- training database loss;
- overlapping generative model loads;
- a proposal changing the base routine without explicit approval.
