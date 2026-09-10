# Contributing

Work follows the owner's approved milestones in [the roadmap](docs/product/roadmap.md).
Steps 1 and 2 are approved to continue. Step 3 covers the local Windows CME-style
dashboard with synthetic data. Native financial screens and subsequent milestones
still require owner approval; never connect this prototype to real CME systems.

## Change workflow

1. Keep a change within the approved milestone and describe its user-facing result.
2. Follow the [module boundaries](docs/architecture/README.md) and `.editorconfig`.
3. Include relevant verification and update affected documentation.
4. Inspect staged changes for secrets, generated files, and licensed/customer data.
5. Open a pull request when a remote and collaboration workflow are established.

Run `git diff --check` for unstaged tracked changes and `git diff --cached --check`
for staged changes. These commands do not inspect untracked files. The repository
workflow checks all committed files for whitespace errors.

Run `bash scripts/validate-native.sh test` on a supported Mac for the package and
native tests. See [test locations](tests/README.md) and
[setup instructions](docs/development/README.md).

For browser changes, run `npm.cmd ci` and `npm.cmd test` from `apps/preview-web`
on Windows, or use `npm` on macOS/Linux. These checks require Node.js 22 or later,
Python 3, and Google Chrome. The browser server itself needs no npm dependencies.

Xcode is pinned in `.xcode-version`; shared build settings live in
`apps/visionos/Configuration`. The native app uses only local Swift packages, so
there is no remote Swift package lockfile to commit. The browser test dependency
is pinned in `apps/preview-web/package-lock.json`; keep that lockfile in Git and
update it with dependency changes. Keep user-specific IDE state out of Git.

## Repository ownership

The owner will choose the hosting organization, maintainers, license, and
distribution policy. No license has been selected in this scaffold. Add
`CODEOWNERS` with actual maintainer identities when hosting is configured.

Report security-sensitive issues privately using [SECURITY.md](SECURITY.md).
