# My Mettle — Phase 3 Health Evidence and Analysis Laboratory

_Last updated: 24 July 2026_

## Scope and boundaries

This package extends Phase 3 without changing local-model artefacts, installers, inference runtimes or model SDK integration.

It adds:

- a read-only Android Health Connect bridge;
- Samsung Health provenance detection through Health Connect data origins;
- local health-evidence persistence separate from the training database and MAIS state;
- deterministic session and set heart-rate features;
- manual body-composition history;
- Health Connect settings and sync controls;
- a substantially expanded deterministic analysis recipe language;
- an uncapped analysis-tool request exchange with rolling 90-day retention;
- a formal but disabled restricted-Python fallback contract;
- context-size benchmark utilities for 48, 96, 160 and 256 analytical rows;
- migration of external research allowance to three requests per rolling 30 days.

The model topology remains untouched by this package.

## Health integration architecture

### Primary integration: Health Connect

My Mettle is a read-only Health Connect client. It declares no health write permissions.

The Android bridge exposes three permission groups:

1. **Core training signal**
   - heart rate;
   - steps;
   - distance;
   - exercise sessions for cross-checking only.
2. **Context**
   - body-fat percentage;
   - basal metabolic rate;
   - nutrition.
3. **Supplementary**
   - oxygen saturation;
   - blood glucose;
   - VO₂ max.

Core access is required for workout physiology. Context and supplementary permissions are separately requested and optional.

### Samsung Health relationship

Samsung Health writes supported records into Health Connect. Health Connect records retain a `dataOrigin.packageName`; Samsung Health records are identified as:

`com.sec.android.app.shealth`

My Mettle preserves that origin and the available device metadata on every imported observation.

The direct Samsung Health Data SDK is not bundled in this pass. Its production distribution requires Samsung's separately downloaded SDK artefact and application-signature registration. A future direct adapter may add Samsung-only types, but it is not required for heart rate, steps, distance, BMR, body fat, nutrition, oxygen saturation, blood glucose or VO₂ max when those records are already available through Health Connect.

### Sync windows

The functional settings surface synchronises up to twelve recent completed My Mettle sessions.

Each query uses:

- five minutes before `session.startedAt`;
- the complete session interval;
- five minutes after `session.completedAt`.

This allows:

- a short pre-session baseline;
- app-owned exercise and set anchors;
- post-set and post-session recovery observations;
- delayed Samsung Health synchronisation to be retried without modifying the original session.

Health Connect reads are deduplicated using stable My Mettle evidence IDs derived from source record and sample IDs.

## Health persistence

Health evidence uses its own IndexedDB database:

- database: `my-mettle-health-evidence`;
- store: `health-state`;
- key: `primary`.

Stored state includes:

- normalised raw observations;
- manual body-composition readings;
- deterministic session health summaries;
- deterministic set heart-rate summaries;
- last sync and error state.

This separation preserves the established rule that raw training state, health evidence and intelligence state have independent lifecycle controls.

## Manual body composition

The settings interface accepts timestamped entries for:

- body-fat percentage;
- BMR;
- skeletal muscle mass;
- lean mass;
- visceral-fat rating;
- optional body weight;
- source/method;
- source label;
- measurement conditions or note.

Manual readings are not overwritten by Samsung or Health Connect records. Device/method provenance is retained so later trend analysis can compare like with like.

## Heart-rate feature engine

### Source of truth

My Mettle interaction timestamps remain authoritative:

- session start and completion;
- exercise start and completion;
- set completion;
- completion order.

Heart-rate data is a probabilistic refinement layer. It never silently rewrites logged timestamps.

### Current deterministic outputs

For every linked session:

- sample count and coverage;
- average, median and peak heart rate;
- steps and distance observed in the queried window;
- linked set-response evidence.

For every completed set with sufficient samples:

- logged completion time;
- inferred start time;
- estimated duration;
- baseline heart rate;
- peak heart rate;
- rise magnitude;
- rise/time-to-peak;
- recovery at 30, 60 and 90 seconds;
- area above baseline;
- sample count and coverage;
- inference confidence;
- assumptions;
- source references;
- algorithm ID and version.

Current algorithm identity:

- `mais.health.hr-set-response`;
- version `1`.

The first version uses a bounded, smoothed sustained-rise heuristic and an explicit eight-second provisional response-lag assumption. This is deliberately inspectable and replaceable. Future versions may learn a user/exercise-specific lag while preserving previous derived evidence for replay.

## MAIS evidence integration

The training-evidence provider now includes:

- linked session health summaries;
- set-response summaries;
- recent manual body-composition evidence;
- all associated provenance references.

Coding Analyst input is now a multisource immutable snapshot containing record kinds such as:

- `comparable_exposure`;
- `health_session`;
- `heart_rate_set_response`;
- `manual_body_composition`.

The input builder balances health and training rows within the caller's current record allowance. Host-side analysis remains capped at 5,000 immutable records.

## Analysis Recipe V2

`MaisAnalysisRecipeV2` is a declarative pipeline. It contains up to 64 named steps. Steps may consume the immutable input table or a table created by an earlier step.

No step executes JavaScript, Python or model-generated expressions.

### Table preparation

- filter;
- sort;
- limit;
- select;
- derive difference;
- derive ratio;
- derive percentage change;
- derive elapsed seconds;
- lag;
- rolling mean;
- rolling median.

The current multisource input is already joined through stable session, exercise and set identifiers. General arbitrary table joins remain a future operation-family addition after concrete use cases establish the required semantics.

