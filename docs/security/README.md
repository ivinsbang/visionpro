# Security and privacy requirements

The first release follows the original analysis, education, and paper-trading
boundary. Step 2 uses an offline synthetic-status provider and includes a privacy
manifest declaring no tracking or data collection. It has no credentials, account
access, microphone workflow, or execution adapter. Revisit the manifest when data
access, telemetry, permissions, or dependencies are introduced.

The Windows browser companion also has no market/account connections or telemetry.
Its local server binds to `127.0.0.1` and serves only the preview directory. Assets
are local and its content security policy includes `connect-src 'none'`. This is
a local development server, not a hardened public hosting service.

Step 3 generates all browser quotes, history, depth, and prints in memory. Product
labels are not real contract entitlements. Only a validated demo-symbol watchlist
is stored in local storage; it is not an account or customer profile and is never
transmitted. Storage failures are surfaced without claiming a successful save.
Pause/outage controls cannot enable external connectivity or execution.

Step 4a keeps the fictional paper account entirely in memory in both the browser
and offline native host. It stores no financial data, introduces no new runtime
dependency, and makes no account, broker, or market-data request. A paper ticket
must be reviewed and deliberately confirmed with fresh synthetic data; expired
reviews, unavailable quotes, invalid quantities, and added exposure beyond the
fictional margin limit cannot produce a fill. These are local simulation rules,
not broker-grade safeguards or a security boundary against the local code owner.

Account reset and market-session restart warn before clearing existing paper
activity. Reload also clears it; there is no audit-log persistence or recovery.
The risk dashboard labels its invented parameters and held marks, and does not
represent an official margin call or regulatory risk calculation.

The requirements below apply as the later financial features are implemented.

## Market and customer data

- Preserve data source, timestamp, freshness, and synthetic/delayed/live labeling.
- Verify market-data access and entitlements at the trusted server boundary when
  a real feed is introduced.
- Keep provider secrets outside the client and repository. Store sensitive
  device credentials in appropriate platform-protected storage when needed.
- Use fictional portfolios for the first prototype. Add customer-account access
  only with an approved authentication, authorization, and data-retention design.
- Avoid sensitive account data, credentials, and raw voice recordings in logs or
  analytics. Request microphone access only in the relevant voice workflow.

## Simulation and risk

- Keep simulated accounts and order flows isolated from real execution systems.
- Make paper-trading state visible at entry, confirmation, and fill reporting.
- Define reproducible simulation assumptions and validation for fills and balances.
- Identify risk and margin estimates, their sources, and their calculation times.

## Future integrations

Read-only live data does not authorize live trading. Real execution requires the
separate broker integration, MFA, confirmation, entitlement, and regulatory work
described in [product scope](../product/scope.md).

Security reporting instructions are in [SECURITY.md](../../SECURITY.md).
