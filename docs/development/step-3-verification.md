# Step 3 verification record

This records the original Windows delivery. The later, separately authorized
visionOS host is covered in [Step 3a verification](step-3a-verification.md).

## Delivered on Windows

The owner requested a Vision Pro-inspired, CME-style mock dashboard on the personal
Windows laptop, without touching real CME systems. `apps/preview-web` now includes:

- Seven synthetic demo markets, streaming quotes, source labels, and UTC timestamps.
- Search, asset filters, and a locally persisted custom watchlist.
- Candlestick/area charts, three time ranges, and pointer/keyboard inspection.
- Linked eight-level market depth and synthetic time-and-sales prints.
- An independent chart window, a linked quote companion, and three spatial market screens.
- Pause/resume, simulated feed interruption, local reconnection, and session restart.
- Responsive layout, reduced-motion support, window reuse/movement, and focus restoration.

All assets and market generation stay local. No CME API, broker, account, news,
order-routing, microphone, or customer-data integration is added. Display names
are familiar references; the demo parameters are not official contract specifications.

## Automated checks passed

Ran `npm.cmd test` in `apps/preview-web` on Windows with Node.js 22, Python 3, and
installed Google Chrome. All 24 tests pass:

- 8 Node.js unit tests verify seeded determinism, OHLC/depth/volume consistency
  across 500 updates, immutable snapshots, time gaps, input validation, candle
  aggregation, freshness states, and watchlist normalization.
- 16 Playwright tests verify streaming/pause/resume, linked contract selection,
  search/filtering, persistence including empty lists, malformed/blocked storage,
  chart controls/keyboard inspection, independent chart reuse, interruption and
  reconnection, session restart, navigation, window movement/focus, and narrow layouts.
- Dashboard journeys record resource requests and browser errors. No external
  requests or browser errors were observed; the server returns `connect-src 'none'`.
- JavaScript syntax checks pass. Desktop, detached-chart, and narrow-layout
  screenshots were reviewed; screenshot artifacts are ignored by Git.
- An installed Microsoft Edge smoke check passes for selection, chart switching,
  spatial screens, and rotation, with no browser errors or external requests.
- Implementation-file formatting, local documentation links, dependency lockfile,
  workflow pins, Git ignore rules, and loopback server isolation checks pass.

The owner's independently supplied project notes remain unchanged and are excluded
from implementation-file formatting checks, as recorded in the Step 2 verification.

GitHub CI uses the same test command, but has not run remotely: no remote or commit
has been configured. Local browser checks do not establish a native build result.

## Owner review

1. Open `http://127.0.0.1:8765`, refreshing any previously opened preview tab.
2. Select another contract and confirm the chart, depth, and tape follow it.
3. Star a contract, select Watchlist, and reload to verify the saved list.
4. Switch chart types/ranges; hover or use arrow keys to inspect a candle.
5. Open a chart screen and select a different contract from the main desk.
6. Open Spatial view, rotate the model, and move/close its window.
7. Pause the feed. In Settings simulate an outage, then reconnect from the desk;
   confirm that no real connection or order-entry workflow exists.

## Remaining boundaries

This is a browser prototype, not a visionOS simulator or a production market-data
service. Native financial screens are not implemented. Native compilation,
simulator/device tests, gaze/pinch, VoiceOver, comfort, and performance still require
the Apple toolchain and hardware. See [the native record](step-2-verification.md).

Paper trading, portfolios/risk, expiry/calendar, education, voice search, and any
external integration remain separate work. Wait for owner approval before Step 4.
