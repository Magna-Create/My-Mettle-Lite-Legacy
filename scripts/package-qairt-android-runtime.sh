#!/usr/bin/env bash
set -euo pipefail

EXPECTED_VERSION="2.45.0.260326154327"
QAIRT_ROOT="${1:-${QAIRT_HOME:-}}"
OUTPUT="${2:-$PWD/my-mettle-qairt-${EXPECTED_VERSION}-android.zip}"
HTP_ARCH="${MY_METTLE_HTP_ARCH:-73}"

if [[ -z "$QAIRT_ROOT" ]]; then
  cat >&2 <<'EOF'
Usage:
  scripts/package-qairt-android-runtime.sh /path/to/qairt/2.45.0.260326154327 [output.zip]

The first argument may also be supplied through QAIRT_HOME.
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
mkdir -p "$work/arm64" "$work/hexagon"

copy_arm64=(
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

for name in "${copy_arm64[@]}"; do
  cp -L "$ARM64_SOURCE/$name" "$work/arm64/$name"
done
for name in "${optional_arm64[@]}"; do
  [[ -f "$ARM64_SOURCE/$name" ]] && cp -L "$ARM64_SOURCE/$name" "$work/arm64/$name"
done
for path in "${stub_files[@]}"; do
  cp -L "$path" "$work/arm64/$(basename "$path")"
done
for path in "${skel_files[@]}"; do
  cp -L "$path" "$work/hexagon/$(basename "$path")"
done

cat > "$work/qairt-runtime.json" <<EOF
{
  "purpose": "My Mettle private on-device Genie runtime",
  "qairtVersion": "$EXPECTED_VERSION",
  "htpArchitecture": "v$HTP_ARCH",
  "sourceRoot": "local QAIRT SDK; not redistributed by My Mettle",
  "createdAtUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

(
  cd "$work"
  find arm64 hexagon -type f -print0 \
    | sort -z \
    | xargs -0 sha256sum \
    > SHA256SUMS.txt
)

mkdir -p "$(dirname "$OUTPUT")"
rm -f "$OUTPUT"
(
  cd "$work"
  zip -9 -r "$OUTPUT" arm64 hexagon qairt-runtime.json SHA256SUMS.txt
)

printf '\nCreated: %s\n' "$OUTPUT"
du -h "$OUTPUT"
printf '\nIncluded libraries:\n'
(
  cd "$work"
  find arm64 hexagon -maxdepth 1 -type f -printf '%p\t%s bytes\n' | sort
)
