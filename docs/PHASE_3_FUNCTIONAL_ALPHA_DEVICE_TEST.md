# Phase 3 functional alpha — device gate

Run this gate on the target Galaxy S25 Ultra after installing the consolidated debug APK over the existing app. Do not uninstall or clear app data.

## Preconditions

- Existing training history and installed model files remain present across the APK update.
- Settings → Intelligence → Local models lists:
  - Gemma 4 E2B IT · CPU/GPU;
  - Gemma 4 E2B IT · Qualcomm SM8750 NPU compatibility artefact;
  - Qwen3-4B Thinking · 12K · Snapdragon 8 Elite NPU;
  - EmbeddingGemma 300M · CPU;
  - Qwen3-4B GenieX benchmark.
- The Qwen repository is `MagneRex/Qwen3-4B-Genie-Snapdragon-8-Elite-12K`.
- GenieX Android is bundled through Gradle/Maven Central; no external QAIRT runtime setup is required.
- EmbeddingGemma setup contains:
  - `embeddinggemma-300M_seq512_mixed-precision.tflite`;
  - `sentencepiece.model`.

## 1. Upgrade persistence and retired-model cleanup

1. Install the APK over the current app.
2. Open Brief, Progress, Lab and Library.
3. Confirm training history, routine, settings, installed models and prior MAIS state remain present.
4. Confirm Gemma 4 E4B no longer appears in the model pack.
5. Confirm the retired Qualcomm EmbeddingGemma AOT import is no longer treated as active.
6. Force-stop and reopen once.

Pass: no data reset, boot loop or unnecessary model redownload.

## 2. Settings structure

Open **Settings → Intelligence**.

Pass when:

- Local models contains model installation, retrieval and benchmark controls;
- no private QAIRT ZIP/import panel exists;
- Research exchange contains the rolling three-request budget and import/export controls;
- Activity & diagnostics contains the Heart and Report Card controls;
- Lab contains experiments rather than runtime diagnostics.

## 3. Model-pack installation and integrity

### Gemma E2B generic CPU/GPU

1. Install or reuse `gemma-4-E2B-it.litertlm`.
2. Confirm SHA-256 verification succeeds against:

   `ab7838cdfc8f77e54d8ca45eadceb20452d9f01e4bfade03e5dce27911b27e42`

### Gemma E2B Qualcomm SM8750

The public LiteRT-LM NPU artefact currently fails engine creation with `TF_LITE_AUX not found` on the target phone. Record this as an upstream package/runtime incompatibility and do not retry repeatedly. A custom E2B GenieX build follows after Qwen proves the shared Qualcomm path.

### Qwen3-4B Thinking 12K

1. Start or resume the Qwen installation.
2. Confirm all 15 required members finish in app-private storage, including the four context binaries, configuration and tokenizer files.
3. Confirm incomplete packs never report Ready.
4. Confirm aggregate size is approximately 3.12 GB.
5. Tap **Verify 12K pack** and confirm it returns to **Verified and ready**.

Pass: partial downloads resume, verification covers every member and normal app interaction remains responsive.

## 4. EmbeddingGemma runtime probe

Use:

```text
embeddinggemma-300M_seq512_mixed-precision.tflite
sentencepiece.model
```

Do not use the Qualcomm SM8750 AOT `.tflite` file with the current `localagents-rag` wrapper.

1. Confirm both files show Ready.
2. Run the semantic retrieval probe.
3. Record document/query latency and ranking scores.
4. Run again after force-stop/reopen.

Current confirmed result:

- matching score: `0.7881`;
- unrelated score: `0.2535`;
- margin: `0.5346`;
- document pass: `1040 ms`;
- query pass: `408 ms`.

## 5. Gemma E2B generic comparison

1. Run the generic CPU baseline twice.
2. Run the generic GPU baseline twice.
3. Confirm no NPU control is offered for the generic file.
4. Record load, first chunk, generation, unload, total time, peak PSS and output validity.

Retain CPU as the ordinary-work default until the custom GenieX E2B build is measured.

## 6. Qwen GenieX Android runtime gate

Follow:

```text
docs/PHASE_3B_QWEN_NATIVE_DEVICE_TEST.md
```

1. Confirm Runtime delivery reports **Bundled with app**.
2. Confirm GenieX Android reports `0.3.5` and the QAIRT plugin is available.
3. Confirm the Qwen pack is verified.
4. Confirm Thinking mode is enabled.
5. Run **Qwen thinking baseline** once.
6. Record runtime version, load time, TTFT, prompt/decode rate, token counts, peak PSS, unload time, final output and stop reason.
7. Test **Stop Qwen run** once during a separate run.
8. Force-stop/reopen and run once more after a clean first pass.

Pass when Qwen loads through the Maven-delivered GenieX runtime, thinks, generates non-empty final text on NPU, supports clean cancellation, destroys the wrapper and does not destabilise System UI.

## 7. Ordinary session path

Complete a normal short session that is not testing an active experiment.

Expected bounded path:

1. `session_completed` is journalled;
2. Governor runs through E2B or clean deterministic fallback;
3. ordinary integration remains light/standard unless the Governor explicitly requests deep analysis;
4. Analyst and Auditor artefacts persist;
5. accepted beliefs appear with provenance and uncertainty;
6. no permanent routine change occurs.

## 8. Explicit deep-analysis path

After the Qwen device gate passes repeatedly, trigger a deep-analysis route.

Pass when:

- Qwen is loaded only for an explicit deep route;
- generated analysis is a validated `MaisAnalysisRecipeV1`, not arbitrary executable code;
- the analysis input, programme and result persist after unload;
- Coach output remains a proposed reversible experiment;
- the base routine remains unchanged without explicit approval.

Until the gate passes, Qwen failures must produce a clean deterministic fallback record.

## 9. Lab experiment lifecycle

1. Review the proposed experiment and provenance.
2. Activate it explicitly.
3. Complete the next matching session.
4. Confirm evaluation becomes ready.
5. Review adopt, extend, reject or defer.
6. Apply a decision explicitly.

Pass: recommendations never mutate the base routine by themselves.

## 10. Research exchange

1. Export a research request.
2. Confirm JSON appears in `Downloads/My Mettle`.
3. Import a valid cited `MaisResearchReportEnvelopeV1`.
4. Reject a malformed or uncited report.

Pass: rolling allowance is three requests per 30 days and imported evidence remains traceable to citations.

## 11. Resource and recovery behaviour

Repeat a pending task with Battery Saver on, during an active workout, after backgrounding and after force-stop/reopen.

Pass: work is deferred or checkpointed, model leases do not overlap and training data remains intact.

## 12. Report Card

Confirm the export contains events, tasks, model leases, runtime telemetry, semantic retrieval diagnostics, beliefs/evidence, analysis records, experiments and research artefacts—without hidden reasoning fields.

## Stop conditions

Stop testing and capture `logcat` if any run causes:

- app process death without a clean error;
- launcher or System UI restart;
- repeated native runtime crash;
- training database loss;
- overlapping generative model loads;
- a proposal changing the base routine without explicit approval.
