# Development data

- `fixtures/market-data/`: future synthetic contracts, quotes, depth, and events.
- `fixtures/portfolios/`: future fictional positions, balances, and risk scenarios.
- `schemas/`: versioned data contracts introduced with their producers/consumers.

Only synthetic or explicitly permitted, sanitized test data belongs in Git. Do
not place real customer positions, account identifiers, credentials, or unlicensed
market-feed captures here. Machine-local data can use ignored `data/local/`.

Fixtures should be deterministic and identify their synthetic provenance, time
zone, timestamps, units, and contract assumptions. No shared/native data files are
included here yet.

The self-contained Windows dashboard keeps its fictional contract parameters in
`apps/preview-web/market/contracts.js`. Its seeded engine generates history and
events in memory, so the loopback server never needs access outside the preview
directory. These parameters are not exchange specifications or captured feeds.
See [the browser data model](../apps/preview-web/market/README.md).
