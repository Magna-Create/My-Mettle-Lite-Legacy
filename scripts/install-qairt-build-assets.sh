#!/usr/bin/env bash
set -euo pipefail

ARCHIVE="${1:-}"
PROJECT_ROOT="${2:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
EXPECTED_VERSION="2.45.0.260326154327"

if [[ -z "$ARCHIVE" ]]; then
  cat >&2 <<'EOF'
Usage:
  bash scripts/install-qairt-build-assets.sh \
    /sdcard/Download/my-mettle-qairt-2.45-build-assets.zip
EOF
  exit 2
fi

if [[ ! -f "$ARCHIVE" ]]; then
  echo "ERROR: QAIRT build-assets ZIP not found: $ARCHIVE" >&2
  exit 1
fi
if [[ ! -d "$PROJECT_ROOT/android/app/src/main" ]]; then
  echo "ERROR: My Mettle project root not found: $PROJECT_ROOT" >&2
  exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
unzip -q "$ARCHIVE" -d "$work"
source_root="$work/qairt-build-assets"
manifest="$source_root/android/app/src/main/assets/qairt/qairt-runtime.json"
native_source="$source_root/android/app/src/main/jniLibs/arm64-v8a"

if [[ ! -f "$source_root/SHA256SUMS.txt" ]]; then
  echo "ERROR: QAIRT package has no SHA256SUMS.txt." >&2
  exit 1
fi
if [[ ! -f "$manifest" ]]; then
  echo "ERROR: QAIRT package has no runtime manifest." >&2
  exit 1
fi

python - "$manifest" "$EXPECTED_VERSION" <<'PY'
import json
import sys
from pathlib import Path
manifest = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
expected = sys.argv[2]
actual = manifest.get("qairtVersion")
if actual != expected:
    raise SystemExit(f"ERROR: QAIRT package version is {actual!r}; expected {expected!r}.")
if manifest.get("htpArchitecture") != "v73":
    raise SystemExit("ERROR: This S25 Ultra build requires Hexagon v73 assets.")
PY

(
  cd "$source_root"
  sha256sum --check SHA256SUMS.txt
)

for required in libGenie.so libQnnSystem.so libQnnHtp.so libQnnHtpPrepare.so; do
  if [[ ! -f "$native_source/$required" ]]; then
    echo "ERROR: QAIRT package is missing $required." >&2
    exit 1
  fi
done

shopt -s nullglob
stubs=("$native_source"/libQnnHtpV*Stub.so)
skels=("$native_source"/libQnnHtpV*Skel.so)
shopt -u nullglob
if (( ${#stubs[@]} == 0 )); then
  echo "ERROR: QAIRT package has no ARM64 HTP stub library." >&2
  exit 1
fi
if (( ${#skels[@]} == 0 )); then
  echo "ERROR: QAIRT package has no Hexagon v73 HTP skeleton library." >&2
  exit 1
fi

native_destination="$PROJECT_ROOT/android/app/src/main/jniLibs/arm64-v8a"
asset_destination="$PROJECT_ROOT/android/app/src/main/assets/qairt"
mkdir -p "$native_destination" "$asset_destination"

find "$native_destination" -maxdepth 1 -type f \( \
  -name 'libGenie.so' -o \
  -name 'libQnn*.so' -o \
  -name 'libc++_shared.so' \
\) -delete
cp -a "$native_source/." "$native_destination/"
cp "$manifest" "$asset_destination/qairt-runtime.json"

printf '\nQAIRT %s build assets staged locally.\n' "$EXPECTED_VERSION"
printf 'APK native libraries:\n'
find "$native_destination" -maxdepth 1 -type f \( \
  -name 'libGenie.so' -o \
  -name 'libQnn*.so' -o \
  -name 'libc++_shared.so' \
\) -printf '  %f\t%s bytes\n' | sort
printf '\nThese licensed/runtime files are ignored by Git and will be included only in your local APK.\n'
