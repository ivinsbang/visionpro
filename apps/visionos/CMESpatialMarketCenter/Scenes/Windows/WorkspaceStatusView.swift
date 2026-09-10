import MarketCore
import SpatialUI
import SwiftUI

struct WorkspaceStatusView: View {
    @Environment(WorkspaceModel.self) private var workspace

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            switch workspace.state {
            case .idle, .loading:
                ProgressView("Preparing workspace")
            case let .ready(status):
                WorkspaceBadge(status.mode.displayName, symbol: "flask")
                    .accessibilityIdentifier("workspace.dataMode")
                Text(status.sourceName)
                    .font(.headline)
                Text(status.latestEventAt == nil ? "No market data loaded" : "Market data available")
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("workspace.feedStatus")
            case .failed:
                Label("Workspace unavailable", systemImage: "exclamationmark.triangle")
                    .font(.headline)
                Text("The workspace could not load. Please try again.")
                    .foregroundStyle(.secondary)
                Button("Try again") {
                    Task { await workspace.refresh() }
                }
                .accessibilityIdentifier("workspace.retry")
            }

            Label("Analysis and practice only", systemImage: "shield.lefthalf.filled")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

extension MarketDataMode {
    var displayName: String {
        switch self {
        case .synthetic: "Synthetic preview"
        case .delayed: "Delayed market data"
        case .live: "Live market data"
        }
    }
}
