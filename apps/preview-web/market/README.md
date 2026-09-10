# Synthetic market module

This shared browser module supplies the Windows and bundled CME-style mock dashboard. It has no network
client, credentials, broker integration, or dependency on the native Swift modules.

| File | Responsibility |
| --- | --- |
| `contracts.js` | Seven fictional demo contract definitions and watchlist normalization |
| `simulator.js` | Seeded quotes, OHLC history, depth, trade prints, aggregation, and freshness |
| `chart.js` | Local SVG charts, sparklines, formatting, and pointer/keyboard inspection |
| `dashboard.js` | Shared screen state, selection, local watchlist storage, and feed controls |
| `dashboard.css` | Dashboard, chart, depth, and responsive presentation |
| `paper-trading.js` | Reviewed tickets, session reset controls, and portfolio/risk presentation |
| `paper-trading-model.js` | Generated copy of the shared dependency-free paper ledger; do not edit |
| `paper-trading-fixtures.js` | Explicitly fictional USD tick values and fixed margin amounts |
| `paper-trading.css` | Paper ticket, confirmation dialogs, portfolio cards, and responsive tables |

The dependency direction is `dashboard -> chart/simulator/contracts`,
`chart -> simulator`, and `simulator -> contracts`. `app.js` owns navigation and
floating-window movement and composes the paper workspace with market callbacks.
The paper workspace consumes the model and fixtures; the model has no UI, storage,
market-generator, or network dependency. Viewing the included preview requires no build.

Edit the ledger in `packages/TradingSimulation/Sources/TradingSimulation/paper-trading.mjs`
at the repository root, then run `npm.cmd run build:simulation` from the parent
`apps/preview-web` directory, or `npm.cmd run build:visionos` to update both hosts.
Tests check the browser copy against the shared source. See the
[ledger guide](../../../packages/TradingSimulation/README.md).

## Simulation contract

- Prices are maintained as integer counts of each fictional contract's increment,
  then converted to display precision. Parameters are not official exchange specs.
- A seeded generator creates 240 one-minute bars per market. Streaming adds one
  generated print per market per 1.5-second UI interval, updates OHLC/volume, and
  rebuilds eight sorted depth levels per side. Bid and ask levels do not cross.
- History is capped at 240 bars and the tape at 12 prints per market. Demo session
  volume/high/low include earlier generated history, even after it leaves the chart.
- Snapshot data is copied so rendering cannot mutate engine state.
- Event time must advance. A new minute starts a bar at the last generated price.
  Paused or interrupted intervals are not filled with fabricated intermediate events.
- Chart ranges show 15 or 60 one-minute bars, or four-minute aggregates over a
  four-hour range. Aggregation preserves OHLC extremes and volume. UTC bucket labels
  can precede the first event in a partially populated bucket.
- Percent change uses a fixed fictional reference value. The display does not
  claim a live price, official settlement, tradable expiry, or executable liquidity.

## Interaction state

One synthetic snapshot feeds the main chart, depth, tape, linked companion, and
three spatial screens. The detached chart chooses a different contract from that
same snapshot. Window positions are held in memory, not saved as user profiles.

The feed has streaming, paused, and disconnected-demo states. A snapshot older
than five seconds is stale while streaming; pause and interruption retain the
original generated timestamp. No control can enable an external data provider.

The only persistent setting is a validated array of known watchlist symbols in
browser local storage. Empty lists are intentional; malformed data is not trusted.
Storage write failures are surfaced without breaking the current tab's interaction.

The paper account is memory-only in both hosts. Quote/feed updates drive its marks;
paper review and confirmation independently check freshness, quantity, expiry,
position caps, and fictional margin. FIFO lots use integer price ticks and USD cents.
Portfolio rows remain stable during streaming so position-action keyboard focus
is not replaced on each tick. Only completed fills change the fill-history rows.

Layout reset and page navigation preserve the ledger. A market-session restart
asks before clearing existing paper activity, then resets quotes and paper state
together. The separate confirmed paper reset clears only its account and history.
Neither reset removes the browser watchlist.

Run `npm.cmd test` from `apps/preview-web` on Windows, or `npm test` on macOS/Linux.
Simulator tests use a fixed seed and clock; browser tests include controlled time,
local-only request checks, keyboard input, outages, storage failures, and narrow layouts.
