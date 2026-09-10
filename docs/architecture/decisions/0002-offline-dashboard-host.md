# ADR 0002: Bundle the dashboard in an offline visionOS host

## Status

Accepted for the owner's Step 3a simulator-compatibility request. Native build,
Apple Simulator, and headset validation remain pending on a supported Mac.

## Context

The Windows prototype already contains the requested synthetic desk. The owner
now wants visionOS simulator compatibility without touching real CME systems.
The repository has a SwiftUI/RealityKit shell with a visionOS 2.0 deployment target.
A separate Swift financial rewrite is not needed to make the existing prototype
available in a native window and has not been authorized for this milestone.

## Decision

- Host the existing dashboard with `WKWebView` through `UIViewRepresentable`.
  This keeps the existing deployment target rather than requiring newer SwiftUI
  web-view APIs. See [Apple's WebKit API](https://developer.apple.com/documentation/webkit/wkwebview).
- Generate a small, included resource folder from `apps/preview-web`. Pinned esbuild
  bundles ES modules into a classic script and targets Safari 17 syntax. Xcode copies
  the folder intact, without Node.js, Python, a server, or remote package downloads.
- Load only the bundled entry page. Restrict WebKit read access to its asset directory
  and reject other navigation. See [Apple's file-loading API](https://developer.apple.com/documentation/webkit/wkwebview/loadfileurl(_:allowingreadaccessto:)).
- Use a deny-by-default content policy with explicit `file:` asset sources, not
  `'self'`: local-file origin handling in the Windows WebKit test port otherwise
  permitted remote script/image attempts. Block connections, external assets,
  inline scripts/styles, frames, forms, media, and object content.
- Use a nonpersistent WebKit data store and a JavaScript in-memory watchlist. There
  is no native script-message bridge, credential store, account integration, or
  network fallback. Explicit reload resets the desk only after confirmation.
- Keep the neutral native workspace, status companion, and RealityKit volume as
  separate system windows. The HTML chart panels remain web content, not native windows.

## Consequences

The Windows and native host share one synthetic engine and visual implementation.
The native bundle can launch without the development laptop/server, and publishing
or signing is unnecessary for simulator validation. Generated resources must be
updated with source changes; a deterministic manifest and CI check enforce this.

This is a compatibility adapter, not a fully native financial UI, an immersive
trading room, or App Store readiness. Gaze/pinch behavior, accessibility, memory,
Swift/SDK compilation, and real-device performance still require Apple validation.
The native shell's `MarketData` provider does not receive the JavaScript quotes.
