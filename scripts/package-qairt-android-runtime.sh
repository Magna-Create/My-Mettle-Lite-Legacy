#!/usr/bin/env bash
set -euo pipefail

EXPECTED_VERSION="2.45.0.260326154327"
QAIRT_ROOT="${1:-${QAIRT_HOME:-}}"
OUTPUT="${2:-$PWD/my-mettle-qairt-${EXPECTED_VERSION}-build-assets.zip}"
HTP_ARCH="${MY_METTLE_HTP_ARCH:-73}"

if [[ -z "$QAIRT_ROOT" ]]; then
  cat >&2 <<'EOF'
Usage:
  bash scripts/package-qairt-android-runtime.sh \
    /path/to/qairt/2.45.0.260326154327 \
    [output.zip]

The first argument may also be supplied through QAIRT_HOME.
The resulting ZIP is a private build input. Do not publish or commit it.
EOF
  exit 2
fi

QAIRT_ROOT="$(cd "$QAIRT_ROOT" && pwd)"
ARM64_SOURCE="$QAIRT_ROOT/lib/aarch64-android"
HEXAGON_SOURCE="$QAIRT_ROOT/lib/hexagon-v${HTP_ARCH}/unsigned"
READELF="$(command -v llvm-readelf || command -v readelf || true)"

if [[ -z "$READELF" ]]; then
  echo "ERROR: llvm-readelf or readelf is required to validate Android native dependencies." >&2
  exit 1
fi
if [[ ! -d "$ARM64_SOURCE" ]]; then
  echo "ERROR: ARM64 QAIRT libraries not found: $ARM64_SOURCE" >&2
  exit 1
fi
if [[ ! -d "$HEXAGON_SOURCE" ]]; then
  echo "ERROR: Hexagon v${HTP_ARCH} libraries not found: $HEXAGON_SOURCE" >&2
  exit 1
fi

for required in libGenie.so libQnnSystem.so libQnnHtp.so libQnnHtpPrepare.so; do
  if [[ ! -f "$ARM64_SOURCE/$required" ]]; then
    echo "ERROR: Required QAIRT library missing: $ARM64_SOURCE/$required" >&2
    exit 1
  fi
done

shopt -s nullglob
stub_files=("$ARM64_SOURCE"/libQnnHtpV*Stub.so)
skel_files=("$HEXAGON_SOURCE"/libQnnHtpV*Skel.so)
shopt -u nullglob

