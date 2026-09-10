# Local paper-trading ledger

Step 4a's reusable simulation domain is dependency-free JavaScript, used by the
Windows browser dashboard and the same offline dashboard bundled in visionOS.
It has no network, UI, storage, vendor SDK, native bridge, or global-clock dependency.
It is not a Swift package and does not require an empty `Package.swift` target.

## Source and generated copy

- Canonical model: `Sources/TradingSimulation/paper-trading.mjs`.
- Node tests: `Tests/TradingSimulationTests/paper-trading.test.mjs`.
- Generated browser copy: `apps/preview-web/market/paper-trading-model.js` from
  the repository root. Do not edit that copy directly.
- Invented UI parameters: `apps/preview-web/market/paper-trading-fixtures.js`.

The local server serves only the browser directory, not the repository or packages.
Synchronizing this one model preserves that boundary without maintaining two ledgers.
From `apps/preview-web`:

```powershell
npm.cmd run build:simulation
npm.cmd run check:simulation
npm.cmd run test:unit
npm.cmd run build:visionos
```

`build:visionos` also synchronizes the model. Tests check source/copy equality and
the native manifest hash; verification rejects stale resources. Use `npm` on a Mac.

## Domain contract

`PaperTradingSession` receives validated, fictional contract definitions. Callers
supply synthetic snapshots, feed mode, and time; the ledger never fetches a quote
or reads a browser preference. All configured markets must have valid, non-crossed
bid/ask levels and increment-aligned marks from the `Local synthetic engine`.
Invalid, non-synthetic, or older snapshots preserve held marks but block orders.

- `updateMarket(snapshot, mode)` updates validated marks and feed state.
- `feedStatus(now)` reports freshness and a reason when ordering is unavailable.
- `reviewOrder(order, now)` validates a market order and returns an expiring token
  and estimate without mutating the account.
- `currentReview(now)` recomputes the estimate and whether confirmation is allowed.
- `confirmOrder(token, now)` rechecks all conditions and consumes a token once.
- `cancelReview()` clears the pending review without creating a fill.
- `snapshot(now)` returns copied account, position, quote, and bounded fill data.
- `reset()` restores the fictional account while keeping market marks;
  `reset({ clearMarket: true })` also clears the feed on a market-session restart.

## Explicit simulation assumptions

Every amount is fictional demo USD. Tick values and fixed margin parameters are
invented, not CME contract specifications, SPAN calculations, or financial advice.

- Initial cash ledger: $100,000. No real deposit or account is involved.
- Market orders only, with integer quantities from 1 through 20 per order and
  at most 100 net contracts per symbol.
- Reviews expire after 15 seconds. Streaming quotes must be no older than five
  seconds; paused, interrupted, unavailable, future, or invalid quotes cannot fill.
- Confirmation fills the full quantity at the latest synthetic ask for a buy or
  bid for a sell. Review prices are indicative, not locked. There is no depth
  consumption, queue model, partial fill, slippage, or fee.
- Prices are integer ticks; monetary calculations use integer USD cents.
  FIFO lots realize profit on closing quantities and support shorts and reversals.
- Balance = starting balance + realized P/L. Unrealized P/L marks remaining lots
  to the latest synthetic last price. Equity = balance + unrealized P/L.
- Margin = sum of absolute net contracts multiplied by each fictional fixed
  margin amount. Free equity = equity - margin. No cross-market offsets apply.
- Gross exposure sums absolute net contracts multiplied by mark ticks and the
  fictional tick value. This is not a real contract multiplier or risk sensitivity.
- Orders opening additional exposure must fit projected equity after marking the
  fill. Pure reductions may still close positions when free equity or equity is
  negative; a reversal's new residual position must pass the opening check.
- The last 100 fills are retained. Cumulative realized P/L and fill totals survive
  history truncation. All state is lost on reload or confirmed reset.
- No maintenance margin, settlement, FX conversion, interest, liquidation,
  multi-account support, limit/stop orders, or external routing is modeled.

The UI's 70% utilization warning is a local demonstration threshold, not an official
margin warning. See the [review guide](../../docs/development/step-4a-verification.md).
