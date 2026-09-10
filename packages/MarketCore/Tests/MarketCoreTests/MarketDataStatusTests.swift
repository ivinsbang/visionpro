import Foundation
import Testing
@testable import MarketCore

struct MarketDataStatusTests {
    private let referenceDate = Date(timeIntervalSince1970: 1_800_000_000)

    @Test
    func missingTimestampIsUnavailable() {
        let status = MarketDataStatus(mode: .synthetic, sourceName: "Preview", latestEventAt: nil)

        #expect(status.freshness(at: referenceDate, maximumAge: 60) == .unavailable)
    }

    @Test(arguments: MarketDataMode.allCases)
    func ageBoundaryAppliesToEveryDataMode(mode: MarketDataMode) {
        let status = MarketDataStatus(
            mode: mode,
            sourceName: "Test provider",
            latestEventAt: referenceDate.addingTimeInterval(-60)
        )

        #expect(status.freshness(at: referenceDate, maximumAge: 60) == .current)
        #expect(status.freshness(at: referenceDate.addingTimeInterval(0.001), maximumAge: 60) == .stale)
    }

    @Test
    func futureTimestampIsUnavailable() {
        let status = MarketDataStatus(
            mode: .live,
            sourceName: "Test provider",
            latestEventAt: referenceDate.addingTimeInterval(1)
        )

        #expect(status.freshness(at: referenceDate, maximumAge: 60) == .unavailable)
    }

    @Test(arguments: [-1.0, Double.infinity, Double.nan])
    func invalidAgeLimitIsUnavailable(maximumAge: TimeInterval) {
        let status = MarketDataStatus(
            mode: .live,
            sourceName: "Test provider",
            latestEventAt: referenceDate
        )

        #expect(status.freshness(at: referenceDate, maximumAge: maximumAge) == .unavailable)
    }

    @Test
    func invalidReferenceDateIsUnavailable() {
        let status = MarketDataStatus(
            mode: .delayed,
            sourceName: "Test provider",
            latestEventAt: referenceDate
        )

        #expect(status.freshness(at: Date(timeIntervalSince1970: .nan), maximumAge: 60) == .unavailable)
    }
}
