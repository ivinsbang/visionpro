# Development setup

## Windows browser preview

The CME-style synthetic dashboard runs locally with Python 3 and Chrome or Edge. From the
repository root:

```powershell
python scripts/serve-preview.py
```

Open [the local preview](http://127.0.0.1:8765). If the server is already running,
open the URL without starting another copy. Use `--port 8766` to select a different
port, and Ctrl+C to stop a foreground server. The server binds to `127.0.0.1` and
serves only `apps/preview-web`; assets are local and market connections are absent.

No Node.js installation is required to view the preview. To run its browser tests,
install Node.js 22 or later and Google Chrome, then run from the repository root:

```powershell
Set-Location apps/preview-web
npm.cmd ci
npx.cmd playwright install webkit
npm.cmd test
```

On macOS/Linux, use `npm` instead of `npm.cmd` and ensure `python3` is available.
Playwright starts the local server when needed and uses the installed Chrome
browser. Results and screenshots go to ignored `artifacts/preview-tests`.
The test command runs 44 model/packaging/film unit tests, 36 browser journeys, and 18
bundled-dashboard tests across Chrome and Playwright WebKit. The latter open the
generated native resources directly from disk, without a preview server; their
artifacts go to `artifacts/bundled-dashboard-tests`. They do not validate native
visionOS behavior. Use `test:unit`, `test:browser`, or `test:visionos` for one suite.
Linux WebKit setup additionally needs `npx playwright install --with-deps webkit`.
Refresh an existing preview tab after changing source files.
See [preview controls and limits](../../apps/preview-web/README.md).
The [Step 4a review guide](step-4a-verification.md) covers paper orders, fictional
portfolio/risk calculations, reset behavior, and the current validation record.

For a narrated video without a Mac or headset, see the
[Windows-rendered 3D concept film](windows-3d-film.md). Its rendered room and
scripted camera motion do not validate native visionOS behavior.

For the current working interface, open the [interactive 3D desk](http://127.0.0.1:8765/?demo=3d)
and follow the [all-features 3D demo guide](windows-3d-desk.md). The separate
`npm.cmd run record:desk` command records its real browser controls with narration
and subtitles, including the paper-trading and portfolio features.

## Supported native toolchain

| Component | Pinned baseline |
| --- | --- |
| Hardware | Apple-silicon Mac |
| Xcode | 26.3, recorded in `.xcode-version` |
| Swift compiler | 6.2.3 from Xcode 26.3 |
| Swift language / manifest tools | Swift 6 / Swift tools 6.2 |
| visionOS SDK / simulator runtime | 26.2 |
| App deployment target | visionOS 2.0 |
| Host package test platform | macOS 15.0 or later |

Xcode 26.3 supports macOS Sequoia 15.6 through supported Tahoe 26.x versions. See
Apple's [Xcode compatibility table](https://developer.apple.com/xcode/system-requirements)
and [visionOS setup](https://developer.apple.com/documentation/visionos/creating-your-first-visionos-app).
The repository can be edited on Windows; native builds and simulator checks need
the Apple toolchain. No native build or runtime test has run in this workspace.

## Open and run the native app

1. Make this repository available on your Mac and install Xcode 26.3.
2. Install the visionOS 26.2 simulator runtime in Xcode settings.
3. Open `apps/visionos/CMESpatialMarketCenter.xcodeproj`.
4. Select the `CMESpatialMarketCenter` scheme and an Apple Vision Pro simulator.
5. Use Run to build and launch the app, or Test to run the native app/UI tests.

The project references local packages through relative paths. There are no remote
Swift package dependencies to fetch and no project-generation tool to install.
Copy the entire repository, including packages and the bundled dashboard resources.
Node.js and Python are not required for Xcode to build and run the included bundle.

The app now opens the offline synthetic market dashboard in its main window.
**Native workspace** opens the original overview/settings shell and companion
controls. **Native volume** opens the neutral RealityKit preview. Dashboard web
panels remain inside one native window. Paper orders affect only a fictional local
ledger; there is no real order placement or real feed.
See the [simulator guide](visionos-simulator.md) for the full smoke test and limits.

After changing shared web source, regenerate its native resource bundle:

```powershell
Set-Location apps/preview-web
npm.cmd ci
npm.cmd run build:visionos
npm.cmd run check:visionos
```

Share the generated `Resources/MarketDashboard` folder with source changes.
CI checks that it is current. Xcode deliberately has no Node-dependent build phase.

The reusable paper model lives in `packages/TradingSimulation`, not in the generated
browser copy. `build:visionos` synchronizes that copy before bundling. For browser-only
development use `npm.cmd run build:simulation`; `check:simulation` and the unit suite
reject a stale copy. Node runs the shared ledger's `.test.mjs` files alongside the
browser model/packaging/film unit tests.

## Automated native validation

Run these commands in a Mac terminal from the repository root. If Xcode is named
`Xcode.app`, adjust `DEVELOPER_DIR` to that installation; the script verifies its
version before continuing.

```sh
export DEVELOPER_DIR="/Applications/Xcode_26.3.app/Contents/Developer"
bash scripts/validate-native.sh test
```

The script validates property lists and required dashboard resources, runs `MarketCore` and `MarketData` package
tests, builds `SpatialUI` for the host, then runs app and UI tests on the visionOS
26.2 simulator. Results go to ignored `artifacts/NativeTests-*.xcresult` bundles.
The native build also compiles the visionOS-only RealityKit view.

To build the app and native test bundles without running simulator tests:

```sh
bash scripts/validate-native.sh build
```

Package tests still run in `build` mode. To select another installed simulator,
set `VISION_PRO_DESTINATION` to an `xcodebuild` destination string. Use
`xcrun simctl list devices available` to inspect installed devices. Actual device
testing remains necessary for spatial input, accessibility, appearance, and comfort.

## Signing and identifiers

Simulator validation disables signing and requires no team identifier. The shared
bundle identifier is `com.example.cmespatialmarketcenter` for local development.
For a device, copy
`apps/visionos/Configuration/Developer.local.xcconfig.example` to the adjacent
`Developer.local.xcconfig`, then set your team and unique bundle identifier.
Configure the device and signing in Xcode. Do not commit the local override or
private signing material. See [configuration](../../apps/visionos/Configuration/README.md).

App icon artwork, localization, distribution signing, and release validation are
still required before distribution. The privacy manifest must be reviewed when
data access or dependencies change.

## Continuous integration

- `repository-checks.yml` checks committed text whitespace.
- `visionos.yml` runs the native validation script on the `macos-15` Apple-silicon
  runner with Xcode 26.3 selected explicitly.
- `preview.yml` runs model/packaging units, browser tests, and bundled Chrome/WebKit
  checks on `ubuntu-24.04` with Node.js 22, Python 3, installed Chrome, and Playwright WebKit.

The selected toolchain/runtime are present in the
[Mac runner image inventory](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-arm64-Readme.md).
Browser prerequisites are listed in the
[Ubuntu runner image inventory](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md).
Workflows use commit-pinned actions with read-only repository permissions and no
stored checkout credentials. They run when the repository is hosted on GitHub;
no remote has been configured and no workflow has run yet.

## Current verification

See [Step 3a verification](step-3a-verification.md) for simulator compatibility,
[Step 3 verification](step-3-verification.md) for the original Windows dashboard,
and [Step 2 verification](step-2-verification.md) for the native foundation.
Git files are still untracked until the owner chooses to
stage/commit them; `git diff --check` alone does not inspect untracked files.
