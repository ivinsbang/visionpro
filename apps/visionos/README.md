# visionOS application

Native `CMESpatialMarketCenter` application with an offline CME-style dashboard,
a shared Xcode project, and a shared scheme. Open
`CMESpatialMarketCenter.xcodeproj` on an Apple-silicon Mac with Xcode 26.3 and the
visionOS 26.2 simulator runtime. Compilation and Apple Simulator tests remain
unverified in the Windows workspace. See the
[simulator run guide](../../docs/development/visionos-simulator.md).

| Directory | Responsibility |
| --- | --- |
| `Configuration/` | Shared build settings and an optional local signing override |
| `CMESpatialMarketCenter/App/` | Entry point, dependency composition, app lifecycle |
| `CMESpatialMarketCenter/Scenes/` | Window, volume, and immersive scene declarations |
| `CMESpatialMarketCenter/Features/` | Offline TradingDesk host, overview/settings, and reserved future features |
| `CMESpatialMarketCenter/Navigation/` | Routes and coordinated window selection |
| `CMESpatialMarketCenter/Resources/` | Bundled dashboard, app assets, privacy manifest, and localization |
| `CMESpatialMarketCenterTests/` | App composition and presentation-state tests |
| `CMESpatialMarketCenterUITests/` | Native user journeys and accessibility checks |

The main window contains the shared HTML/CSS/JavaScript dashboard in a `WKWebView`.
Its seven demo markets, charts, book, tape, feed controls, and web panels use the
local synthetic engine. Step 4a includes reviewed paper tickets and a fictional
portfolio/risk dashboard using the shared JavaScript ledger in `TradingSimulation`,
not the reserved native Swift feature directories.
`BundledDashboard` locates required app resources and
restricts navigation to its entry page. WebKit receives read access only to the
dashboard resource directory; its content policy permits file-based assets and
blocks external scripts, images, fetches, frames, forms, and media. There are no
native JavaScript message handlers, broker integrations, or network fallbacks.

WebKit uses a nonpersistent data store; the native watchlist stays in JavaScript
memory only. Paper balances, positions, and fills are also memory-only.
Quitting the app or reloading the desk resets them. Reload requires confirmation and names
the paper state that will be lost.
Load failures and renderer termination show a retry screen instead of a blank view.

The app also links `MarketCore`, `MarketData`, and `SpatialUI`. **Native workspace**
opens the original overview, spatial workspace, and settings screens. That shell's
preview provider returns synthetic status with no quotes or event timestamp, and
shares it with the native companion. It is distinct from the dashboard's engine.
Value-based secondary windows reuse a matching window when opened repeatedly.
**Native volume** opens a neutral RealityKit three-panel model, not a price chart.
The dashboard's floating chart/quote/CSS panels remain inside the web view.
Its **3D desk** mode arranges those same working elements in a CSS perspective
scene and includes the feature tour. Exiting restores the flat dashboard without
resetting market or paper state.

**Enter 360° view** in the native toolbar opens a full immersive RealityKit room.
The interactive dashboard moves into the front attachment; five surrounding screens
show read-only market, depth, portfolio, risk/fills, and watchlist projections of
that same session. `DashboardSession` retains one web view across scene transitions.
**Return to window** restores the main window without clearing the ledger. See the
[360° run guide and native validation checklist](../../docs/development/visionos-360-view.md).

Runtime resources include an accent color catalog and a privacy manifest. No
microphone, real-account, broker, or external market-data access is implemented.
App Store icon artwork and localization remain future work.

Business rules and data providers belong in local packages. Reusable spatial UI
belongs in `packages/SpatialUI`. See
[development setup](../../docs/development/README.md) for build/test commands and
[the compatibility record](../../docs/development/step-3a-verification.md) for limits.

## Regenerate dashboard resources

The source of truth is `apps/preview-web`, not the generated `Resources/MarketDashboard`
directory. The paper ledger itself lives in `packages/TradingSimulation`; the
build synchronizes its browser copy before bundling. From `apps/preview-web`, after `npm ci`:

```sh
npm run build:visionos
npm run check:visionos
```

Use `npm.cmd` on Windows. Only the explicit runtime asset allowlist is packaged;
test dependencies, videos, recording helpers, and local files are excluded. The
Xcode project copies the generated folder intact, so no Node build phase or Python
server is required on the Mac. Include regenerated resources when sharing changes.
