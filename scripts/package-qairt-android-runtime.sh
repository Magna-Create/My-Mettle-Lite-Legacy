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
arm64_destination="$root/android/app/src/main/jniLibs/arm64-v8a"
asset_root="$root/android/app/src/main/assets/qairt"
hexagon_destination="$asset_root/hexagon"
mkdir -p "$arm64_destination" "$hexagon_destination"

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
  cp -L "$ARM64_SOURCE/$name" "$arm64_destination/$name"
done
for name in "${optional_arm64[@]}"; do
  [[ -f "$ARM64_SOURCE/$name" ]] && cp -L "$ARM64_SOURCE/$name" "$arm64_destination/$name"
done
for path in "${stub_files[@]}"; do
  cp -L "$path" "$arm64_destination/$(basename "$path")"
done
for path in "${skel_files[@]}"; do
  cp -L "$path" "$hexagon_destination/$(basename "$path")"
done

cat > "$asset_root/qairt-runtime.json" <<EOF
{
  "purpose": "My Mettle private build-time Genie runtime",
  "qairtVersion": "$EXPECTED_VERSION",
  "htpArchitecture": "v$HTP_ARCH",
  "source": "local QAIRT SDK; not redistributed by My Mettle",
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
printf '\nIncluded files:\n'
(
  cd "$root"
  find android -type f -printf '%p\t%s bytes\n' | sort
)
printf '\nNext step on the phone:\n'
printf '  bash scripts/install-qairt-build-assets.sh "%s"\n' "<path-to-this-zip>"
