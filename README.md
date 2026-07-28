# My Mettle Lite Legacy

My Mettle Lite is the reduced Capacitor edition used for daily training and trustworthy data collection while the long-term native Kotlin application is developed separately.

The complete pre-reduction application remains preserved in `Magna-Create/My-Mettle-Legacy`.

## Active product scope

- Home training brief and manual day selection
- Workout execution, set logging, reflections and rest alarms
- Exercise library and immutable routine editing
- Optional `&` fourth day after ψ, φ and π
- Profile, weight, BMI and workout history
- Versioned full-data backup and restore
- Replace-only My Mettle Routine Pack import

MAIS, model runtimes, Lab, Progress and autonomous progression are disconnected from the active Lite runtime. Historical schema fields remain readable so existing data can migrate safely.

## Run

```bash
npm install
npm run dev
```

## Verify

```bash
npm test
npm run build
```

## Android

```bash
npm run android:sync
cd android
./gradlew assembleDebug
```

The Android application ID is `dev.kian.mymettle.litelegacy`, allowing Lite to coexist with the future native My Mettle application.

## Routine import

The versioned JSON contract is documented in [`docs/MY_METTLE_ROUTINE_PACK_V1.md`](docs/MY_METTLE_ROUTINE_PACK_V1.md). An importable example is available at [`examples/routine-pack.example.json`](examples/routine-pack.example.json).

## Data migration

Full exports use the `my-mettle-backup` envelope and identify their source as `my-mettle-lite-legacy`. Restore remains compatible with raw backups exported by the earlier Legacy application.
