// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "MarketCore",
    platforms: [.macOS(.v15), .visionOS(.v2)],
    products: [
        .library(name: "MarketCore", targets: ["MarketCore"])
    ],
    targets: [
        .target(name: "MarketCore"),
        .testTarget(name: "MarketCoreTests", dependencies: ["MarketCore"])
    ],
    swiftLanguageModes: [.v6]
)
