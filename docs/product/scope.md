# Product scope

Working name: **CME Spatial Market Center**. Intended customers are traders,
brokers, clearing members, and institutional clients using Apple Vision Pro.

The initial release centers on analysis, education, and simulated trading across
equity indexes, energy, agriculture, FX, interest rates, and metals. Step 2 implements the app shell: overview,
workspace/settings navigation, a companion window, and a neutral spatial preview.

Step 3 adds a local CME-style browser dashboard on the Windows laptop: synthetic
quotes, watchlists, charts, depth, generated prints, and spatial market screens.
It does not connect to CME or a broker. Product names and demo parameters are not
official contract metadata. Its CSS spatial view is a visual prototype, not an
emulation of native Vision Pro input or rendering.

Step 3a bundles the dashboard into an offline native WebKit host. Step 4a adds
session-only paper market orders, FIFO positions, P/L, and illustrative margin/risk
to that shared dashboard. All account money and tick/margin parameters are
fictional. No real orders, accounts, or official margin calculations are introduced.

The table maps the planned native product, not completed SwiftUI feature parity.
Calendar, education, voice workflows, and advanced paper order types remain future
work. Native compilation and simulator/device validation are still pending on a Mac.

## Mapping the idea to the structure

| Customer capability | Primary app feature or module | Planned delivery |
| --- | --- | --- |
| Virtual trading desk and multiple screens | `TradingDesk`, `Scenes`, `Navigation` | Initial product |
| Charts, volume, volatility, open interest | `Charts`, `SpatialUI` | Initial product |
| Interactive 3D market depth | `MarketDepth`, `SpatialUI` | Initial product |
| Custom watchlists and alerts | `Watchlists`, `Alerts` | Initial product |
| Exposure, P/L, margin estimates, risk alerts | `PortfolioRisk`, `TradingSimulation` | Step 4a shared offline dashboard; native SwiftUI views later |
| Contract details and expiry calendar | `ContractCalendar`, `MarketCore` | Initial product |
| Paper orders and simulated balances | `PaperTrading`, `TradingSimulation` | Step 4a shared offline market orders; native SwiftUI views later |
| Voice-assisted market search | `MarketSearch` | Initial product, after basic navigation |
| Eye/selection navigation and accessibility | `Navigation`, `SpatialUI` | Native app foundation onward |
| Futures, options, spreads, settlement education | `Education` | Initial product |
| Delayed/live CME market data | `MarketData`, future gateway | After data access is approved |
| News and market-event dashboards | `Alerts`, `Charts`, future event integration | Later extension |
| Shared virtual client support | Future collaboration feature | Later extension |
| Live broker order execution | Future separately approved project scope | Excluded from first release |

## First-release behavior requirements

- Initial visuals and development use clearly identified synthetic data.
- Distinguish synthetic, delayed, live, stale, and unavailable market data, with
  source and timestamp information when data is displayed.
- Keep paper-trading balances and fills separate from real accounts. Paper orders
  do not reach a broker or exchange.
- Label calculated margin/risk values as estimates, with their source, assumptions,
  and time. Do not present a simulated calculation as an official margin call.
- Provide deliberate confirmation for paper orders and an accessible alternative
  to voice interaction.
- Use system-mediated focus and selection for eye-controlled navigation; raw gaze
  recording is not a product requirement.
- Keep identity, data entitlements, and provider credentials within the security
  boundaries described in [security and privacy](../security/README.md).

## Future execution boundary

Real order execution would require a separate scope decision, approved broker
integration, explicit order confirmation, MFA, entitlement checks, and appropriate
regulatory controls, as specified in the original idea. This scaffold does not
introduce an execution service or broker adapter.
