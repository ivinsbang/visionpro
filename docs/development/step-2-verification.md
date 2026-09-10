# Step 2 verification record

This is the historical foundation check. The owner subsequently approved
continuing with the Windows dashboard; see [Step 3 verification](step-3-verification.md).
The native validation limitations recorded here still apply.

## Implemented

- Native Xcode project with app, app-unit-test, and UI-test targets.
- Shared scheme, local package references, debug/release settings, and privacy manifest.
- Overview/workspace/settings navigation, companion window, and RealityKit volume.
- Synthetic/no-feed status, loading, failure, retry, and cancellation handling.
- Three Swift packages and native build/test automation.
- Local Windows browser companion, loopback-only server, and browser test automation.

## Browser checks passed on Windows

Ran `npm.cmd test` in `apps/preview-web` with Node.js 22, Python 3, and installed
Google Chrome. All five Playwright tests passed:

1. Overview synthetic/no-feed labeling, local-only resource requests, and no browser errors.
2. Settings navigation, status refresh, and reset during an in-flight refresh.
3. Companion window reuse, keyboard movement, close behavior, and focus restoration.
4. Spatial model rotation, pointer dragging, and Escape-to-close behavior.
5. Narrow-screen layout and reachable controls with reduced motion enabled.

Reviewed screenshots of the desktop overview, spatial preview, and narrow-screen
layout. JavaScript syntax and Python compilation checks also passed. The server
response includes a content security policy with `connect-src 'none'`.

These results validate the browser companion only. The CSS spatial model is not
a native RealityKit volume, and mouse/keyboard input does not validate gaze/pinch.

## Native and repository checks on Windows

- Parsed all 21 Swift source/manifest/test files with a Swift syntax-tree parser.
- Parsed all 93 Xcode project objects and validated their internal references.
- Verified source membership for the app and both test targets.
- Verified local package paths and shared-scheme target references.
- Parsed property lists, asset JSON, scheme/workspace XML, and workflow YAML.
- Checked the native script's shell syntax and unsupported-host error behavior.
- Checked implementation-file formatting, documentation links, and Git ignore rules.

These are static checks. They do not perform Swift type checking, link Apple
frameworks, run native tests, or validate the native visual result.

The independently added `Project is for Apple Vision Pro-detail.txt` is unchanged.
Its existing whitespace and line-ending differences are excluded from the
implementation-file formatting result. A whole-repository whitespace workflow
will also inspect that file if it is committed.

## Still required on a Mac

Run `bash scripts/validate-native.sh test` with the documented toolchain, then
review the app in the simulator and on an Apple Vision Pro where available:

1. Launch the main window and confirm synthetic-preview/no-feed labeling.
2. Navigate among Overview, Spatial workspace, and Settings.
3. Open the companion window, open it again to check reuse, then close it.
4. Open, resize, and close the spatial volume; check geometry remains inside it.
5. Check gaze/pinch selection, VoiceOver labels, and larger text sizes.
6. Confirm a restart and a status refresh preserve the intended preview state.

The environment has no Xcode/visionOS SDK or Swift compiler, so native compilation,
package tests, simulator tests, and device review have not run. GitHub Actions is
configured but has not executed because no remote has been configured.

Later delivery and approvals are tracked in [the roadmap](../product/roadmap.md).
