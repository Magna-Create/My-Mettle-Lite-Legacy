# Phase 3B — Qwen3-4B native QAIRT device gate

Target: Samsung Galaxy S25 Ultra / Snapdragon 8 Elite for Galaxy / Android 15+.

This gate validates the custom `Qwen3-4B` W4A16 bundle with 12,288-token context through Qualcomm Genie and QAIRT. Pack verification alone is not an operational pass. The model must create a native dialog, generate text on the NPU and unload cleanly.

## Required assets

### Model pack

The app installs the complete public bundle from:

```text
MagneRex/Qwen3-4B-Genie-Snapdragon-8-Elite-12K
```

All 15 runtime members must report **Verified and ready**.

### Matching QAIRT runtime

Use the exact SDK line used for compilation:

```text
2.45.0.260326154327
```

Do not commit or publish Qualcomm runtime binaries in the My Mettle repository.

From WSL or Linux, after installing that QAIRT SDK:

```bash
cd ~/path/to/My-Mettle

bash scripts/package-qairt-android-runtime.sh \
  /path/to/qairt/2.45.0.260326154327 \
  /mnt/c/Users/<WINDOWS_USER>/Downloads/my-mettle-qairt-2.45-android.zip
```

For Snapdragon 8 Elite the script defaults to Hexagon v73. Override only when targeting another chipset:

```bash
MY_METTLE_HTP_ARCH=73 bash scripts/package-qairt-android-runtime.sh \
  /path/to/qairt/2.45.0.260326154327 \
  my-mettle-qairt-2.45-android.zip
```

The archive contains only the local runtime libraries needed by the app:

- `libGenie.so`;
- QNN system, HTP and prepare libraries;
- ARM64 HTP stub libraries;
- Hexagon v73 HTP skeleton libraries;
- a local manifest and SHA-256 listing.

## APK build

Pull the Phase 3 branch and build in Termux:

```bash
cd ~/projects/My-Mettle

git fetch origin
git checkout agent/phase-3b-model-runtime-lab
git reset --hard origin/agent/phase-3b-model-runtime-lab

npm install
npm run android:sync

cd android
chmod +x gradlew
./gradlew assembleDebug --no-daemon

cp app/build/outputs/apk/debug/app-debug.apk \
  /sdcard/Download/My-Mettle-Qwen-Native.apk
```

Install over the existing application. Do not uninstall or clear app data.

## Setup in My Mettle

Open:

```text
Settings → Intelligence → Local models
```

1. Confirm the Qwen3-4B 12K pack is verified.
2. Tap **Verify 12K pack** once.
3. Under **QAIRT 2.45**, tap **Import QAIRT runtime ZIP**.
4. Select `my-mettle-qairt-2.45-android.zip`.
5. Confirm:
   - JNI bridge: Loaded;
   - runtime files: present for ARM64 and DSP;
   - status: Runtime ready.
6. Open **Qwen3-4B · 12K · NPU**.
7. Tap **Run Qwen NPU baseline**.

## Expected first-pass behaviour

The run performs one fresh lifecycle:

1. rewrite model/config paths to app-private absolute paths;
2. load the imported QAIRT/QNN runtime;
3. create a Genie dialog from `genie_config.json`;
4. submit one correctly tagged Qwen prompt with thinking disabled for the bounded baseline;
5. capture final text and profiler data;
6. free dialog, config and profiler handles;
7. record process memory after unload.

The result card should report:

- model load time;
- first callback latency;
- generation time;
- unload time;
- total time;
- peak PSS;
- profiler TTFT, prompt processing rate and token generation rate where supplied by QAIRT;
- two short final sentences.

## Pass conditions

The first native gate passes when:

- `libmais_geniex.so` loads from the APK;
- imported QAIRT 2.45 libraries are accepted;
- the four QNN context binaries create a Genie dialog;
- generation returns non-empty final text;
- backend remains the Qualcomm NPU/HTP path;
- the app, launcher and System UI remain alive;
- native handles unload without error;
- a second run after force-stop/reopen also succeeds.

## Failure capture

Do not repeatedly launch a failing native run. Capture the complete error shown by the app and, where available, collect filtered logs from a connected PC:

```bash
adb logcat -c
adb logcat | grep -E 'MaisGenieX|Genie|Qnn|HTP|CDSP|dev.kian.gymapp'
```

Useful failure classes include:

- Android linker namespace or missing `.so` dependency;
- incompatible QAIRT/QNN version;
- missing Hexagon v73 stub or skeleton;
- HTP/CDSP firmware incompatibility;
- invalid context-binary path;
- Genie config/schema incompatibility;
- memory allocation failure at 12,288 context;
- clean generation followed by unload failure.

## Safety boundary

The native benchmark is deliberately single-run and non-cancellable until Qualcomm's exact dialog-signal ABI is validated. Qwen remains excluded from autonomous MAIS role execution until this device gate passes repeatedly. Deterministic fallback remains active during that period.
