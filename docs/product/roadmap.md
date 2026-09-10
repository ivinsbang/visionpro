# Approval-based milestones

The owner requested one step at a time, with review and explicit approval before
advancing. The owner approved continuing after Step 2 and explicitly requested a
CME-style mock dashboard on the Windows laptop without touching real CME systems.
The owner subsequently requested visionOS simulator compatibility. That authorizes
the offline native-host extension in Step 3a, not later financial integrations.
The latest request to build the next features authorizes a bounded Step 4a:
paper trading and portfolio/risk using only the existing synthetic engine. The
remaining Step 4 features wait for another review, with no real-system integration.
The subsequent request for a 3D Windows demo authorizes presentation and recording
of these built features, without advancing into Step 4b.
The owner's simulator report about the single-screen view authorizes correcting
that presentation with a native 360-degree room using the same dashboard session.

| Step | Deliverable | Status |
| --- | --- | --- |
| 1 | Production-oriented Git repository structure and baseline documentation | Approved by owner |
| 2 | Native visionOS foundation and local Windows browser shell | Approved to continue; native validation pending |
| 3 | Windows CME-style desk, watchlists, charts, depth, and spatial screens using synthetic data | Implemented; original 24 tests passed; compatibility extension authorized |
| 3a | Bundle the existing dashboard into the native visionOS app for Simulator | Implemented; Mac simulator validation and owner review pending |
| 4a | Offline market-order paper trading and fictional portfolio/risk | Authorized and implemented; owner review and native validation pending |
| 4b | Calendar, education, voice search, and advanced simulation features | Proposed; awaiting approval |
| 5 | Approved read-only market data, operational hardening, and release validation | Proposed; awaiting approval |

## Step 1 review

The review covers the native platform direction, app feature layout, module
boundaries, asset and data locations, test organization, Git conventions, and the
first-release product boundary. No application implementation is part of Step 1.

## Step 2 delivery

The project includes Xcode 26.3 settings, a visionOS 2.0 deployment target, real app
and test targets, a shared scheme, three useful local Swift packages, and a basic
spatial shell. The shell includes overview/workspace/settings navigation, a
companion window, a neutral RealityKit volume, and synthetic-preview status.

The project notes also request a prototype reviewable on the personal Windows
laptop without touching real CME systems. `apps/preview-web` provides the same
foundation as a local browser companion: navigation, movable windows, and a CSS
spatial model. It is not a visionOS simulator or a native runtime test.

`TradingSimulation` was reserved in Step 2 for the simulation milestone. There are no
financial charts, market quotes, portfolios, or order-placement features in Step 2.
The placeholder bundle identifier can be used for simulator work; device signing
requires the owner's actual team and identifier through a local override.

All five browser tests and static native source/project checks have passed on
Windows. Native compilation, package tests, simulator UI tests, and device behavior
still require verification on a supported Mac. See the
[verification record](../development/step-2-verification.md).

## Step 3 delivery

The browser prototype now opens directly into the synthetic market desk. Seven
demo instruments support streaming prices, search/asset filtering, a persisted
watchlist, candle/area charts, three ranges, eight-level depth, and simulated prints.
The companion follows the selected market; a separate chart has an independent
contract selector. The CSS spatial model shows three updating market screens.

Pause/resume and simulated outage/reconnect controls operate only on the local
generator. Held snapshots retain their timestamps and identify stale or paused
data. No real market endpoints, accounts, or trading services are configured.

The original 8 simulator unit tests and 16 browser tests passed. See
[Step 3 verification](../development/step-3-verification.md). That Windows delivery
did not include native dashboard hosting; Step 3a adds it separately.

## Step 3a delivery

The native main window hosts the existing dashboard using a local-only `WKWebView`.
HTML, classic JavaScript, CSS, and icons are included as app resources, generated
from the Windows source with a pinned bundler. Running the app requires no local
server, Node.js, CME credentials, or market-data service. Native workspace and
RealityKit windows remain available from the main window's controls.

Web chart panels still live inside the dashboard window, and the RealityKit volume
remains a neutral shell preview. No full SwiftUI financial rewrite is implied.
The native watchlist is intentionally session-only. Packaging, offline file loading,
Chrome/WebKit interactions, and native project membership receive local checks;
compilation, Apple Simulator, and headset validation remain pending on a Mac.

See the [run guide](../development/visionos-simulator.md) and
[compatibility verification](../development/step-3a-verification.md).
The subsequent request to continue authorizes only the Step 4a scope below.

## Step 4a delivery

The shared dashboard adds reviewed, confirmed paper market orders; a $100,000
fictional USD session account; FIFO positions and realized/unrealized P/L; fill
history; and an illustrative margin, exposure, and asset-class dashboard.
Prices come only from the local synthetic engine. Freshness, review expiry,
quantity caps, and fictional margin are rechecked at confirmation. Closing or
reducing a position still requires an explicit review and confirmation.

The reusable ledger lives in `packages/TradingSimulation` as dependency-free
JavaScript used by both the Windows browser and offline native resource bundle.
There is no duplicate Swift financial implementation or connected account.
Paper state is memory-only. Reset and market-session restart protect existing
paper activity with confirmation; layout reset does not erase it.

See [Step 4a review and verification](../development/step-4a-verification.md).
The follow-up [interactive 3D desk and narrated recording](../development/windows-3d-desk.md)
reuses the actual windows, market session, paper account, and portfolio. Its
nine-step guided tour never places orders. The optional recorder creates its
example paper positions only in a separate, disposable browser session.
The subsequent [native 360-degree view](../development/visionos-360-view.md) adds an
immersive six-screen ring: the original interactive desk plus five read-only
projections of its market and account values. One retained WebKit session preserves
the synthetic engine and ledger across entry/exit. This is an authorized presentation
correction within Step 4a; native build, Simulator rendering, and device validation
of the new room are pending.
Review this milestone before calendar, education, voice, advanced orders, or any
later integration. Windows checks do not establish native Simulator/device behavior.

## Later decisions

Data vendor, entitlements, authentication, hosting, account integrations, branding,
licensing, and distribution remain open. Decide each when its milestone requires
it. Shared client support and real order execution need separate scope approval.
