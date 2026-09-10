# Repository instructions

## Approval and scope

- Follow the owner's one-step-at-a-time workflow in `docs/product/roadmap.md`.
- Complete only the currently authorized milestone. Wait for explicit approval
  before starting the next milestone.
- Steps 1 and 2 are approved for continuing development; native validation is
  still pending. The owner authorized Step 3 by requesting a CME-style mock
  dashboard on the personal Windows laptop, without touching real CME systems.
  The owner also authorized visionOS simulator compatibility: bundle the existing
  synthetic dashboard in the native app for offline use. The owner's request to
  build the next features authorizes Step 4a: local paper trading and a fictional
  portfolio/risk dashboard in the shared browser and bundled native host.
  The owner then requested a 3D Windows demo of all built features; this authorizes
  the shared interactive 3D desk and its local narrated walkthrough, not new
  financial capabilities or integrations. Reuse the actual dashboard and ledger.
  The owner's report that Simulator shows only one screen authorizes a native
  360-degree presentation of that same desk and read-only surrounding summaries.
  Calendar, education, voice search, advanced order types, a full SwiftUI financial
  rewrite, account integrations, and later steps remain deferred pending review.
- Do not commit, publish, or configure a remote unless the owner requests it.

## Architecture

- Target a native visionOS app using SwiftUI and RealityKit.
- Keep app lifecycle and dependency composition under `apps/visionos`.
- Keep the Windows browser companion under `apps/preview-web`, with local assets
  and no external market connections. Browser checks do not validate native code.
- Keep the shared dashboard source in `apps/preview-web`; regenerate its native
  resource bundle with `npm run build:visionos` there. Do not hand-edit generated
  files in `apps/visionos/CMESpatialMarketCenter/Resources/MarketDashboard`.
- Keep the shared paper ledger in `packages/TradingSimulation`. Regenerate its
  browser copy with `npm run build:simulation` or `npm run build:visionos` from
  `apps/preview-web`; do not hand-edit `market/paper-trading-model.js`.
- Keep reusable domain logic, data access, simulation, and presentation in the
  corresponding directories under `packages`.
- Follow module dependency boundaries in `docs/architecture/README.md`.
- Use Xcode 26.3, Swift 6 language mode, and a visionOS 2.0 deployment target.
  Swift package manifests use Swift tools 6.2. Do not add empty targets merely to
  fill reserved directories. TradingSimulation currently uses dependency-free
  JavaScript shared by the browser and offline host, not a duplicate Swift target.

## Product constraints

- The first release supports analysis, education, and simulated trading.
- Start with synthetic fixtures. Keep data provenance, timestamps, and simulation
  labels visible when market data and trading screens are implemented.
- Do not add live order routing or broker execution integrations to this scope.
- Keep credentials, private signing material, and customer data out of Git.
- Do not embed provider secrets in the client application.

## Working conventions

- Use descriptive names, focused changes, and the existing directory conventions.
- Keep Swift feature names and module names in PascalCase.
- Use `.gitkeep` only while a reserved directory is empty.
- Keep documentation accurate about what is planned versus implemented.
- Run checks appropriate to the milestone. Do not claim a native build or device
  validation without running it in a supported Apple development environment.
