# Configuration conventions

Step 2 composes `PreviewMarketDataProvider` directly in `WorkspaceModel`. It always
reports a synthetic preview with no event data or network connection. There is no
client setting that enables live data, account access, or real order execution.

The Step 3 Windows dashboard constructs `SyntheticMarket` directly from its local
demo definitions. Its pause/outage controls change only the in-memory generator;
there is no provider URL, market API key, or live-mode switch. The browser and
native app are separate implementations at different feature milestones.

Build settings are in `apps/visionos/Configuration`; deployment configuration
remains reserved in `infrastructure`.

When configurable data integrations are implemented:

- Start with `synthetic` market data and paper-trading behavior.
- Treat market data mode (`synthetic`, `delayed`, or `live`) separately from
  trading capability. Receiving live quotes must never enable real execution.
- Add validated, nonsecret example settings with the consuming code.
- Keep local overrides in ignored `*.local.json`, `*.local.xcconfig`, or `.env`
  files. Example environment files may use `.env.example`.
- Keep provider credentials on the server; an application bundle cannot protect
  embedded provider secrets.

Server-side entitlement checks are part of the future read-only data integration;
a client configuration flag alone must not grant access.
