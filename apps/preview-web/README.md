# Windows CME-style mock dashboard

A Vision Pro-inspired market dashboard for the personal Windows laptop. It needs
only Python 3 and a browser to run. Quotes, charts, order-book levels, and trade
prints are generated locally. All fonts, assets, and behavior are local; the
server's content security policy blocks fetch/WebSocket connections. There are no
CME APIs, vendor SDKs, broker accounts, credentials, or order-routing code.

From the repository root:

```powershell
python scripts/serve-preview.py
```

Open <http://127.0.0.1:8765> in Chrome or Edge. Use `--port 8766` if the default port
is occupied. The server binds only to this computer and serves only this preview
directory. Stop a foreground server with Ctrl+C.

If a previous preview tab is open, refresh it to load the dashboard. Do not start
another server if the URL already works. This server is for local review only.

## Browser tests

Testing additionally requires Node.js 22 or later and an installed Google Chrome.
From the repository root on Windows:

```powershell
Set-Location apps/preview-web
npm.cmd ci
npx.cmd playwright install webkit
npm.cmd test
```

`npm.cmd test` runs 44 model/packaging/film unit tests, 36 browser tests, and 18 bundled
dashboard tests across Chrome and Playwright WebKit. Use `test:unit`, `test:browser`,
or `test:visionos` for a focused run. Linux WebKit needs
`npx playwright install --with-deps webkit`.
On macOS/Linux use `npm` instead of `npm.cmd`, with `python3` available. Playwright
starts the server when needed; its version is pinned in `package.json` and
`package-lock.json` as a development-only dependency. Screenshots and browser test
outputs are ignored under `artifacts/preview-tests` and `artifacts/bundled-dashboard-tests`.

The bundled tests open files directly, without a server. Chrome uses offline
emulation. WebKit instead rejects all HTTP(S) routes because its Windows test
port fails even local-file loads when offline emulation is enabled. Both suites
assert no unexpected external requests; explicit CSP tests verify remote resources
are blocked. Playwright WebKit is not Apple's visionOS runtime.

## Build the native resource bundle

From this directory after `npm.cmd ci`:

```powershell
npm.cmd run build:visionos
npm.cmd run check:visionos
```

Pinned esbuild produces an offline classic-script/CSS bundle in the native app's
`Resources/MarketDashboard` folder. Xcode copies those included assets without
requiring Node.js or the preview server on the Mac. Always regenerate them after
changing shared runtime source; `check:visionos` fails if resources are stale.
Do not edit generated files by hand. See the
[visionOS simulator guide](../../docs/development/visionos-simulator.md).

The canonical paper ledger is
`packages/TradingSimulation/Sources/TradingSimulation/paper-trading.mjs` at the
repository root. `build:visionos` first synchronizes its generated browser copy;
`build:simulation` does just that copy, and `check:simulation` checks it without
writing. The shared ledger and copy must be included together in source changes.

## Reviewable behavior

- Explore Market desk, Paper trading, Portfolio & risk, Overview, Spatial workspace,
  and Settings.
- Select ES, NQ, CL, GC, 6E, SR3, or ZC demo contracts. Search by name/symbol and
  filter by asset class. Star contracts, then choose Watchlist to see only saved markets.
- Inspect linked candles/area charts, eight-level depth, and generated trade prints.
  Choose 15m, 1h, or 4h; hover or focus the chart and use arrows, Home, End, or Escape.
- Open a paper ticket for the selected market, choose buy/sell and an integer
  quantity, then review and confirm. Review and cancellation alone never create fills.
- Track positions, FIFO realized/unrealized P/L, fictional margin usage, exposure,
  and asset-class allocation. Close/reduce buttons prefill a ticket for review.
- Open, focus, move, and close independent chart, companion, and spatial windows.
  The chart screen has its own contract selector; the companion follows the main desk.
- Drag a window title bar, or focus it and use arrow keys to move it.
- Change the 3D model's viewing angle with the slider.
- Pause/resume the demo feed. Settings can simulate an outage, refresh status, or
  restart the session. An outage freezes all quotes and preserves their generated
  timestamps while marking the snapshots stale. Reconnect uses only the local engine.
- Reset layout closes windows and returns to the desk without changing the watchlist,
  feed mode, or paper account. A session restart resets generated prices and the
  paper ledger, asking for confirmation if fills exist, but preserves saved markets.
- Reset paper account requires confirmation and restores the fictional starting
  balance without resetting quotes or watchlist. Reloading the page also clears paper state.
- Review the layout on a narrow viewport and with reduced motion enabled.
- Choose **3D desk** for a panoramic arrangement of the actual working windows.
  Focus a window, explore any built feature, adjust the camera, or follow the
  nine-step feature tour. No iframe, duplicate market engine, or separate ledger is used.

The preview uses HTML, CSS, and JavaScript. It is not a visionOS simulator and
does not emulate native gaze/pinch tracking or validate SwiftUI/RealityKit code.
The native implementation is in [apps/visionos](../visionos/README.md).

## Interactive 3D desk

