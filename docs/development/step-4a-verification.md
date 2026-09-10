# Step 4a: paper trading and portfolio/risk

This records the original financial-feature delivery. The later
[3D desk and all-features video](windows-3d-desk.md) have their own review guide and
updated validation counts; no new financial capabilities are implied.

Implemented and checked on Windows on 2026-09-09 following the owner's request
to build the next features. This is the bounded next milestone, not authorization
for real feeds, accounts, or execution. Owner review and native Mac validation
remain pending; calendar, education, voice, and advanced order types are deferred.

## Try it locally

Open [the local preview](http://127.0.0.1:8765) and refresh an existing tab. If the
server is not running, use `python scripts/serve-preview.py` from the repository
root. All steps below operate on a fictional account in that tab's memory.

1. On **Market desk**, select a demo contract and choose **Paper trade this contract**,
   or choose **Paper trading** in the sidebar. The starting balance is $100,000
   fictional USD. Select buy/sell and a whole-number quantity from 1 through 20.
2. Choose **Review paper order**. Inspect the indicative price, resulting position,
   projected equity, and fictional margin. **Back to ticket** or Escape cancels;
   neither creates a fill. The default dialog focus is on cancellation, not confirmation.
3. Review again and choose **Confirm paper order**. A labeled synthetic fill appears
   in the paper history. Confirmation uses the latest fresh ask for a buy or bid
   for a sell, so the displayed estimate can move before confirmation.
4. Open **Portfolio & risk**. Inspect positions, average entries, current demo marks,
   realized/unrealized P/L, fixed fictional margin, free equity, gross exposure,
   and asset-class allocation. Expand **Calculation assumptions and simulation limits**
   to see all seven invented tick/margin parameters and the model's limitations.
5. Choose **Close** on a position. It prefills an opposite ticket but does not
   execute it. A position over 20 contracts offers **Reduce** in a capped batch.
   Review and confirm to close/reduce; FIFO closing profit moves to realized P/L.
6. Pause the local feed, or simulate an outage in Settings. Paper orders must be
   blocked, and the portfolio retains its last marked timestamp with a held-data
   notice. Resume/reconnect to continue using only the local generator.
7. Leave a review open for over 15 seconds. Confirmation becomes unavailable until
   **Refresh review** explicitly creates a new review with current estimates.
8. Try **Reset paper account**, cancel, then confirm. Cancel preserves everything;
   confirm clears paper activity and restores the starting balance without changing
   quotes or watchlist. A market-session restart also asks if fills exist and then
   resets both quotes and paper state. **Reset layout** never clears the ledger.

Reloading or closing the tab loses paper state; it is never saved or transmitted.
The browser watchlist is separate and persists locally. The native host keeps
both watchlist and paper state only in memory, with no cross-host synchronization.

## Calculation boundary

- The ledger uses integer price ticks and USD cents, FIFO lots, signed long/short
  positions, and explicit realized versus unrealized P/L. Shorts, partial exits,
  and reversals are supported; only market orders are implemented.
- Starting balance plus realized P/L forms the cash ledger. Equity adds unrealized
  P/L marked to synthetic last prices. Fixed per-contract fictional margin is
  deducted to display free equity; no margin offsets apply across asset classes.
- Added exposure is rejected if projected margin exceeds projected equity. A pure
  reduction can still close risk with negative equity, subject to the order cap.
  Net positions cannot exceed 100 contracts per symbol.
- Quotes older than five seconds, paused/outage modes, invalid/non-synthetic
  snapshots, expired reviews, and consumed confirmation tokens cannot create fills.
  Both price and affordability are rechecked at confirmation.
- Every order fills fully at synthetic bid/ask. No real liquidity is consumed.
  There are no fees, slippage, partial fills, FX conversion, maintenance margin,
  settlement, automatic liquidation, official contract multipliers, or SPAN model.
- The 70% usage warning is an invented demo threshold, not an official margin
  warning, financial recommendation, or margin call. All seven tick values and
  fixed margin amounts are invented and labeled in the app.
- The most recent 100 fills are kept while cumulative realized P/L and fill totals
  remain intact. The ledger is not a durable account or audit trail.

See [the shared ledger guide](../../packages/TradingSimulation/README.md) for API
boundaries and regeneration. No CME system, broker, cloud service, or customer
account is connected. No new dependency was added for this milestone.

## Verified on Windows

`npm.cmd run build:visionos` regenerated the five offline native resources.
The complete `npm.cmd test` run passed **76 tests**:

| Suite | Result | Coverage |
| --- | --- | --- |
| Node unit tests | 34 passed | 17 ledger cases, source/copy/native-hash agreement, and existing market/packaging/film tests |
| Browser journeys | 28 passed | 12 paper/portfolio flows plus the existing 16 market/workspace flows |
| Bundled dashboard | 14 passed | Seven direct-file journeys each in Chrome and Playwright WebKit, including paper orders, reset, and compact layout |

Paper tests cover fill confirmation/cancellation/duplication, long/short and FIFO
precision, FX tick arithmetic, review expiry, stale/invalid/future data, position
caps, low/negative-equity reductions, reset protection, storage denial, and mobile
controls. Browser tests assert no unexpected external requests or console errors.
Bundle tests verify offline behavior and content-policy restrictions.

Visual review covered the desktop portfolio, populated positions, paper ticket,
review dialog, a 390-pixel mobile layout, and the bundled review at 1040 x 590.
Review screenshots are local, ignored artifacts under `artifacts/step-4a`; they
are browser captures, not screenshots from a physical headset or Apple Simulator.

## Not yet validated

Native Swift compilation, Xcode resource loading, Apple visionOS Simulator input,
VoiceOver, gaze/pinch comfort, performance, and physical Vision Pro appearance
require a supported Mac and/or headset. Windows Playwright WebKit is not Apple's
visionOS runtime. The native reload message now names the paper state it clears;
that source change has not been compiled on this laptop.

Follow the expanded [Mac smoke test](visionos-simulator.md#simulator-smoke-test).
The financial screens remain web content inside one native window. The native
RealityKit volume remains the separate neutral preview, not a 3D portfolio scene.
Existing demo videos predate Step 4a and were not re-recorded for this milestone.
