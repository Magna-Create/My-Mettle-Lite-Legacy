# Phase 3 functional alpha — device gate

Run this gate on the target Galaxy S25 Ultra after installing the consolidated debug APK over the existing app. Do not uninstall or clear app data.

## Preconditions

- Existing training history and installed generative model files remain present.
- Gemma 4 E2B is installed and verified.
- The current Qwen stand-in may remain at its published 2K context; it represents the future 12K deep role during this gate.
- EmbeddingGemma setup contains both:
  - `embeddinggemma-300M_seq512_mixed-precision.qualcomm.sm8750.tflite`
  - `sentencepiece.model`

## 1. Upgrade persistence

1. Install the APK over the current app.
2. Open Brief, Progress, Lab and Library.
3. Confirm training history, routine, settings, models and prior MAIS state remain present.
4. Force-stop and reopen once.

Pass: no data reset, model redownload or boot loop.

## 2. Settings structure

Open **Settings → Intelligence**.

Pass when:

- Local models contains model installation, import, verification and benchmark controls.
- Research exchange contains the rolling three-request budget and import/export controls.
- Activity & diagnostics contains the Heart and Report Card controls.
- Lab contains experiments rather than runtime diagnostics.

## 3. EmbeddingGemma runtime probe

Open **Settings → Intelligence → Local models → EmbeddingGemma**.

1. Confirm both files show Ready.
2. Run the semantic retrieval probe.
3. Record:
   - runtime path;
   - accelerator claim;
   - document and query latency;
   - matching score;
   - unrelated score;
   - margin.
4. Run the probe a second time.

Pass when:

- no native crash or System UI restart occurs;
- both vectors have the expected 256 stored dimensions;
- the relevant training passage ranks above the unrelated passage;
- a failed accelerator path returns a readable error rather than crashing.

The first probe does not by itself prove NPU residency. Treat the displayed accelerator claim and Android logs as the source of truth.

## 4. Ordinary session path

Complete a normal short session that is not testing an active experiment.

Expected bounded path:

1. `session_completed` is journalled;
2. Governor runs through E2B or clean deterministic fallback;
3. ordinary integration remains on the light/standard route unless the Governor explicitly returns `deep_analysis`;
4. Analyst and Auditor artefacts persist;
5. any accepted belief appears in Progress with provenance and uncertainty;
6. no permanent routine change occurs.

Pass: the app remains responsive, only one generative model is leased at a time, and force-stop/reopen preserves the task and artefacts.

## 5. Explicit deep-analysis path

Use the Activity & diagnostics test control or a sufficiently complex real session case to produce a Governor `deep_analysis` route.

Expected expanded path:

1. Governor;
2. Analyst;
3. Coding Analyst using the current Qwen stand-in;
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

## 6. Lab experiment lifecycle

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

## 7. Research exchange

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

## 8. Functional surfaces

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

## 9. Resource and recovery behaviour

Repeat one pending task under each condition:

- Battery Saver on;
- active workout interaction;
- app backgrounded;
- force-stop during or between role steps;
- reopen after interruption.

Pass when work is deferred or checkpointed according to policy, model leases do not overlap, and the task resumes or fails cleanly without losing training data.

## 10. Report Card

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
