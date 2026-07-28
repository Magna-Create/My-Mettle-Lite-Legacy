# My Mettle Routine Pack v1

My Mettle Lite can replace its current routine from a versioned JSON document. The import is intended for routines assembled externally — including routines generated with ChatGPT — without manually creating every exercise and day inside the app.

## Safety model

- Import is **replace-only** in v1.
- Existing workouts, measurements and immutable routine versions are preserved.
- Exercises absent from the imported routine are archived rather than deleted.
- A new routine version is created in one operation.
- The app downloads a full safety backup before applying the replacement.
- Import is blocked while a workout is active.

## Top-level shape

```json
{
  "format": "my-mettle-routine-pack",
  "version": 1,
  "name": "Return to training",
  "exercises": [],
  "days": []
}
```

`format` and `version` are mandatory. `name` is shown in the import preview and routine history.

## Exercises

Every exercise has a stable pack-local `key`. Routine slots refer to this key, so names may later change without breaking the pack structure.

```json
{
  "key": "incline-dumbbell-press",
  "name": "Incline dumbbell press",
  "tracking": {
    "metric": "load_reps",
    "loadRelationship": "external",
    "entryBasis": "per_hand"
  },
  "progressionStep": 1,
  "memory": {
    "category": "Press",
    "equipment": "Dumbbells and adjustable bench",
    "targetMuscles": ["Upper chest", "Front delts", "Triceps"],
    "fatigueCost": 3,
    "skillDifficulty": 3,
    "cues": ["Set the shoulder blades before pressing."],
    "commonMistakes": ["Losing the upper-back shelf."],
    "setupNotes": "Bench at 30 degrees.",
    "videoReferenceUrl": "",
    "machineSettings": "Record the bench angle used.",
    "substitutions": ["Incline machine press"]
  }
}
```

### Tracking values

`metric`:

- `load_reps`
- `reps`
- `duration`
- `distance`

`loadRelationship`:

- `external`
- `assistance`
- `bodyweight`
- `bodyweight_plus_external`
- `none`

`entryBasis`:

- `total`
- `per_hand`
- `per_side`

When `tracking` is omitted, Lite defaults to external load and repetitions entered as a total.

`progressionStep` must be greater than zero. Exercise-memory fields are optional; missing fields receive safe empty defaults.

## Days and slots

Supported days are `ψ`, `φ`, `π` and `&`. Missing days are added as empty days during validation. `&` is the optional fourth day and remains locked until all three core days have been completed.

```json
{
  "symbol": "ψ",
  "slots": [
    {
      "exerciseKey": "incline-dumbbell-press",
      "importance": "principal",
      "plannedLoad": 18,
      "lockedToDay": true,
      "prescriptions": {
        "A": {
          "included": true,
          "sets": 3,
          "repMin": 6,
          "repMax": 8,
          "restSeconds": 150
        },
        "B": {
          "included": true,
          "sets": 2,
          "repMin": 6,
          "repMax": 8,
          "restSeconds": 150
        },
        "C": {
          "included": true,
          "sets": 1,
          "repMin": 6,
          "repMax": 8,
          "restSeconds": 150
        }
      }
    }
  ]
}
```

`importance` must be `principal`, `core` or `accessory`. `plannedLoad` cannot be negative.

A missing mode prescription receives these defaults:

| Mode | Sets | Repetition range | Rest |
|---|---:|---:|---:|
| A | 3 | 8–10 | 120 seconds |
| B | 2 | 8–10 | 120 seconds |
| C | 1 | 8–10 | 120 seconds |

Set `included` to `false` when an exercise should be omitted from a particular mode.

## Import flow

1. Open **Library**.
2. Select **Import routine**.
3. Paste JSON or choose a `.json` file.
4. Select **Check pack**.
5. Review exercise, slot and day counts.
6. Select **Replace routine**.
7. Retain the automatically downloaded pre-import backup until the new routine has been checked.

An example pack is stored at `examples/routine-pack.example.json`.
