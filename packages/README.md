# Shared modules

Three local Swift packages are active in Step 2. They use Swift tools 6.2, Swift 6
language mode, visionOS 2.0, and macOS 15.0. Xcode 26.3 supplies the pinned compiler.

| Package | Implemented responsibility | Local dependencies |
| --- | --- | --- |
| `MarketCore` | Data mode/source status and timestamp freshness rules | None |
| `MarketData` | Read-only status provider and offline synthetic preview | `MarketCore` |
| `SpatialUI` | Shared badges/cards and a RealityKit workspace preview | None |
| `TradingSimulation` | Dependency-free JavaScript paper ledger, FIFO positions, P/L, and fictional margin | None; supplied synthetic events and contract parameters |

`MarketCore` and `MarketData` include Swift Testing targets. `SpatialUI` compiles
on macOS for its SwiftUI components; its volume view is visionOS-only and is built
with the native app. Its user journeys are covered by the app's UI test target.
The reserved `SpatialUITests` directory is not declared as an empty test target.

Step 4a's `TradingSimulation` is not a fourth Swift package. Its canonical `.mjs`
source and Node unit tests serve the shared Windows/bundled WebKit runtime.
The browser model is a generated, byte-checked copy, not a separate implementation.
There is no Swift manifest or native financial target yet. See the
[paper ledger guide](TradingSimulation/README.md) for calculations and regeneration.

Presentation accepts display values without fetching market data or managing
orders. App composition connects the packages without making domain modules
depend on SwiftUI, RealityKit, or a particular data vendor. Future contract,
portfolio, risk, and provider integrations extend the corresponding modules only
after approval; the current fictional ledger has no real-system dependencies.

Only introduce dependencies and resources when the implementing milestone needs
them. Avoid adding framework targets solely to fill the reserved directories.
