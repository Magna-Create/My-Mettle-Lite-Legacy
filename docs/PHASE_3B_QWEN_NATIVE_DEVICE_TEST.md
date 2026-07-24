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

The ARM64 QAIRT libraries are executable native code, so they are staged into the Android project before Gradle builds the APK. Android then installs them in its protected native-library directory. Hexagon v73 skeletons are packaged as APK assets and copied into app-private DSP storage on first use.

## 1. Create the private build-assets ZIP on the PC

From WSL or Linux, after installing the matching QAIRT SDK:

```bash
cd ~/path/to/My-Mettle

bash scripts/package-qairt-android-runtime.sh \
  /path/to/qairt/2.45.0.260326154327 \
  /mnt/c/Users/<WINDOWS_USER>/Downloads/my-mettle-qairt-2.45-build-assets.zip
```

For Snapdragon 8 Elite the script defaults to Hexagon v73. Override only when deliberately targeting another chipset:

```bash
MY_METTLE_HTP_ARCH=73 bash scripts/package-qairt-android-runtime.sh \
  /path/to/qairt/2.45.0.260326154327 \
  my-mettle-qairt-2.45-build-assets.zip
```

The private ZIP contains:

- `libGenie.so`;
- QNN system, HTP and prepare libraries;
- ARM64 HTP stub libraries;
- Hexagon v73 HTP skeleton libraries;
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

The staging script verifies the package hashes and exact QAIRT version, then places the licensed files into Git-ignored Android source directories. They are included only in the locally built APK.

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
6. Tap **Run Qwen NPU baseline**.

## Expected first-pass behaviour

The run performs one fresh lifecycle:

1. rewrite model/config paths to app-private absolute paths;
2. load QAIRT/QNN host libraries from Android's installed native-library directory;
3. expose the extracted Hexagon v73 skeleton directory through `ADSP_LIBRARY_PATH`;
4. create a Genie dialog from `genie_config.json`;
5. submit one correctly tagged Qwen prompt with thinking disabled for the bounded baseline;
6. capture final text and profiler data;
7. free dialog, config and profiler handles;
8. record process memory after unload.

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
- packaged QAIRT 2.45 libraries are accepted;
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
- HTP/CDSP firmware or device meta-build incompatibility;
- invalid context-binary path;
- Genie config/schema incompatibility;
- memory allocation failure at 12,288 context;
- clean generation followed by unload failure.

## Safety boundary

The native benchmark is deliberately single-run and non-cancellable until Qualcomm's exact dialog-signal ABI is validated. Qwen remains excluded from autonomous MAIS role execution until this device gate passes repeatedly. Deterministic fallback remains active during that period.
