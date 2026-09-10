# ADR 0001: Native visionOS application

Status: Accepted with the owner's approval of Step 1 and authorization of Step 2.

## Context

The product needs multiple spatial screens, interactive 3D market visualization,
and navigation appropriate to Apple Vision Pro. The current workspace is Windows;
the target application is a native visionOS experience.

## Decision

Use Swift and SwiftUI for application behavior and windows, with RealityKit for
spatial rendering. Separate reusable domain, data, simulation, and UI concerns in
local Swift packages. Keep backend choices open until data integration needs them.

Apple documents SwiftUI, RealityKit, windows, volumes, and spaces as visionOS
building blocks in its [platform overview](https://developer.apple.com/visionos/).

## Consequences

This supports a native interaction model and clear separation of financial logic
from presentation. Editing the repository on Windows is possible, while native
builds, simulator checks, and signing require the Apple development toolchain.
Apple's [first-app guide](https://developer.apple.com/documentation/visionos/creating-your-first-visionos-app)
specifies an Apple-silicon Mac for visionOS development.

The project now pins Xcode 26.3, Swift 6 language mode, Swift tools 6.2, and a
visionOS 2.0 deployment target. It contains app/unit/UI targets and three local
package manifests. Native compilation and simulator validation remain pending
because the implementation workspace is Windows.
