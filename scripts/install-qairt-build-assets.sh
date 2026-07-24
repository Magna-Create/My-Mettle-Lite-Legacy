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

if [[ ! -f "$source_root/SHA256SUMS.txt" ]]; then
  echo "ERROR: QAIRT package has no SHA256SUMS.txt." >&2
  exit 1
fi
if [[ ! -f "$source_root/android/app/src/main/assets/qairt/qairt-runtime.json" ]]; then
  echo "ERROR: QAIRT package has no runtime manifest." >&2
  exit 1
fi

python - "$source_root/android/app/src/main/assets/qairt/qairt-runtime.json" "$EXPECTED_VERSION" <<'PY'
import json
import sys
from pathlib import Path
manifest = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
expected = sys.argv[2]
actual = manifest.get("qairtVersion")
if actual != expected:
    raise SystemExit(f"ERROR: QAIRT package version is {actual!r}; expected {expected!r}.")
PY

(
  cd "$source_root"
  sha256sum --check SHA256SUMS.txt
)

arm64_source="$source_root/android/app/src/main/jniLibs/arm64-v8a"
hexagon_source="$source_root/android/app/src/main/assets/qairt/hexagon"
arm64_destination="$PROJECT_ROOT/android/app/src/main/jniLibs/arm64-v8a"
asset_destination="$PROJECT_ROOT/android/app/src/main/assets/qairt"

for required in libGenie.so libQnnSystem.so libQnnHtp.so libQnnHtpPrepare.so; do
  if [[ ! -f "$arm64_source/$required" ]]; then
    echo "ERROR: QAIRT package is missing $required." >&2
    exit 1
  fi
done

shopt -s nullglob
stubs=("$arm64_source"/libQnnHtpV*Stub.so)
skels=("$hexagon_source"/libQnnHtpV*Skel.so)
shopt -u nullglob
if (( ${#stubs[@]} == 0 )); then
  echo "ERROR: QAIRT package has no ARM64 HTP stub library." >&2
  exit 1
fi
if (( ${#skels[@]} == 0 )); then
  echo "ERROR: QAIRT package has no Hexagon HTP skeleton library." >&2
  exit 1
fi

mkdir -p "$arm64_destination" "$asset_destination/hexagon"
find "$arm64_destination" -maxdepth 1 -type f \( -name 'libGenie.so' -o -name 'libQnn*.so' \) -delete
rm -rf "$asset_destination/hexagon"
mkdir -p "$asset_destination/hexagon"

cp -a "$arm64_source/." "$arm64_destination/"
cp -a "$hexagon_source/." "$asset_destination/hexagon/"
cp "$source_root/android/app/src/main/assets/qairt/qairt-runtime.json" "$asset_destination/qairt-runtime.json"

printf '\nQAIRT %s build assets staged locally.\n' "$EXPECTED_VERSION"
printf 'ARM64 native libraries:\n'
find "$arm64_destination" -maxdepth 1 -type f \( -name 'libGenie.so' -o -name 'libQnn*.so' \) -printf '  %f\t%s bytes\n' | sort
printf 'Hexagon assets:\n'
find "$asset_destination/hexagon" -maxdepth 1 -type f -printf '  %f\t%s bytes\n' | sort
printf '\nThese files are ignored by Git and will be packaged only into your local APK.\n'
