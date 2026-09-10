# Test organization

The current suites cover 44 model/packaging/film units, 36 browser journeys, and 18
bundled dashboard checks across Chrome and WebKit. Native package, app-unit,
resource-policy, and UI tests have not been executed in this
workspace; run `bash scripts/validate-native.sh test` on a supported Mac.
See [development setup](../docs/development/README.md).

| Location | Intended coverage |
| --- | --- |
| `apps/preview-web/tests/unit/` | Seeded markets, time gaps, aggregation, freshness, preferences, deterministic bundling, model synchronization, film timing, and manifest hashes |
| `packages/TradingSimulation/Tests/TradingSimulationTests/` | 17 Node tests for integer-tick/cents FIFO accounting, shorts/reversals, freshness, review tokens, caps, fictional margin, and reset isolation |
| `apps/preview-web/tests/*.spec.js` | Local-only resources, markets/charts, reviewed paper orders, portfolio/reset journeys, storage failures, and responsive layout |
| `apps/preview-web/tests/spatial-desk.spec.js` | Actual DOM/session reuse in 3D, independent windows, guided-tour safety, movement, camera controls, modal focus, mobile and compact layouts |
| `packages/MarketCore/Tests/` | Missing, stale, future, and invalid timestamp handling |
| `packages/MarketData/Tests/` | Synthetic/no-feed semantics and provider cancellation |
| `apps/preview-web/tests/visionos.spec.js` | Direct-file Chrome/WebKit loading, offline policy, session-only watchlist/paper accounts, paper/risk flows, and compact embedded controls |
| `apps/visionos/CMESpatialMarketCenterTests/` | Startup/recovery/cancellation, bundled resources, and file-navigation restrictions |
| `apps/visionos/CMESpatialMarketCenterUITests/` | Bundled desk readiness/pause, preview labeling, native navigation, and companion open/close |
| `tests/integration/` | Reserved cross-module and gateway/provider contracts |
| `tests/performance/` | Reserved feed throughput, rendering, memory, and device budgets |
| `tests/accessibility/` | Reserved manual accessibility and comfort scenarios |

For browser checks on Windows, run `npm.cmd ci`, `npx.cmd playwright install webkit`, and `npm.cmd test` in
`apps/preview-web`. They use installed Google Chrome, Node.js 22 or later, and
Python 3. The command runs shared ledger/model/packaging, browser, and bundled-dashboard suites;
use `test:unit`, `test:browser`, or `test:visionos` to focus a run. See
[browser instructions](../apps/preview-web/README.md#browser-tests).
Passing browser tests does not establish native app correctness or accessibility.

The 3D desk adds six layout/tour unit cases, four narrated-film timeline/caption
cases, eight browser journeys, and two additional journeys per bundled browser.
The optional recorded walkthrough is separately rehearsed and fully decoded with
FFmpeg; it is not produced during CI or counted as a native validation run.

`SpatialUI` has no standalone test target yet; its controls participate in the
native UI journeys. Visual appearance, volume sizing, repeated window opening,
gaze/pinch input, and VoiceOver still require simulator/device review.

The shared paper tests run in Node rather than a Swift test target. They cover
long/short FIFO marks and realized profit, exact FX tick arithmetic, duplicate or
expired confirmation, invalid/out-of-order quotes, low/negative-equity reductions,
bounded history, resets, and defensive snapshots. Browser journeys exercise actual
forms and dialogs, focus/cancellation, pause/outage handling, and responsive layouts.

Add meaningful tests with future features, especially expiry/time zones and any
expanded simulation assumptions. Native/shared fixtures belong in `data/fixtures`;
the browser's fictional quotes use `apps/preview-web/market/contracts.js`, and its
invented paper tick/margin parameters use `paper-trading-fixtures.js` alongside it.

Record simulator versus device coverage accurately. Performance and interaction
budgets should be measured on target hardware when native implementation exists.
