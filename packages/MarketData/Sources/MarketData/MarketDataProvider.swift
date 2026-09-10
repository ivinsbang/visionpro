import MarketCore

public protocol MarketDataProvider: Sendable {
    func status() async throws -> MarketDataStatus
}

public struct PreviewMarketDataProvider: MarketDataProvider {
    public init() {}

    public func status() async throws -> MarketDataStatus {
        try Task.checkCancellation()
        return MarketDataStatus(
            mode: .synthetic,
            sourceName: "Local preview",
            latestEventAt: nil
        )
    }
}
