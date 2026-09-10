import Foundation

public enum MarketDataMode: String, Codable, CaseIterable, Sendable {
    case synthetic
    case delayed
    case live
}

public enum DataFreshness: Equatable, Sendable {
    case unavailable
    case current
    case stale
}

public struct MarketDataStatus: Equatable, Sendable {
    public let mode: MarketDataMode
    public let sourceName: String
    public let latestEventAt: Date?

    public init(mode: MarketDataMode, sourceName: String, latestEventAt: Date?) {
        self.mode = mode
        self.sourceName = sourceName
        self.latestEventAt = latestEventAt
    }

    public func freshness(at referenceDate: Date, maximumAge: TimeInterval) -> DataFreshness {
        guard maximumAge.isFinite, maximumAge >= 0, let latestEventAt else {
            return .unavailable
        }

        let age = referenceDate.timeIntervalSince(latestEventAt)
        guard age.isFinite, age >= 0 else {
            return .unavailable
        }

        return age <= maximumAge ? .current : .stale
    }
}
