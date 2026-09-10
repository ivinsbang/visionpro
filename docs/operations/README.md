# Operations and release readiness

There are no deployed services or production app releases. Step 2 includes native
build/test automation and an optional local signing override; no signing identity
has been configured. This directory is reserved for operational runbooks.

The Windows browser companion has local tests and a CI workflow. Its loopback-only
Python server supports owner review; it is not a deployed market service or a
production hosting configuration. Browser tests do not replace native release checks.

Before an application release, establish and verify:

- Passing native builds and CI using the committed project and shared scheme.
- Domain/simulation correctness, UI accessibility, and device performance checks.
- Ownership of signing, distribution, license, and release approval.
- Market-data source permissions, entitlements, freshness, and failure behavior.
- Authentication and customer-data handling for any enabled account integration.
- Privacy declarations, support contact, monitoring, and incident response.
- Versioning, release notes, rollback/recovery procedures, and support ownership.

Gateway-specific deployment and recovery runbooks belong here when the gateway is
implemented. Keep infrastructure code under `infrastructure` and service code
under `services`.
