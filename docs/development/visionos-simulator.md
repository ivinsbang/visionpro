# Run the offline visionOS prototype

## What this adds

The existing CME-style dashboard is packaged inside the native visionOS app. The
main SwiftUI window hosts a local `WKWebView`; no Windows server, CME connection,
broker account, or internet access is required by the running dashboard.
The included Step 4a web screens add a session-only paper account and illustrative
portfolio/risk, not a SwiftUI financial rewrite or live execution.

For screens surrounding you, rebuild this version and choose **Enter 360° view**
in the native toolbar. The new RealityKit room places six screens around the viewer
while preserving the shared session. See the [360° view guide](visionos-360-view.md)
for camera controls, screen positions, and the required Mac validation.

This is simulator-targeted source, not a verified native binary. Windows checks
exercise the web assets and project structure, not Apple's simulator or SDK.

## Requirements

- An Apple-silicon Mac. Apple's visionOS simulator cannot run on Windows.
- Xcode **26.3**, the repository's pinned toolchain, on a supported macOS version
  (Sequoia 15.6 through the supported Tahoe 26.x versions).
- The **visionOS 26.2** simulator runtime installed in Xcode settings.
- The entire repository, including `packages` and the generated dashboard folder.

The app's deployment target remains visionOS 2.0; the selected simulator baseline
is 26.2. The simulator build does not need a signing team or CME credentials.
Node.js and Python are only needed for optional web development/checks, not to
build the included app resources in Xcode.

