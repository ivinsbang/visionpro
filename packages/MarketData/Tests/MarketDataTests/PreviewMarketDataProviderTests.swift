import Foundation
import MarketCore
import Testing
@testable import MarketData

struct PreviewMarketDataProviderTests {
    @Test
    func previewNeverClaimsARealOrFreshMarketFeed() async throws {
        let status = try await PreviewMarketDataProvider().status()

        #expect(status.mode == .synthetic)
        #expect(status.latestEventAt == nil)
        #expect(status.freshness(at: Date(), maximumAge: 60) == .unavailable)
    }

    @Test
    func cancelledRequestDoesNotPublishStatus() async {
        let request = Task {
            withUnsafeCurrentTask { currentTask in
                currentTask?.cancel()
            }
            return try await PreviewMarketDataProvider().status()
        }

        do {
            _ = try await request.value
            Issue.record("A cancelled provider request must throw.")
        } catch is CancellationError {
        } catch {
            Issue.record("Expected cancellation, received \(error).")
        }
    }
}
