# Phase 3B — Qwen3-4B native QAIRT device gate

Target: Samsung Galaxy S25 Ultra / Snapdragon 8 Elite for Galaxy / Android 15+.

This gate validates the custom `Qwen3-4B` W4A16 bundle with 12,288-token context through Qualcomm Genie and QAIRT. Pack verification alone is not an operational pass. The model must create a native dialog, think, generate final text on the NPU and unload cleanly.

## Required assets

### Model pack

The app installs the complete public bundle from:

```text
MagneRex/Qwen3-4B-Genie-Snapdragon-8-Elite-12K
```

All 15 runtime members must report **Verified and ready**.

### Matching QAIRT runtime

Use the same QAIRT 2.45 release line used for compilation. The exported bundle records:

```text
2.45.0.260326154327
```

The installed SDK directory may use a shorter package label such as `2.45.0.260326`; use the 2.45 SDK package whose build metadata matches the export.

Do not commit or publish Qualcomm runtime binaries in the My Mettle repository.

The private packager stages `libGenie.so`, QNN host libraries, HTP stubs, Hexagon v73 skeletons and any required non-system dependency into the Android `arm64-v8a` native source set. Gradle uses legacy native-library packaging, matching Qualcomm's ChatApp, so Android installs every required runtime file into one protected filesystem directory. That directory is supplied to both the Android dynamic linker and the DSP loader.

## 1. Create the private build-assets ZIP on the PC

From WSL or Linux, after installing the matching QAIRT SDK:

```bash
cd ~/path/to/My-Mettle

bash scripts/package-qairt-android-runtime.sh \
  /path/to/qairt/2.45.0.260326 \
  /mnt/c/Users/<WINDOWS_USER>/Downloads/my-mettle-qairt-2.45-build-assets.zip
```

The first argument must be the QAIRT SDK root containing:

```text
lib/aarch64-android
lib/hexagon-v73/unsigned
```

The script:

1. verifies the required Genie/QNN files;
2. selects Hexagon v73 for Snapdragon 8 Elite;
3. resolves transitive Android `.so` dependencies with `readelf`;
4. adds `libc++_shared.so` from the Android NDK only when required;
5. writes SHA-256 checksums for every staged file;
6. creates a private build-input ZIP.

Set `ANDROID_NDK_HOME` or `ANDROID_SDK_ROOT` before running the script when a QAIRT library depends on `libc++_shared.so` and the SDK does not include it beside the ARM64 libraries.

The private ZIP contains:

- `libGenie.so`;
- QNN system, HTP and prepare libraries;
- ARM64 HTP stub libraries;
- Hexagon v73 HTP skeleton libraries;
- any required non-system Android shared-library dependency;
- a local manifest and SHA-256 listing.

Transfer this ZIP to the phone's Downloads folder. It is a private build input, not an app-import file.

## 2. Stage QAIRT and build in Termux

```bash
cd ~/projects/My-Mettle

git fetch origin
git checkout agent/phase-3b-model-runtime-lab
git reset --hard origin/agent/phase-3b-model-runtime-lab

bash scripts/install-qairt-build-assets.sh \
  /sdcard/Download/my-mettle-qairt-2.45-build-assets.zip

npm install
npm run android:sync

cd android
chmod +x gradlew
./gradlew assembleDebug --no-daemon

cp app/build/outputs/apk/debug/app-debug.apk \
  /sdcard/Download/My-Mettle-Qwen-Native.apk
```

The staging script verifies the package hashes, QAIRT identifier and v73 target before placing the licensed files into Git-ignored Android source directories. They are included only in the locally built APK. The versioned open bridge `libmais_geniex.so` remains separate and is already present on the branch, so Termux does not need the Android NDK to build the app.

Install the APK over the existing application. Do not uninstall or clear app data.

## 3. Setup in My Mettle

Open:

```text
Settings → Intelligence → Local models
```

1. Confirm **QAIRT 2.45** reports **Runtime ready**.
2. Confirm:
   - JNI bridge: Loaded;
   - runtime source: Local APK build assets;
   - ARM64 and DSP runtime files are present.
3. Confirm the Qwen3-4B 12K pack is verified.
4. Tap **Verify 12K pack** once.
5. Open **Qwen3-4B · 12K · NPU**.
6. Confirm **Thinking mode: Enabled**.
7. Tap **Run Qwen thinking baseline** once.

## Expected first-pass behaviour

The run performs one fresh lifecycle:

1. rewrite tokenizer, backend-extension and context-binary paths to app-private absolute paths;
2. load QAIRT/QNN host libraries from Android's extracted native-library directory;
3. expose the same extracted directory through `ADSP_LIBRARY_PATH` for the v73 skeleton;
4. create a Genie configuration, profiler and dialog from `genie_config.json`;
5. submit one correctly tagged Qwen prompt with the explicit `/think` switch;
6. allow Qwen to generate its `<think>...</think>` reasoning before the final answer;
7. discard the reasoning transcript after measuring whether thinking occurred;
8. persist only the final text, timing, memory and profiler data;
9. free dialog, configuration and profiler handles;
10. record process memory after unload.

The result card should report:

- model load time;
- first callback latency;
- generation time;
- unload time;
- total time;
- peak PSS;
- whether thinking output was observed;
- reasoning character count without storing the reasoning text;
- profiler TTFT, prompt-processing rate and token-generation rate where supplied by QAIRT;
- two short final sentences.

## Pass conditions

The first native gate passes when:

- `libmais_geniex.so` loads from the APK;
- packaged QAIRT 2.45 libraries are accepted;
- the four QNN context binaries create a Genie dialog;
- thinking mode is enabled and the final answer follows the reasoning section;
- generation returns non-empty final text;
- no raw reasoning transcript is persisted;
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
- HTP/CDSP firmware or device meta-build incompatibility;
- invalid context-binary path;
- Genie configuration/schema incompatibility;
- output budget exhausted before `</think>` and the final answer;
- memory allocation failure at 12,288 context;
- clean generation followed by unload failure.

## Safety boundary

The native benchmark is deliberately single-run and non-cancellable until Qualcomm's exact dialog-signal ABI is validated. Thinking is enabled, but the reasoning transcript is ephemeral and excluded from saved runtime results and Report Card exports. Qwen remains excluded from autonomous MAIS role execution until this device gate passes repeatedly. Deterministic fallback remains active during that period.