Open [the 3D demo directly](http://127.0.0.1:8765/?demo=3d). It reuses the live DOM
and event handlers, including paper review/confirmation and the portfolio. Desktop
entry shows a curved room; narrow entry focuses the main window for readability.

- **Focus desk** or the window selector brings a panel forward. The feature
  selector opens any existing page in that main panel.
- Drag a title or focus it and use arrows; Shift makes larger moves.
- **View controls** exposes zoom, horizontal/vertical angle, curved/flat arrangement,
  and recentering. Recenter changes layout only.
- **Feature tour** covers the built tools without creating trades, changing the
  watchlist, or resetting financial state. Follow its prompts to try controls yourself.
- **Exit 3D** or Escape restores the previous flat windows and positions. An open
  paper dialog handles Escape first; cancelling it does not exit the room.

There are no new financial features or runtime dependencies in this presentation.
The same resources are included in the native web bundle, not converted to native
volumes or system windows. See the [3D desk guide](../../docs/development/windows-3d-desk.md).

## Data and storage limits

The engine starts with four hours of seeded, synthetic history and emits a new
snapshot every 1.5 seconds while streaming. It is deterministic for a given seed
and clock. Timestamps use the laptop clock in UTC, not an exchange clock. Gaps
caused by a pause/outage are not backfilled with invented trades.

Product names are familiar references, not a claim that a real listed contract is
connected. The `-DEMO` IDs, prices, reference values, increments, units, volumes,
and depth are illustrative parameters, not official specifications or settlement
data. Percent changes compare with a fixed demo reference, not a real prior close.
There is no expiry calendar, news, voice, or live-execution workflow. Paper orders
and the illustrative portfolio/risk view use invented tick values and fixed margin
amounts, not CME contract specifications or an official margin model.

Each tab starts with $100,000 in fictional USD. Market orders fill in full at the
latest fresh synthetic ask for buys or bid for sells after explicit confirmation.
Limits are 20 contracts per order and 100 net contracts per symbol; reviews expire
after 15 seconds, and quotes older than five seconds cannot be used for a fill.
Paused/interrupted data blocks orders while retaining the last portfolio marks.
Added exposure must fit the fictional available equity; risk-reducing closes remain
possible even when equity is negative. Fees, slippage, partial fills, maintenance
margin, settlement, FX conversion, and automatic liquidation are not modeled.

Only the watchlist is persisted, under `cme-spatial-demo.watchlist.v1` in this
browser's local storage. It contains demo symbols only. Reload resets the synthetic
session and paper account. Paper balances, positions, and fills are never stored.
Invalid preferences fall back safely; blocked storage keeps edits in
memory for the current tab and displays a notice. No preferences leave the browser.

The visionOS host reuses this dashboard but deliberately keeps its watchlist only
in memory. It does not use file-origin local storage; closing or reloading that
desk resets preferences. Browser and native sessions are separate.

This is a local prototype, not a CME service or production trading platform.
Step 4a adds only shared offline paper trading and portfolio/risk. A full SwiftUI
financial rewrite, calendar, education, voice, and advanced orders wait for review.
See [implementation details](market/README.md) and the
[current review guide](../../docs/development/step-4a-verification.md).

## Record a walkthrough

For the current all-features 3D recording with male narration and subtitles, run
`npm.cmd run record:desk`; `npm.cmd run record:desk -- --preview` rehearses its
actions and captures stills first. Both use an isolated browser session. See the
[current recording guide](../../docs/development/windows-3d-desk.md#record-the-full-walkthrough).
The older recorder below remains a silent, market-focused walkthrough.

The optional recorder captures only this app in a separate headless Chrome profile,
not the desktop or an existing browser session. It creates a captioned, silent
1920x1080 H.264 MP4, a poster, a storyboard, and chapter metadata in ignored
`artifacts/videos`. Synthetic-data labels remain visible throughout.
A second, ignored MP4 copy under `apps/preview-web/artifacts/videos` provides a
playback URL through the existing loopback preview server. Nothing is uploaded.

Start the local server first. Recording uses the existing Node/Playwright test
dependencies, Playwright's FFmpeg helper, and an MP4-capable FFmpeg encoder.
Set `FFMPEG_PATH` to an encoder with `libx264`, or optionally install a portable
encoder into the repository's ignored cache from the repository root:

```powershell
python -m pip install --target .cache/video-tools imageio-ffmpeg==0.6.0
Set-Location apps/preview-web
npm.cmd ci
npx.cmd playwright install ffmpeg
npm.cmd run record:demo
```

Recording takes approximately 90 seconds plus encoding time. It blocks non-local
page requests, checks browser errors, decodes the resulting MP4 for validation,
and prints its final path. Repeated runs keep prior exports. Recording-specific
captions and the pointer are injected only into the recording browser; normal app
appearance and the owner's watchlist are unchanged.

## Render a narrated 3D concept film

The separate `npm.cmd run record:spatial` command creates a Windows-rendered 3D
room with floating market screens, the existing dashboard captured as a texture,
an illustrative depth model, offline male narration, and burned-in English
subtitles. The exported 1080p MP4 plays in a normal Windows video player; SRT and
VTT sidecars are included. This is not a physical Vision Pro recording, a visionOS
Simulator recording, or stereoscopic video.

The renderer uses the development-only, pinned Three.js dependency. It does not
change the normal dashboard or the native resource bundle. No market service,
cloud renderer, online speech service, or external asset host is contacted during
recording. See the [3D film guide](../../docs/development/windows-3d-film.md) for
Windows voice prerequisites, review-only frames, output paths, and reproduction.
