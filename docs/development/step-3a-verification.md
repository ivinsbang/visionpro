# Step 3a: visionOS simulator compatibility

## Scope delivered

The owner requested visionOS simulator compatibility for the existing Windows
CME-style mock dashboard. The native app now opens that dashboard in a SwiftUI
window using `WKWebView`. It loads only included HTML, classic JavaScript, CSS, and
SVG resources; there is no local-server dependency, CME/broker connection, account,
native trading bridge, or order-execution path.

The native host adds readiness/failure/retry handling, confirmation before a full
desk reload, nonpersistent WebKit storage, and a session-only watchlist. Native
workspace, companion, and RealityKit windows remain available. HTML floating
panels are still inside one native window; the RealityKit volume is a neutral
preview rather than a chart or a shared view of the JavaScript quotes.

## Checks run on Windows

After a clean `npm.cmd ci --ignore-scripts --no-audit --no-fund`, ran `npm.cmd test`
in `apps/preview-web` with Node.js 22, installed Chrome, and Playwright WebKit:

- **13 unit tests passed:** eight existing synthetic-model tests and five resource
  packaging tests for determinism, manifest hashes, classic-script syntax, content
  policy, stale resources, and unexpected bundle entries.
- **16 original browser tests passed:** the Windows preview still supports its
  prior market, persistence, chart, outage, and window workflows.
- **10 bundled-dashboard tests passed:** five direct-file journeys in Chrome and
  the Windows Playwright WebKit 26.6 test build. They cover synthetic streaming,
  pause, linked selection, independent charts, spatial rotation, memory-only
  watchlists, reload, a compact viewport, outage/recovery, and CSP enforcement.
- **39 total local tests passed.** These are not Apple Simulator or native tests.
- `check:visionos` confirms the five generated resources match their shared source.
  Videos, test dependencies, recording helpers, and personal files are excluded.
- Static OpenStep/XML/property-list checks verify all 104 Xcode project objects,
  source/package paths, target membership, resource-folder copying, and shared-scheme
  references. The seven new/changed Swift files pass auxiliary syntax parsing.
- `bash -n scripts/validate-native.sh` passes with Git Bash. This is a shell syntax
  check, not execution of the native Mac validation workflow.
- Bundled WebKit screenshots at 1440x840 and 1040x590 were reviewed. The compact
  desk scrolls inside the app surface; web controls have 44-pixel minimum targets.
  Screenshots are in ignored `artifacts/visionos-compatibility`, not Simulator captures.

Chrome file tests use offline emulation. Playwright's Windows WebKit build fails
local-file navigation when its offline-emulation flag is enabled, so its tests
instead abort every HTTP(S) route and assert that none is reached. Both engines
verify a file-only content policy blocks remote images/scripts, fetches, and inline
scripts. Explicit `file:` sources avoid permissive `'self'` behavior observed with
the test port's local-file origin handling. No real CME endpoint is used by tests.

The auxiliary all-file Swift parser also reports a diagnostic on an existing
cast/nil-coalescing expression in `WorkspaceSettingsView.swift`. That unchanged
file is not included in the seven-file syntax claim. A native compiler, not this
parser, remains the authoritative build check.

## Not yet verified

- Swift/SDK compilation, native package tests, hosted app tests, and XCUITests.
- Actual `WKWebView` file access and first launch in Apple's visionOS simulator.
- Physical-network-off relaunch, native window reuse/placement, and volume sizing.
- Gaze/pinch interaction, VoiceOver, device comfort, rendering performance, and memory.
- Signing, artwork, localization, distribution, or App Store readiness.

The project still pins Xcode 26.3, Swift 6 language mode, visionOS 2.0 deployment,
and the visionOS 26.2 simulator baseline. No Apple toolchain exists on this Windows
laptop, so no native binary or simulator/device success is claimed. Native tests
were added for bundle presence, navigation rejection, dashboard readiness, and pause;
they must run on a supported Apple-silicon Mac.

## Handoff

Follow the [simulator run guide](visionos-simulator.md), then run
`bash scripts/validate-native.sh test` on the Mac and record the real result.
The [architecture decision](../architecture/decisions/0002-offline-dashboard-host.md)
explains the compatibility boundary.

No commits, remotes, uploads, or live integrations were created. The owner's
original project-notes file is unchanged. Step 4 and a full SwiftUI financial
rewrite still require separate approval.
