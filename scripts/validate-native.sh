#!/usr/bin/env bash
set -euo pipefail

VISION_PRO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$VISION_PRO_ROOT"

validation_mode="${1:-test}"
if [[ "$validation_mode" != "build" && "$validation_mode" != "test" ]]; then
    printf 'Usage: bash scripts/validate-native.sh [build|test]\n' >&2
    exit 2
fi

if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
    printf 'Native validation requires an Apple-silicon Mac and Xcode.\n' >&2
    exit 1
fi

expected_xcode="$(tr -d '\r\n' < .xcode-version)"
actual_xcode="$(xcodebuild -version | awk 'NR == 1 { print $2 }')"
if [[ "$actual_xcode" != "$expected_xcode" ]]; then
    printf 'Select Xcode %s with DEVELOPER_DIR; current version is %s.\n' "$expected_xcode" "$actual_xcode" >&2
    exit 1
fi

project_path="apps/visionos/CMESpatialMarketCenter.xcodeproj"
plutil -lint "$project_path/project.pbxproj"
plutil -lint apps/visionos/CMESpatialMarketCenter/Info.plist
plutil -lint apps/visionos/CMESpatialMarketCenter/Resources/PrivacyInfo.xcprivacy

dashboard_directory="apps/visionos/CMESpatialMarketCenter/Resources/MarketDashboard"
for asset in index.html app.bundle.js dashboard.css icon.svg bundle-manifest.json; do
    if [[ ! -s "$dashboard_directory/$asset" ]]; then
        printf 'Missing dashboard asset: %s. Run npm run build:visionos in apps/preview-web, then retry.\n' "$asset" >&2
        exit 1
    fi
done

xcrun swift test --package-path packages/MarketCore
xcrun swift test --package-path packages/MarketData
xcrun swift build --package-path packages/SpatialUI

if [[ "$validation_mode" == "build" ]]; then
    xcodebuild build-for-testing \
        -project "$project_path" \
        -scheme CMESpatialMarketCenter \
        -configuration Debug \
        -destination 'generic/platform=visionOS Simulator' \
        -derivedDataPath artifacts/DerivedData \
        CODE_SIGNING_ALLOWED=NO
else
    simulator_destination="${VISION_PRO_DESTINATION:-platform=visionOS Simulator,name=Apple Vision Pro,OS=26.2}"
    result_bundle="artifacts/NativeTests-$(date -u +%Y%m%dT%H%M%SZ)-$$.xcresult"
    mkdir -p artifacts

    xcodebuild test \
        -project "$project_path" \
        -scheme CMESpatialMarketCenter \
        -configuration Debug \
        -destination "$simulator_destination" \
        -destination-timeout 60 \
        -parallel-testing-enabled NO \
        -derivedDataPath artifacts/DerivedData \
        -resultBundlePath "$result_bundle" \
        CODE_SIGNING_ALLOWED=NO
fi
