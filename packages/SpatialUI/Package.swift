// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "SpatialUI",
    platforms: [.macOS(.v15), .visionOS(.v2)],
    products: [
        .library(name: "SpatialUI", targets: ["SpatialUI"])
    ],
    targets: [
        .target(name: "SpatialUI")
    ],
    swiftLanguageModes: [.v6]
)
