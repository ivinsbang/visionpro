import MarketCore
import MarketData
import Observation

enum WorkspaceLoadState: Equatable {
    case idle
    case loading
    case ready(MarketDataStatus)
    case failed
}

@MainActor
@Observable
final class WorkspaceModel {
    private(set) var state: WorkspaceLoadState = .idle
    private let provider: any MarketDataProvider

    init(provider: any MarketDataProvider = PreviewMarketDataProvider()) {
        self.provider = provider
    }

    var marketStatus: MarketDataStatus? {
        guard case let .ready(status) = state else { return nil }
        return status
    }

    func loadIfNeeded() async {
        guard state == .idle else { return }
        await refresh()
    }

    func refresh() async {
        guard state != .loading else { return }
        state = .loading

        do {
            let status = try await provider.status()
            try Task.checkCancellation()
            state = .ready(status)
        } catch is CancellationError {
            state = .idle
        } catch {
            state = .failed
        }
    }
}
