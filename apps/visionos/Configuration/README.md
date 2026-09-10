# Xcode configuration

`Base.xcconfig` sets the visionOS 2.0 deployment target, Swift 6 language mode,
version 0.1.0, and placeholder bundle identifier `com.example.cmespatialmarketcenter`.
`Debug.xcconfig` and `Release.xcconfig` share those settings and select the relevant
optimization and debugging behavior. Xcode 26.3 is pinned in `.xcode-version`.

Simulator builds do not need a development team. To run on a device, copy
`Developer.local.xcconfig.example` to ignored `Developer.local.xcconfig`, set your
actual team and unique bundle identifier, and configure signing in Xcode.
Both build configurations include this optional override. No signing identity or
certificate is provided by this repository.

Keep shared nonsecret build configuration in Git. Keep signing certificates and
private keys outside the repository.

Runtime data-mode conventions live in [config](../../../config/README.md).
