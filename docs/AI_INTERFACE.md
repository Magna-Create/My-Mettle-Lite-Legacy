# My Mettle — AI Interface Contract

Status: Phase 2 data contract for later on-device and Lab inference.

This document defines how future AI components should interpret user-authored training data. It is intentionally separate from UI copy so model behaviour does not depend on reverse-engineering visible labels.

## Evidence hierarchy

My Mettle keeps three evidence classes distinct:

1. **Objective session evidence** — completed sets, load, repetitions, duration, distance, timestamps, rest and exercise completion.
2. **Structured subjective evidence** — exercise reflection fields recorded once per exercise per session.
3. **Free-text context** — the optional session-exercise reflection note.

A single subjective answer must not directly rewrite a routine. Suggestions should be derived from repeated patterns combined with objective session evidence and should remain reviewable in Lab.

## Target muscle engagement

Stored field: `ExerciseReflection.targetMuscleEngagement`

Allowed values: integer `0–7`, or the explicit string `"unsure"`.

Semantic anchors:

- `0` — broad: effort felt diffuse rather than concentrated in the intended target.
- `5` — neutral: acceptable/ordinary target engagement without a strong broad or concentrated signal.
- `7` — concentrated: effort felt highly focused in the intended target muscle or region.
- `"unsure"` — the user could not judge the sensation. Do not convert this into a numerical midpoint.

Intermediate values represent the user's ordinal position between those anchors. Treat the scale as ordinal evidence, not a precise physiological measurement. Do not assume equal physiological distance between adjacent values.

## Enjoyment

Stored field: `ExerciseReflection.enjoyment`

Allowed values: integer `1–7`, or `"unsure"`.

Semantic anchors:

- `1` — hate.
- `4` — neutral.
- `7` — love.
- `"unsure"` — no reliable judgement; never impute `4`.

Enjoyment is adherence and experience evidence. It is not evidence that an exercise is mechanically effective or ineffective by itself.

## Form and execution

Stored field: `ExerciseReflection.execution`

- `clean` — the user judged execution as clean.
- `mixed` — some sets or repetitions were clean and some were not.
- `poor` — execution was broadly poor.
- `unsure` — the user could not judge.

Combine this with objective set performance before suggesting progression. For example, completed target repetitions plus repeatedly poor execution should not be treated the same as clean completion.

## Comfort

Stored field: `ExerciseReflection.comfort`

- `good`
- `fine`
- `unsure`
- `uncomfortable`
- `pain`

`pain` is a user-reported state, not a diagnosis. Future systems should surface it clearly and avoid automatic progression, but must not infer an injury or provide medical conclusions from the label alone.

## Optional reflection note

Stored field: `ExerciseReflection.note`

- May be absent or empty.
- Maximum stored length: 2,000 characters.
- Belongs to one exercise exposure in one session.
- May contain setup, sensation, context, substitutions or temporary circumstances.

An on-device model may read this field later. Any extracted claim should retain provenance to the source session and should not silently become permanent exercise memory.

## Exercise memory

Shared exercise-level memory currently includes:

- category;
- equipment;
- target muscles;
- fatigue cost;
- skill difficulty;
- cues;
- common mistakes;
- setup notes;
- machine/equipment settings;
- substitutions;
- optional video reference URL.

`setupNotes` and `videoReferenceUrl` are editable from Additional Details during a workout and save back to the shared exercise record when the sheet closes.

The former `personalNotes` exercise-memory field is retired. Session-specific thoughts belong in the reflection note, preventing temporary experience from being mistaken for permanent exercise setup.

## Inference constraints

Future AI or Lab logic should:

- preserve `unsure` as missing/uncertain evidence rather than a midpoint;
- distinguish session snapshots from current exercise memory;
- use trends across multiple exposures where possible;
- expose the evidence behind a suggestion;
- avoid automatic permanent routine changes from one reflection;
- treat free text as unverified user context;
- retain timestamps and source session IDs when deriving summaries.