See Apple's [visionOS setup guide](https://developer.apple.com/documentation/visionos/creating-your-first-visionos-app)
and [Xcode requirements](https://developer.apple.com/xcode/system-requirements).

## Windows transfer preflight: 2026-09-09

The owner requested a fresh cross-check before moving the prototype to a Mac.
No missing source, resource, package, or shared-scheme references were found:

- All 104 Xcode project objects were checked for valid references. Source/resource
  paths were checked with exact filename casing, and all 16 app/test Swift files
  belong to the correct compile targets. The three Swift packages use local paths.
- All 25 Swift files, including package manifests and tests, passed an auxiliary
  syntax parser. This is not Swift compilation, SDK availability checking, or
  Swift 6 concurrency type-checking.
- All 98 Windows automated tests passed again: 44 unit tests, 36 browser journeys,
  and 18 bundled-dashboard journeys in Chrome and Playwright WebKit.
- The five bundled resources match all 18 recorded source hashes. The property
  lists, asset metadata, shared scheme, and native script's shell syntax passed
  structural checks. The script correctly refuses native validation on Windows.

No native source correction was identified by this preflight. Xcode compilation,
Apple Simulator execution, and headset behavior remain unverified; these results
do not guarantee a clean first Mac build. Run the native checks below on the Mac.

## Launch in Xcode

1. Copy the complete `Vision_Pro` repository from Windows to the Mac, preserving
   relative paths. Do not copy only the `.xcodeproj` folder.
2. Install the visionOS 26.2 runtime from Xcode's platform/component settings.
3. Open `apps/visionos/CMESpatialMarketCenter.xcodeproj`.
4. Select scheme **CMESpatialMarketCenter** and destination
   **Apple Vision Pro (visionOS 26.2)**, not a physical device or generic device.
5. Choose **Product > Run** (`Command-R`). The main window should show
   **Offline synthetic desk**, then **Ready · No CME connection** and the dashboard.

Opening the project from a Mac terminal, at the repository root:

```sh
open apps/visionos/CMESpatialMarketCenter.xcodeproj
```

You can omit generated `node_modules`, `.cache`, `artifacts`, `.build`,
`DerivedData`, and `xcuserdata` directories when copying. Keep the source tree and
the generated `CMESpatialMarketCenter/Resources/MarketDashboard` folder intact.
Do not reuse Windows Node dependencies on macOS; if you later edit or rebundle the
web dashboard on the Mac, run `npm ci` in `apps/preview-web` there first. They are
not needed to build the already bundled dashboard in Xcode.

No local HTTP server is used. The resource folder is part of Copy Bundle Resources
and is loaded with `loadFileURL`, with read access restricted to that folder.

## Simulator smoke test

1. Confirm **SYNTHETIC DATA** and **Not a CME feed** remain visible. Prices and
   generated UTC timestamps should update approximately every 1.5 seconds.
2. Select CL or NQ. Confirm the price, main chart, depth, and trade prints change
   together. Change candle/area mode and chart range.
3. Star ZC and switch to Watchlist. In the native app, these preferences exist only
   in the app session's memory. Quitting or reloading resets them; navigating
   between web pages, opening the native workspace, or entering/leaving 360° does not.
4. Open a chart screen, select GC there, and confirm the main desk keeps its own
   selection. Move its title with the pointer or arrow keys; Shift moves farther.
5. Pause the feed and confirm timestamps stop changing. In the dashboard's
   Settings, simulate an outage; return to Market desk and reconnect the demo feed.
   This acts only on the local generator, not on an actual connection.
6. Open the dashboard's Spatial view and rotate the CSS market model. These panels
   stay inside the app window. Use **Native volume** in the top native controls to
   open the separate RealityKit preview, which has neutral panels rather than prices.
7. Open **Native workspace**. Explore its overview/settings screens, open/close the
   native companion, and open the workspace repeatedly to check window reuse.
   This shell's status provider is separate from the JavaScript market generator.
8. Resize the main window and scroll to the bottom of Market desk, Paper trading,
   Portfolio & risk, Overview, Spatial workspace, and Settings. The final content
   and the "Synthetic environment" footer must be reachable on every page,
   including at the minimum window size. Switch tabs while scrolled down and
   confirm the new page starts at the top. The flat bundled desk uses document
   scrolling through WebKit's main scroll view; the 3D desk keeps scrolling inside
   its floating panels. Use the system window bar to move the whole app in Simulator.
9. Open **Paper trading**, review a one-contract buy, cancel it, then review again
   and confirm. Only the confirmation should create a labeled paper fill. Inspect
   the resulting position, P/L, and fictional margin in **Portfolio & risk**.
10. Pause the feed and return to Paper trading. Review/confirm must be disabled;
    Portfolio & risk must retain its last marks and indicate held data. Resume,
    then use Close on the position and verify it opens a reviewed opposite ticket.
11. Cancel an account reset and a market-session restart after paper activity;
    both should preserve the ledger. Confirm a paper reset and verify the balance
    returns to $100,000 fictional USD without changing the watchlist or feed.
12. Choose **Reload desk**, cancel once, then confirm a reload. A confirmed reload
    resets the synthetic session, temporary watchlist, paper account, and open web panels.
13. Disconnect the Mac's network and relaunch the app. The included dashboard
    should still load. Record the actual native result before claiming validation.
14. Enter **3D desk** in the web header. Focus the market window, try the feature
    selector and tour, then review/cancel a paper order. Confirm Escape cancels the
    dialog before exiting 3D, and exit preserves the paper account. The panorama
    remains CSS content inside this web view, not new native system windows.
15. Choose **Enter 360° view** in the native toolbar. Turn the simulator camera
    through a full circle, inspect the five surrounding summaries, then choose
    **Return to window**. Follow the [360° checks](visionos-360-view.md#validation)
    to verify paper-state continuity, native attachment input, and system dismissal.

Simulator uses mouse/trackpad and keyboard input. Gaze/pinch comfort, VoiceOver,
performance, and actual spatial interaction still need Apple Vision Pro testing.
No raw eye/hand tracking, voice search, or real order
routing is implemented. Windows browser checks of these paper workflows are not
native Simulator tests; record the Mac smoke-test result separately.

## Automated native checks

From the repository root on the Mac:

```sh
export DEVELOPER_DIR="/Applications/Xcode_26.3.app/Contents/Developer"
bash scripts/validate-native.sh test
```

If the installation is named `Xcode.app`, change `DEVELOPER_DIR` accordingly. The
script requires version 26.3, checks resource presence, runs package tests, and
builds/tests the native app and UI on Apple Vision Pro with visionOS 26.2. Signing
is disabled for this simulator path. Results go to `artifacts/NativeTests-*.xcresult`.

To build app/test bundles without launching Simulator:

```sh
bash scripts/validate-native.sh build
```

To inspect available destinations:

```sh
xcrun simctl list devices available
xcodebuild -showdestinations \
  -project apps/visionos/CMESpatialMarketCenter.xcodeproj \
  -scheme CMESpatialMarketCenter
```

Override `VISION_PRO_DESTINATION` if using a differently named installed simulator.
A successful browser or packaging test is not a substitute for these native checks.

## Updating the dashboard

Edit shared source in `apps/preview-web`, then run there on Windows:

```powershell
npm.cmd ci
npm.cmd run build:visionos
npm.cmd run check:visionos
npx.cmd playwright install webkit
npm.cmd test
```

Use `npm`/`npx` on macOS or Linux. Do not hand-edit generated files under
`apps/visionos/CMESpatialMarketCenter/Resources/MarketDashboard`.
The paper model's source of truth is `packages/TradingSimulation`; `build:visionos`
synchronizes its checked browser copy before generating the native resources.

The packager uses pinned esbuild to produce a classic script and Safari-17-targeted
CSS/JavaScript. This avoids requiring file-origin ES module imports or a development
server. A deterministic SHA-256 manifest and `check:visionos` detect stale resources.
Only the approved runtime files are copied; no videos, tests, dependencies, personal
files, or credentials belong in the app bundle.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| No Apple Vision Pro destination | Install the visionOS runtime and verify this is an Apple-silicon Mac. |
| Missing local package | Copy the entire repository and preserve its directory structure. |
| Xcode requests a signing team | Select a simulator, not a device; the command-line validation script disables signing. |
| Dashboard assets missing | Run `build:visionos` from `apps/preview-web`, copy the generated folder, and rebuild. |
| Old dashboard after web edits | Regenerate resources and rebuild/relaunch the native app; refreshing the Windows browser is separate. |
| Local dashboard initialization/renderer failure | Use Retry or Reload desk; record the Xcode console error if it persists. There is no network fallback. |
| Watchlist resets | Expected for the native in-memory session; the Windows browser has separate local-storage persistence. |
| Paper account resets after reload | Expected in both hosts; balances, positions, and fills are session-only and never persisted. |
| Paper confirmation is disabled | Resume fresh synthetic data, refresh an expired review, and check the quantity and fictional margin messages. |
| Native companion says no market data loaded | Expected shell status; it is not linked to the JavaScript dashboard's quote engine. |

See the [original host record](step-3a-verification.md) and
[Step 4a verification](step-4a-verification.md) for what has actually run.