if (( ${#stub_files[@]} == 0 )); then
  echo "ERROR: No HTP stub libraries found under $ARM64_SOURCE" >&2
  exit 1
fi
if (( ${#skel_files[@]} == 0 )); then
  echo "ERROR: No HTP skeleton libraries found under $HEXAGON_SOURCE" >&2
  exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
root="$work/qairt-build-assets"
native_destination="$root/android/app/src/main/jniLibs/arm64-v8a"
asset_root="$root/android/app/src/main/assets/qairt"
mkdir -p "$native_destination" "$asset_root"

required_arm64=(
  libGenie.so
  libQnnSystem.so
  libQnnHtp.so
  libQnnHtpPrepare.so
)

optional_arm64=(
  libQnnSaver.so
  libQnnHtpNetRunExtensions.so
  libQnnHtpProfilingReader.so
)

for name in "${required_arm64[@]}"; do
  cp -L "$ARM64_SOURCE/$name" "$native_destination/$name"
done
for name in "${optional_arm64[@]}"; do
  [[ -f "$ARM64_SOURCE/$name" ]] && cp -L "$ARM64_SOURCE/$name" "$native_destination/$name"
done
for path in "${stub_files[@]}"; do
  cp -L "$path" "$native_destination/$(basename "$path")"
done
for path in "${skel_files[@]}"; do
  cp -L "$path" "$native_destination/$(basename "$path")"
done

is_android_system_library() {
  case "$1" in
    libc.so|libdl.so|liblog.so|libm.so|libandroid.so|libz.so|libEGL.so|libGLESv2.so|libvulkan.so|libnativewindow.so|libsync.so|libbinder_ndk.so)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

find_ndk_libcxx() {
  local root candidate
  for root in "${ANDROID_NDK_HOME:-}" "${ANDROID_NDK_ROOT:-}"; do
    [[ -n "$root" ]] || continue
    candidate="$root/toolchains/llvm/prebuilt"
    while IFS= read -r path; do
      [[ -f "$path" ]] && { printf '%s\n' "$path"; return 0; }
    done < <(find "$candidate" -path '*/sysroot/usr/lib/aarch64-linux-android/libc++_shared.so' -type f 2>/dev/null | sort -V -r)
  done
  if [[ -n "${ANDROID_SDK_ROOT:-}" ]]; then
    while IFS= read -r path; do
      [[ -f "$path" ]] && { printf '%s\n' "$path"; return 0; }
    done < <(find "$ANDROID_SDK_ROOT/ndk" -path '*/toolchains/llvm/prebuilt/*/sysroot/usr/lib/aarch64-linux-android/libc++_shared.so' -type f 2>/dev/null | sort -V -r)
  fi
  return 1
}

copy_dependency() {
  local dependency="$1"
  local source=""

  if [[ -f "$native_destination/$dependency" ]] || is_android_system_library "$dependency"; then
    return 0
  fi
  if [[ -f "$ARM64_SOURCE/$dependency" ]]; then
    source="$ARM64_SOURCE/$dependency"
  elif [[ "$dependency" == "libc++_shared.so" ]]; then
    source="$(find_ndk_libcxx || true)"
  fi

  if [[ -z "$source" || ! -f "$source" ]]; then
    echo "ERROR: QAIRT requires $dependency, but it was not found beside the SDK libraries or in an Android NDK." >&2
    echo "Set ANDROID_NDK_HOME or ANDROID_SDK_ROOT, then rerun the packager." >&2
    exit 1
  fi

  cp -L "$source" "$native_destination/$dependency"
  printf 'Added transitive dependency: %s\n' "$dependency"
}

# Resolve dependencies recursively for Android host libraries. Hexagon skeletons
# are DSP binaries and must not be interpreted as AArch64 shared objects.
while true; do
  before="$(find "$native_destination" -maxdepth 1 -type f | wc -l)"
  while IFS= read -r host_library; do
    while IFS= read -r dependency; do
      [[ -n "$dependency" ]] && copy_dependency "$dependency"
    done < <("$READELF" -d "$host_library" 2>/dev/null | sed -n 's/.*Shared library: \[\([^]]*\)\].*/\1/p')
  done < <(find "$native_destination" -maxdepth 1 -type f -name '*.so' ! -name '*Skel.so' | sort)
  after="$(find "$native_destination" -maxdepth 1 -type f | wc -l)"
  [[ "$after" == "$before" ]] && break
done

cat > "$asset_root/qairt-runtime.json" <<EOF
{
  "purpose": "My Mettle private build-time Genie runtime",
  "qairtVersion": "$EXPECTED_VERSION",
  "htpArchitecture": "v$HTP_ARCH",
  "source": "local QAIRT SDK; not redistributed by My Mettle",
  "packaging": "APK arm64-v8a native libraries with legacy extraction",
  "createdAtUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

(
  cd "$root"
  find android -type f -print0 \
    | sort -z \
    | xargs -0 sha256sum \
    > SHA256SUMS.txt
)

mkdir -p "$(dirname "$OUTPUT")"
OUTPUT="$(cd "$(dirname "$OUTPUT")" && pwd)/$(basename "$OUTPUT")"
rm -f "$OUTPUT"
(
  cd "$work"
  zip -9 -r "$OUTPUT" qairt-build-assets
)

printf '\nCreated private QAIRT build-assets package:\n  %s\n' "$OUTPUT"
du -h "$OUTPUT"
printf '\nIncluded native libraries:\n'
(
  cd "$root"
  find android/app/src/main/jniLibs/arm64-v8a -type f -printf '%f\t%s bytes\n' | sort
)
printf '\nNext step on the phone:\n'
printf '  bash scripts/install-qairt-build-assets.sh "%s"\n' "<path-to-this-zip>"
