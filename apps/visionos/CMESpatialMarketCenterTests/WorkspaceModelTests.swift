import Foundation
import MarketCore
import MarketData
import Testing
@testable import CMESpatialMarketCenter

@MainActor
struct WorkspaceModelTests {
    @Test
    func defaultWorkspaceHasNoMarketFeed() async throws {
        let workspace = WorkspaceModel()
        await workspace.loadIfNeeded()

        let status = try #require(workspace.marketStatus)
        #expect(status.mode == .synthetic)
        #expect(status.latestEventAt == nil)
    }

    @Test
    func providerFailureClearsPreviousStatusAndCanRecover() async {
        let provider = ControlledProvider()
        let workspace = WorkspaceModel(provider: provider)
        await workspace.refresh()
        #expect(workspace.marketStatus != nil)

        await provider.setFailure(true)
        await workspace.refresh()
        #expect(workspace.state == .failed)
        #expect(workspace.marketStatus == nil)

        await provider.setFailure(false)
        await workspace.refresh()
        #expect(workspace.marketStatus?.mode == .synthetic)
    }

    @Test
    func sharedWindowStartupDoesNotReloadReadyState() async {
        let provider = ControlledProvider()
        let workspace = WorkspaceModel(provider: provider)
        await workspace.loadIfNeeded()
        await workspace.loadIfNeeded()

        #expect(await provider.requestCount == 1)
    }

    @Test
    func cancellationReturnsToIdleAndAllowsRetry() async {
        let provider = ControlledProvider()
        await provider.cancelNextRequest()
        let workspace = WorkspaceModel(provider: provider)
        await workspace.refresh()

        #expect(workspace.state == .idle)
        #expect(workspace.marketStatus == nil)

        await workspace.refresh()
        #expect(workspace.marketStatus?.mode == .synthetic)
    }
}

private actor ControlledProvider: MarketDataProvider {
    private var shouldFail = false
    private var shouldCancel = false
    private(set) var requestCount = 0

    func setFailure(_ shouldFail: Bool) {
        self.shouldFail = shouldFail
    }

    func cancelNextRequest() {
        shouldCancel = true
    }

    func status() async throws -> MarketDataStatus {
        requestCount += 1
        if shouldCancel {
            shouldCancel = false
            throw CancellationError()
        }
        if shouldFail {
            throw ProviderFailure.unavailable
        }
        return MarketDataStatus(mode: .synthetic, sourceName: "Test provider", latestEventAt: nil)
    }
}

private enum ProviderFailure: Error {
    case unavailable
}
