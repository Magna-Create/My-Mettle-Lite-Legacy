# Phase 3B — Qwen3-4B GenieX Android device gate

Target: Samsung Galaxy S25 Ultra / Snapdragon 8 Elite for Galaxy / Android 15+.

This gate validates the custom Qwen3-4B W4A16 bundle with a 12,288-token context through Qualcomm's supported GenieX Android runtime. Pack verification alone is not an operational pass: the model must load, think, generate final text on the NPU and unload cleanly.

## Distribution architecture

The Android runtime is a normal application dependency:

```gradle
implementation 'com.qualcomm.qti:geniex-android:0.3.5'
```

Gradle resolves GenieX and its native runtime from Maven Central. My Mettle does not require a locally installed QAIRT SDK, private runtime ZIP, WSL, NDK bridge build or manual runtime import.

The model weights remain outside the APK and are installed through My Mettle's existing resumable model-pack downloader:

```text
MagneRex/Qwen3-4B-Genie-Snapdragon-8-Elite-12K
```

Normal signed APK updates replace the bundled GenieX runtime while preserving the downloaded model pack and training data in app-private storage.

## Build in Termux

```bash
cd ~/projects/My-Mettle

git fetch origin
git switch agent/phase-3b-model-runtime-lab
git pull --ff-only origin agent/phase-3b-model-runtime-lab

npm install
npm run android:sync

cd android
chmod +x gradlew
./gradlew assembleDebug --no-daemon

cp app/build/outputs/apk/debug/app-debug.apk \
  /sdcard/Download/My-Mettle-Qwen-GenieX.apk
```

Install the APK over the existing application. Do not uninstall or clear app data.

## Setup in My Mettle

Open:

```text
Settings → Intelligence → Local models
```

1. Confirm the Qwen3-4B 12K pack reports **Verified and ready**.
2. Tap **Verify 12K pack** once.
3. Open **Qwen3-4B · 12K · NPU**.
4. Confirm:
   - Runtime delivery: **Bundled with app**;
   - GenieX Android: **0.3.5**;
   - QAIRT plugin: available;
   - Thinking mode: **Enabled**.
5. Tap **Run Qwen thinking baseline** once.

## Expected lifecycle

The supported GenieX adapter performs one fresh lifecycle:

1. initialise the bundled GenieX SDK and QAIRT plugin;
2. resolve the existing Qwen bundle directory and tokenizer;
3. create an `LlmWrapper` with `runtime_id=qairt`, NPU compute and model-default context values;
4. apply the model's chat template with thinking enabled;
5. stream tokens through GenieX's Kotlin Flow API;
6. collect GenieX profiling data;
7. retain only the final answer and aggregate reasoning-length telemetry;
8. stop and destroy the native model wrapper during cleanup;
9. record process memory after unload.

The result card should report:

- model load time;
- time to first token;
- generation and total time;
- unload time;
- peak PSS;
- whether thinking was observed;
- reasoning character count without storing the reasoning transcript;
- prompt and generated token counts;
- prefill and decoding rates;
- stop reason;
- final response.

## Pass conditions

The device gate passes when:

- GenieX initialises from the ordinary APK without external runtime files;
- the QAIRT plugin accepts the custom 12K bundle;
- all four QNN context binaries load;
- thinking mode produces a completed reasoning section followed by final text;
- no raw reasoning transcript is persisted or exported;
- generation remains on the Qualcomm NPU path;
- cancellation stops an active stream without freeing a live handle prematurely;
- model destruction completes cleanly;
- the app, launcher and System UI remain alive;
- a second run after force-stop and reopen also succeeds.

## Failure capture

Do not repeatedly launch a failing native run. Capture the complete error shown by the app and, where available, collect filtered logs from a connected PC:

```bash
adb logcat -c
adb logcat | grep -E 'GenieX|QAIRT|Qnn|HTP|CDSP|dev.kian.gymapp'
```

Useful failure classes include:

- GenieX SDK or QAIRT plugin initialisation failure;
- model manifest or path incompatibility;
- incompatible context binaries;
- HTP/CDSP firmware or device compatibility failure;
- output budget exhausted before the final response;
- memory allocation failure at 12,288 context;
- generation succeeds but destruction fails.

## Safety boundary

Qwen remains excluded from autonomous MAIS role execution until this gate passes repeatedly. Thinking is enabled, but the reasoning transcript remains ephemeral and excluded from saved runtime results and Report Card exports. Deterministic fallback remains active during the validation period.
