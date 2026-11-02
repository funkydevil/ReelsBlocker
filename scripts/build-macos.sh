#!/bin/zsh
set -euo pipefail
TASK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ "${REELSBLOCKER_SIGNING_IDENTITY:-}" == "-" ]]; then
  echo "Use an Apple Development certificate. Ad-hoc signing with this app's bundle ID can break Safari activation detection." >&2
  exit 2
fi
TASK_PATH_HELPER="$HOME/.codex/scripts/codex-derived-data-path.py"
if [[ -f "$TASK_PATH_HELPER" ]]; then
  TASK_DERIVED_DATA="$(python3 "$TASK_PATH_HELPER" "$TASK_ROOT")"
else
  TASK_ROOT_HASH="$(print -rn -- "$TASK_ROOT" | shasum -a 256 | cut -c 1-12)"
  TASK_DERIVED_DATA="$HOME/Library/Developer/Xcode/DerivedData/Codex/ReelsBlocker-$TASK_ROOT_HASH"
fi
# Use the project's developer signing by default. An ad-hoc build with the
# same bundle ID can shadow the signed extension in Safari's ownership lookup.
TASK_SIGNING_ARGS=()
if [[ -n "${REELSBLOCKER_SIGNING_IDENTITY:-}" ]]; then
  TASK_SIGNING_ARGS+=("CODE_SIGN_IDENTITY=$REELSBLOCKER_SIGNING_IDENTITY" "CODE_SIGN_STYLE=Manual")
fi
if [[ -n "${REELSBLOCKER_DEVELOPMENT_TEAM:-}" ]]; then
  TASK_SIGNING_ARGS+=("DEVELOPMENT_TEAM=$REELSBLOCKER_DEVELOPMENT_TEAM")
fi
xcodebuild -project "$TASK_ROOT/Safari/ReelsBlocker/ReelsBlocker.xcodeproj" \
  -scheme ReelsBlocker -configuration Debug -derivedDataPath "$TASK_DERIVED_DATA" \
  CONFIGURATION_BUILD_DIR="$TASK_ROOT/dist" \
  "${TASK_SIGNING_ARGS[@]}" build
# Keep one build product: copying a registered app from DerivedData can leave
# Safari looking up a different containing app with the same bundle identifier.
TASK_LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
"$TASK_LSREGISTER" -f -R -trusted "$TASK_ROOT/dist/ReelsBlocker.app"
echo "App: $TASK_ROOT/dist/ReelsBlocker.app"
