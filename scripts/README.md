# Developer automation

## Local browser preview

`serve-preview.py` uses the Python 3 standard library. From the repository root:

```powershell
python scripts/serve-preview.py
```

Open [the preview](http://127.0.0.1:8765) in Chrome or Edge. Use `--port 8766` for a
different port and Ctrl+C to stop a foreground server. On macOS/Linux, use
`python3`. The server binds only to `127.0.0.1`, serves the preview directory rather
than the repository root, and blocks page fetch/WebSocket connections with a
content security policy. It is for local review, not production hosting.

See [browser tests](../apps/preview-web/README.md#browser-tests) for automation.

From `apps/preview-web`, `npm.cmd run build:simulation` copies the canonical model
in `packages/TradingSimulation` into the local-only browser asset tree.
`npm.cmd run check:simulation` verifies the copy without writing. Do not edit the
generated `market/paper-trading-model.js` directly. `test:unit` runs both the shared
ledger's Node tests and the preview's model/packaging/film tests.

The optional `npm.cmd run record:demo` command in `apps/preview-web` records a
captioned local walkthrough without capturing the desktop. See
[video recording](../apps/preview-web/README.md#record-a-walkthrough) for encoder
setup and ignored export locations.

The separate `npm.cmd run record:spatial` command renders a 3D concept film with
offline male speech and synchronized subtitles. It uses a separate headless
Chrome profile, not a desktop capture or Apple simulator. See the
[3D film guide](../docs/development/windows-3d-film.md) for prerequisites and review.

`npm.cmd run record:desk` records the current, interactive CSS 3D desk and all
built browser features with male narration and English subtitles. Unlike the
earlier concept renderer, these are the actual running app controls, including
scripted paper orders in a disposable profile. Use `-- --preview` to rehearse all
actions and produce review frames without the full movie. Outputs never overwrite
prior recordings. See the [3D desk guide](../docs/development/windows-3d-desk.md).

## Native validation

The native dashboard resources are included in the repository. After changing
shared browser code, run `npm.cmd run build:visionos` from `apps/preview-web` and
verify with `npm.cmd run check:visionos`. Use `npm` on a Mac. Xcode has no Node
build phase and does not need the preview server. `build:visionos` first runs
`build:simulation`; verification rejects a stale shared-model copy or bundle. See the
[simulator guide](../docs/development/visionos-simulator.md).

`validate-native.sh` runs on an Apple-silicon Mac with Xcode 26.3. It selects the
compiler through `xcrun`, validates the project/property lists and resource presence, runs package tests,
and builds or tests the native app and test targets.

From the repository root:

```sh
bash scripts/validate-native.sh test
bash scripts/validate-native.sh build
```

`test` uses the Apple Vision Pro simulator with visionOS 26.2 by default. Override
`VISION_PRO_DESTINATION` to choose another available simulator. Select the Xcode
installation with `DEVELOPER_DIR`; the script checks `.xcode-version`.

`build` runs package tests and builds native test bundles without launching a
simulator. The script exits with an explicit error on Windows, unsupported hosts,
or a mismatched Xcode version. Outputs are ignored under `artifacts/` and package
`.build/` directories. It does not deploy, archive, or sign a device build.

See [development setup](../docs/development/README.md) for prerequisites and the
[verification record](../docs/development/step-3a-verification.md) for current limits.
