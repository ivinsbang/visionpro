# Architecture

The native visionOS application composes the local Swift modules `MarketCore`,
`MarketData`, and `SpatialUI`. Step 4a adds a dependency-free JavaScript paper ledger
under `TradingSimulation`, shared by the browser and bundled WebKit dashboard.
It does not introduce an empty Swift target or duplicate financial implementation.

## Dependency direction

```text
CMESpatialMarketCenter app
|-- DashboardWebView ------> bundled synthetic browser dashboard
|-- MarketCore
|-- MarketData -----------> MarketCore
`-- SpatialUI

MarketData ----> offline preview status in Step 2
           |--> synthetic market fixtures when native financial screens are approved
           `--> read-only market-data gateway in a later approved milestone

Shared dashboard ----> paper workspace ----> TradingSimulation (JavaScript)
                               `----------> fictional contract parameters
```

The app composes a preview provider and passes shared state into views.
`MarketCore` owns data-mode/source/freshness types without UI or vendor dependencies.
`MarketData` returns a synthetic source description without inventing event times
or quotes. `SpatialUI` contains reusable presentation without network or account
access. The paper ledger consumes supplied synthetic snapshots and injected
contract parameters without UI, storage, networking, or execution-venue dependencies.

`WorkspaceModel` uses Observation with main-actor isolation. Loading is explicit;
duplicate startup loads are suppressed, failures clear prior status, and cancelled
loads return to idle. The native companion and native workspace share this model;
the main market dashboard has its own JavaScript synthetic engine.

Feature directories own views and presentation state. Window coordination belongs
in `Navigation`, while scene declarations belong in `Scenes`. The foundation uses
three planar window groups and one neutral volumetric preview. Value-based secondary window
groups avoid creating another copy for the same window value. The preview fits its
geometry to the available volume bounds. No third-party state library is used.

## Windows review companion

`apps/preview-web` implements the Windows mock dashboard with HTML, CSS, and
JavaScript. Its runtime has no npm dependencies. A Python standard-library server
serves that directory on loopback only; page assets are local, and a content
security policy disables fetch/WebSocket connections. The companion has no gateway,
real-account access, or native-code bridge. Playwright supports tests and optional
local recordings, not the normal dashboard runtime.

`market/contracts.js` defines seven fictional demo markets. `market/simulator.js`
owns seeded generation, integer price increments, bounded OHLC history/depth/tape,
aggregation, and freshness. `market/chart.js` renders local SVG; `market/dashboard.js`
composes shared snapshots, watchlist preferences, and feed controls. The main chart,
book, tape, companion, and spatial screens share a snapshot; the detached chart
selects an independent contract. Watchlist symbols are the only persisted state.
See [the browser module](../../apps/preview-web/market/README.md).

`market/paper-trading.js` composes the paper ticket and portfolio screens.
`packages/TradingSimulation/Sources/TradingSimulation/paper-trading.mjs` owns
integer-tick/integer-cent FIFO accounting, review tokens, confirmation guards,
and in-memory account snapshots. A checked, generated browser copy allows the
loopback server to keep serving only `apps/preview-web`. `build:visionos` synchronizes
that copy before bundling; tests reject divergence. Fixture tick values and margin
amounts are explicitly invented rather than exchange specifications.

The market dashboard supplies quote/feed updates and asks the paper workspace
before restarting a session with fills. A confirmed restart resets both engines;
layout/navigation changes do not. Paper state is never persisted in either host.
See [ledger assumptions and boundaries](../../packages/TradingSimulation/README.md).

The browser's CSS spatial model and mouse/keyboard controls support local visual
review. They do not emulate the visionOS runtime or validate SwiftUI/RealityKit.

The all-features 3D desk in `spatial/desk.js` moves the existing dashboard and
floating-window elements into a CSS perspective scene, using temporary origin
markers to restore them on exit. It does not clone pages, create iframes, or start
another market engine or paper ledger. `spatial/desk-layout.js` contains bounded
layout/camera math and the declarative feature tour; `spatial/desk.css` handles
presentation and reduced motion. Titles support pointer and keyboard movement.
Focus mode makes the real controls readable; paper dialogs remain in the browser's
top layer. Restoring panel styles uses CSSOM without weakening the content policy.

The optional `record:desk` helper captures that actual browser interface in an
isolated profile. It reuses the local speech helper and measured subtitle timeline;
FFmpeg adds male narration and captions. It is distinct from the earlier Three.js
concept renderer, which presents held screenshots inside a separately rendered room.

## Offline visionOS dashboard host

Step 3a adds `Features/TradingDesk`: a SwiftUI main desk, an isolated `WKWebView`
adapter, and a bundled-resource/navigation policy. WebKit loads the generated
`Resources/MarketDashboard/index.html` with read access limited to that directory.
A file-only content policy blocks remote assets and connections. The data store is
nonpersistent, and the native-host watchlist uses memory rather than local storage.
Readiness is checked after JavaScript startup; load/process failures show a retry UI.

The same browser engine is bundled with pinned esbuild, not rewritten into the
native `MarketData` provider. There is no native JavaScript message bridge. Native
workspace and volume controls open real system windows; the dashboard's floating
panels remain inside the web view. See the
[offline host decision](decisions/0002-offline-dashboard-host.md).

## Data and operational boundaries

Future approved native quotes and contract metadata will flow from a provider
through `MarketData` to app state and views. Current paper orders flow only from
the dashboard's reviewed ticket to `TradingSimulation`, returning fictional fills
and account snapshots. There is no broker adapter or native trading bridge.

The future gateway is a server boundary for provider secrets and data entitlements.
It is not required for the synthetic prototype. Its stack and infrastructure are
deferred until data integration is approved.

Keep provider provenance, event timestamps, freshness, and display units available
throughout the data path. Financial precision, rounding, time zones, contract
multipliers, and expiry conventions must be explicit when domain logic is added.

See [module responsibilities](../../packages/README.md),
[test organization](../../tests/README.md), and
[the native platform decision](decisions/0001-native-visionos.md).
