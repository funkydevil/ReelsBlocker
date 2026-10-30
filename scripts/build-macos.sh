#!/bin/zsh
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TASK_PATH_HELPER="$HOME/.codex/scripts/codex-derived-data-path.py"
if [[ -f "$TASK_PATH_HELPER" ]]; then
  TASK_DERIVED_DATA="$(python3 "$TASK_PATH_HELPER" "$TASK_ROOT")"
else
  TASK_ROOT_HASH="$(print -rn -- "$TASK_ROOT" | shasum -a 256 | cut -c 1-12)"
  TASK_DERIVED_DATA="$HOME/Library/Developer/Xcode/DerivedData/Codex/ReelsBlocker-$TASK_ROOT_HASH"
fi
xcodebuild -project "$TASK_ROOT/Safari/ReelsBlocker/ReelsBlocker.xcodeproj" \
  -scheme ReelsBlocker -configuration Debug -derivedDataPath "$TASK_DERIVED_DATA" \
  CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM= build
mkdir -p "$TASK_ROOT/dist"
ditto "$TASK_DERIVED_DATA/Build/Products/Debug/ReelsBlocker.app" "$TASK_ROOT/dist/ReelsBlocker.app"
echo "App: $TASK_ROOT/dist/ReelsBlocker.app"
