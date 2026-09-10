// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "MarketData",
    platforms: [.macOS(.v15), .visionOS(.v2)],
    products: [
        .library(name: "MarketData", targets: ["MarketData"])
    ],
    dependencies: [
        .package(path: "../MarketCore")
    ],
    targets: [
        .target(
            name: "MarketData",
            dependencies: [.product(name: "MarketCore", package: "MarketCore")]
        ),
        .testTarget(
            name: "MarketDataTests",
            dependencies: ["MarketData", .product(name: "MarketCore", package: "MarketCore")]
        )
    ],
    swiftLanguageModes: [.v6]
)
