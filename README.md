# CME Spatial Market Center

A planned Apple Vision Pro experience for CME Group customers: traders, brokers,
clearing members, and institutional clients. The initial product focuses on market
analysis, education, and simulated trading.

**Current milestone: Step 4a - paper trading, portfolio/risk, and a working 3D desk demo.**

The Windows prototype now includes a CME-style market dashboard with streaming
synthetic quotes, watchlists, charts, depth, movable spatial screens, and a fictional
paper account. It never connects to CME or a broker. The same dashboard is bundled inside the native
visionOS app, with no server or internet connection needed at runtime.

The native app opens the dashboard in a SwiftUI window using WebKit, and retains
the native workspace, companion window, and RealityKit volume. Native compilation
and simulator/device tests have not run on this Windows laptop. This is a local
prototype, not a production trading platform or a Windows visionOS emulator.

## Run the Windows preview

From the repository root, with Python 3 installed:

```powershell
python scripts/serve-preview.py
```

Open [the local preview](http://127.0.0.1:8765) in Chrome or Edge. If it is already
running, refresh the page to load the dashboard. Stop a foreground server with
Ctrl+C. No npm installation is needed to run the preview.

All assets and behavior are local. Every quote and trade print is generated demo
content, not exchange data. The preview cannot execute real orders. It is not a visionOS
simulator and does not emulate native gaze/pinch tracking. See
[preview instructions](apps/preview-web/README.md).

## Try the mock dashboard

- Select among seven demo markets across equity indexes, energy, metals, FX,
  interest rates, and agriculture. Search and filter by asset class.
- Star contracts to keep a custom watchlist in this browser.
- Switch between candles and an area chart; choose 15-minute, 1-hour, or 4-hour
  history. Hover or use arrow keys on the chart to inspect generated values.
- Review linked eight-level depth and simulated time-and-sales prints.
- Choose **Paper trading**, or **Paper trade this contract** on the market desk.
  Review and deliberately confirm a simulated buy/sell; no real order is sent.
- Open **Portfolio & risk** for positions, realized/unrealized P/L, fictional margin,
  asset-class allocation, and reviewed position-closing tickets.
- Open a chart screen with its own contract, a linked quote companion, or the
  spatial model. Drag title bars, or move them with arrow keys and Shift.
- Pause/resume the demo feed. In Settings, simulate an outage or restart the
  synthetic session. Interrupted screens keep their last timestamp and block paper
  fills. Restarting after paper activity asks before clearing the fictional ledger.

Names provide familiar context only. Demo contract IDs, prices, increments, and
liquidity are not official contract specifications. The prototype is not affiliated
with or endorsed by CME Group. There are no connected accounts, news feeds, or live
order tickets. Each tab starts with $100,000 in fictional USD. Paper balances,
positions, and fills stay in memory and reset on reload or confirmed reset; only
the browser watchlist persists. Tick values and margin amounts are invented, not
CME specifications. See the [paper-trading review guide](docs/development/step-4a-verification.md).

## Try all built features in 3D

Open [the interactive 3D desk](http://127.0.0.1:8765/?demo=3d), or choose **3D desk**
in the preview header. **Room view** shows the floating windows; **Focus desk**
brings the real dashboard forward for reading and interaction. Use the feature
selector for markets, paper trading, portfolio/risk, overview, workspace, and settings.

Move titles with the pointer or arrow keys. **View controls** adjusts zoom, angle,
and window arrangement. **Feature tour** walks through nine views without placing
orders or resetting your account. **Exit 3D** or Escape restores the flat window
layout; market and paper state stay intact. Paper confirmation remains deliberate.

The optional `npm.cmd run record:desk` command in `apps/preview-web` records this
working 3D interface with male narration and English subtitles, including a
scripted, isolated paper portfolio. See the [3D desk and video guide](docs/development/windows-3d-desk.md).
This is browser CSS 3D, not headset footage, native tracking, or stereoscopic video.

This workspace's [all-features video](http://127.0.0.1:8765/artifacts/videos/cme-spatial-market-center-all-features-3d.mp4)
is available locally: 3 minutes 18 seconds, 1080p, male narration, and English
subtitles. Generated videos are ignored by Git; the guide includes reproduction commands.

## Earlier cinematic concept video

A separate optional renderer presents the existing dashboard in a 3D room with
floating market panels, male narration, and subtitles. The output is a normal
1080p MP4, clearly labeled as Windows-rendered concept footage, not an actual
Vision Pro or visionOS Simulator recording. See the
[3D film guide](docs/development/windows-3d-film.md) to reproduce or review it.
That separate film predates the paper-trading and portfolio screens; use the
all-features desk recording for the current working prototype.

## Platform direction

The native stack is Swift, SwiftUI, and RealityKit, with local Swift packages for
shared modules. Apple describes these technologies in its
[visionOS development guide](https://developer.apple.com/visionos/).

Repository editing and the browser preview work on Windows. Native development and simulator
validation require an Apple-silicon Mac with Xcode and the visionOS SDK; see
[Apple's setup guide](https://developer.apple.com/documentation/visionos/creating-your-first-visionos-app).
The project pins Xcode 26.3, Swift 6 language mode, and a visionOS 2.0 deployment
target. The simulator baseline is visionOS 26.2.

## Open the app on a Mac

From the repository root, with Xcode 26.3 installed:

```sh
open apps/visionos/CMESpatialMarketCenter.xcodeproj
```

Install the visionOS 26.2 runtime, select the `CMESpatialMarketCenter` scheme and
**Apple Vision Pro (visionOS 26.2)**, then use **Run**. Copy the entire repository
to the Mac so local packages remain available. The dashboard resources are
already included; Node.js and the Windows preview server are not needed to run it.
See the [simulator run guide](docs/development/visionos-simulator.md) for setup,
tests, input controls, and troubleshooting.

## Native simulator prototype

- Offline CME-style dashboard in the main visionOS window, with startup/error/retry UI.
- File-only web resources, restricted navigation, no network APIs or native trading bridge.
- A temporary in-memory watchlist; closing or reloading the native desk resets it.
- The same session-only paper account and portfolio screens inside the bundled dashboard.
- Native workspace button opens the original overview, workspace, and settings screens.
- A separate companion window shares the native workspace's shell status.
- A resizable RealityKit volume showing three neutral display panels.
- Reproducible resource packaging, Chrome/WebKit bundle tests, native test targets, and CI.

The market charts and CSS spatial panels remain web content inside one native
window, not separate native chart windows or an immersive market scene. The
RealityKit volume is a separate neutral preview, not connected to the quote engine.
A full SwiftUI financial rewrite, calendar, education, voice search, account
connections, and real market feeds remain later work. Paper trading and portfolio
calculations currently use the shared JavaScript ledger, not native Swift views.

## Directory structure

```text
Vision_Pro/
|-- .github/                     Issue/PR templates and CI workflows
|-- apps/
|   |-- preview-web/             Windows synthetic dashboard and spatial screens
|   |   |-- market/              Demo fixtures, engine, chart rendering, and UI
|   |   |-- hosts/               Embedded visionOS layout adjustments
|   |   |-- scripts/             Native resource packager and demo recorder
|   |   `-- tests/               Model, packaging, browser, and WebKit tests
|   `-- visionos/
|       |-- Configuration/       Debug, release, and local signing settings
|       |-- CMESpatialMarketCenter.xcodeproj/
|       |-- CMESpatialMarketCenter/
|       |   |-- App/             App lifecycle and dependency composition
|       |   |-- Scenes/          Windows, volumes, and immersive presentation
|       |   |-- Features/
|       |   |   |-- Overview/     Implemented foundation screens
|       |   |   |-- TradingDesk/  Offline WebKit host and native desk controls
|       |   |   |-- Watchlists/
|       |   |   |-- Alerts/
|       |   |   |-- Charts/
|       |   |   |-- MarketDepth/
|       |   |   |-- PortfolioRisk/
|       |   |   |-- ContractCalendar/
|       |   |   |-- PaperTrading/
|       |   |   |-- MarketSearch/
|       |   |   |-- Education/
|       |   |   `-- Settings/
|       |   |-- Navigation/      Routing and window coordination
|       |   `-- Resources/       App assets, bundled dashboard, and localization
|       |-- CMESpatialMarketCenterTests/
|       `-- CMESpatialMarketCenterUITests/
|-- packages/
|   |-- MarketCore/              Data modes, source status, and freshness rules
|   |-- MarketData/              Read-only provider interface and local preview
|   |-- TradingSimulation/       Shared local paper ledger and precision tests
|   `-- SpatialUI/               SwiftUI components and RealityKit preview
|-- services/
|   `-- market-data-gateway/     Reserved read-only server boundary
|-- assets/                     Spatial source assets and design references
|-- config/                     Environment and configuration conventions
|-- data/                       Synthetic fixtures and future schemas
|-- docs/
|   |-- product/                Scope and approval-based milestones
|   |-- architecture/           Module boundaries and decision records
|   |-- development/            Local setup and validation
|   |-- security/               Product data and privacy requirements
|   `-- operations/             Release readiness and runbook location
|-- infrastructure/             Reserved deployment configuration
|-- scripts/                    Native validation and local preview server
|-- tests/                      Cross-module and nonfunctional validation
|-- AGENTS.md                   Instructions for coding assistants
|-- CONTRIBUTING.md             Contribution workflow
`-- SECURITY.md                 Private security reporting guidance
```

Reserved feature and test directories retain `.gitkeep` files. `MarketCore`,
`MarketData`, and `SpatialUI` have real package manifests and source targets.
`TradingSimulation` contains the dependency-free JavaScript paper ledger shared
by the Windows dashboard and offline native host; it is not a fourth Swift package.

## Initial product scope

- A spatial market desk with multiple chart and market-depth views.
- Watchlists, alerts, contract details, and an expiry calendar.
- Portfolio exposure, P/L, and clearly labeled margin/risk estimates.
- Paper trading and product education using synthetic data initially.
- Voice-assisted search and system-mediated gaze/selection navigation.
- Entitled, read-only delayed or live market data in a later approved milestone.

Live order execution is outside the first release. See the
[product scope](docs/product/scope.md) for the full mapping of the supplied idea.

## Review and next step

Review [Step 4a paper trading and portfolio/risk](docs/development/step-4a-verification.md).
Calendar, education, voice, and advanced order types wait for the next approval.
Native compilation and simulator/device validation still require the
[Mac run guide](docs/development/visionos-simulator.md); the
[simulator compatibility record](docs/development/step-3a-verification.md) describes
the original offline host milestone.
The [original Windows record](docs/development/step-3-verification.md) remains
available as the historical Step 3 verification.
See the [milestone plan](docs/product/roadmap.md).

## Repository baseline

- Git is initialized locally on `main`; no commit or remote is created.
- `.gitignore` excludes local secrets, signing material, and generated outputs.
- `.gitattributes` and `.editorconfig` establish portable text conventions.
- GitHub templates support changes and bug reports.
- GitHub workflows check committed whitespace, native tests, and browser tests.
  They have not executed because this repository has not been pushed to a remote.

See [development setup](docs/development/README.md),
[contribution guidance](CONTRIBUTING.md), and [security reporting](SECURITY.md).