### Descriptive and robust statistics

- count;
- sum;
- mean;
- weighted mean;
- median;
- minimum and maximum;
- variance;
- standard deviation;
- quantiles;
- interquartile range;
- median absolute deviation;
- trimmed mean;
- winsorised mean;
- coefficient of variation;
- skewness;
- excess kurtosis.

### Relationships and models

- covariance;
- Pearson correlation;
- Spearman rank correlation;
- correlation matrix;
- ordinary linear regression;
- Theil–Sen robust regression;
- paired differences;
- Cohen's d;
- grouped statistics.

### Uncertainty

- deterministic-seed bootstrap mean confidence intervals.

### Data quality

- missingness;
- coverage;
- duplicate counts.

### Time series and signals

- slope;
- trapezoidal area under curve;
- time above a threshold;
- first threshold crossing;
- peak detection;
- autocorrelation;
- bounded-lag cross-correlation;
- simple bounded change-point candidates.

V1 recipes continue to run through the original deterministic sandbox unchanged.

## Tool suggestions and ChatGPT exchange

The Research Exchange now contains a separate **Request a tool** area.

Tool requests:

- have no monthly cap;
- are grouped by creation month;
- remain local;
- are pruned automatically after 90 days;
- may be created manually;
- may be proposed by the Coding Analyst through an optional typed `toolSuggestion` object;
- can be copied as a `MaisToolRequestEnvelopeV1` for ChatGPT.

Each request records:

- exact analytical question;
- missing capability;
- why current tools are insufficient;
- input fields;
- desired outputs;
- proposed method;
- assumptions;
- minimum evidence;
- required synthetic tests;
- concrete My Mettle use;
- preference for a permanent built-in, restricted Python or either;
- provenance and expiry.

A suggestion does not install code or grant authority. It is an inspectable request for later implementation.

## Restricted Python fallback

A formal `MaisRestrictedPythonProgrammeV1` contract now exists, but execution is intentionally disabled.

The contract requires:

- a stated question and capability gap;
- an immutable input snapshot ID;
- declared input and output fields;
- assumptions and missing-data policy;
- minimum record count;
- deterministic random seed;
- at least two synthetic tests;
- strict CPU, memory and output limits;
- an allow-listed module set.

Prohibited categories include:

- network access;
- filesystem and process access;
- Android or Capacitor access;
- dynamic code loading;
- native interfaces;
- unsafe serialisation;
- unbounded concurrency.

The declared candidate modules are:

- `math`;
- `statistics`;
- `numpy`;
- `pandas`;
- `scipy.stats`;
- `scipy.signal`.

This contract is architecture and validation scaffolding only. Enabling Python on Android requires a separately reviewed runtime, package-size and memory evaluation, synthetic-test runner and process-isolation strategy.

## Context-size evaluation

A host-side benchmark utility generates comparable packet measurements at:

- 48 rows;
- 96 rows;
- 160 rows;
- 256 rows.

It records:

- included and omitted rows;
- character count;
- estimated token count;
- field count;
- record kinds;
- largest row size.

This allows the Qwen 12K workstream to test richer analytical packets later without changing the model runtime in this implementation branch.

Raw heart-rate samples should not normally be inserted directly into the model context. The host should retain the full signal and supply schemas, quality summaries, representative rows and deterministic results.

## Research budget migration

Persisted MAIS snapshots are normalised to:

- three external research requests;
- rolling 30-day window;
- no obsolete seven-day cooldown.

The settings count uses the same fixed three-request policy, so an old saved `2/2` value cannot remain visible after load.

## Validation requirements

### Automated

- V1 analysis compatibility;
- V2 composition and robust statistics;
- deterministic bootstrap and signal operations;
- health-set alignment;
- Samsung provenance retention;
- health observation deduplication;
- uncapped tool-request creation;
- 90-day request pruning;
- research allowance migration;
- Python contract safety validation;
- context-size benchmark output;
- production TypeScript build;
- Android debug APK build.

### Target device

1. Open `Settings → Intelligence → Health evidence`.
2. Confirm Health Connect reports available.
3. Enable Training signal permissions.
4. Optionally enable Body & nutrition context.
5. Leave Supplementary disabled initially.
6. Open Health Connect settings and confirm My Mettle has read permissions only.
7. Ensure Samsung Health has synchronised recent watch data into Health Connect.
8. Run **Sync recent workouts**.
9. Confirm Samsung-origin record count is non-zero.
10. Confirm recent My Mettle sessions show linked HR samples and set estimates.
11. Force-stop and reopen; confirm health state persists.
12. Repeat sync; confirm record counts do not duplicate.
13. Add a gym BIA reading and confirm it remains separate from imported data.
14. Create and copy a tool request; confirm the envelope can be pasted into ChatGPT.
15. Change the device date only in a test environment or use fixtures to verify 90-day pruning.
16. Run a deep analysis after model-runtime validation and confirm V2 programme, immutable input and deterministic run are stored separately.

## Known limitations

- The direct Samsung Health Data SDK is not bundled.
- Health synchronisation is user-triggered in the initial UI; delayed Samsung data requires a later repeat sync.
- Heart-rate onset inference is heuristic and explicitly uncertain.
- Raw heart-rate resampling and motion-artifact classification are not yet separate reusable operations.
- General arbitrary table joins and mixed-effects models are not yet part of Recipe V2.
- Restricted Python execution is disabled.
- Qwen analytical record-count changes remain part of the separate model/runtime validation workstream.
