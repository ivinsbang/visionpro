import SwiftUI

enum DashboardLoadState: Equatable {
    case loading
    case ready
    case failed(String)
}

@MainActor
struct MarketDashboardView: View {
    @Environment(\.openWindow) private var openWindow
    @State private var loadState: DashboardLoadState = .loading
    @State private var reloadID = UUID()
    @State private var showingReloadConfirmation = false
    private let dashboard = BundledDashboard.load()

    var body: some View {
        VStack(spacing: 0) {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 24) {
                    status
                    Spacer(minLength: 12)
                    controls
                }
                VStack(alignment: .leading, spacing: 12) {
                    status
                    controls
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 16)

            if let dashboard {
                DashboardWebView(dashboard: dashboard, loadState: $loadState)
                    .id(reloadID)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .overlay {
                        switch loadState {
                        case .loading:
                            ProgressView("Opening offline market desk…")
                                .padding(28)
                                .glassBackgroundEffect()
                        case .ready:
                            EmptyView()
                        case let .failed(message):
                            failureView(message: message, canRetry: true)
                        }
                    }
            } else {
                failureView(
                    message: "Dashboard resources are missing from the app. Run npm run build:visionos in apps/preview-web, then rebuild the Xcode project.",
                    canRetry: false
                )
            }
        }
        .confirmationDialog("Reload this local desk?", isPresented: $showingReloadConfirmation, titleVisibility: .visible) {
            Button("Reload and reset desk", role: .destructive) { reload() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This resets the synthetic session, paper balance, positions and fills, open web panels, and in-memory watchlist. No real market data or orders are involved.")
        }
    }

    private var status: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("Offline synthetic desk", systemImage: "shield.lefthalf.filled")
                .font(.headline)
                .accessibilityIdentifier("dashboard.title")
            Text(statusText)
                .font(.caption)
                .foregroundStyle(.secondary)
                .accessibilityIdentifier("dashboard.status")
        }
    }

    private var statusText: String {
        guard dashboard != nil else { return "Dashboard assets missing" }
        switch loadState {
        case .loading: return "Loading bundled dashboard…"
        case .ready: return "Ready · No CME connection"
        case .failed: return "Local dashboard unavailable"
        }
    }

    private var controls: some View {
        HStack(spacing: 12) {
            Button("Native workspace", systemImage: "rectangle.3.group") {
                openWindow(id: WorkspaceWindow.workspace.rawValue, value: WorkspaceWindow.workspace.rawValue)
            }
            .accessibilityIdentifier("dashboard.openWorkspace")
            Button("Native volume", systemImage: "cube") {
                openWindow(id: WorkspaceWindow.spatialPreview.rawValue, value: WorkspaceWindow.spatialPreview.rawValue)
            }
            .accessibilityIdentifier("dashboard.openSpatialPreview")
            Button("Reload desk", systemImage: "arrow.clockwise") {
                showingReloadConfirmation = true
            }
            .disabled(dashboard == nil)
            .accessibilityIdentifier("dashboard.reload")
        }
        .font(.callout)
    }

    private func failureView(message: String, canRetry: Bool) -> some View {
        ContentUnavailableView {
            Label("Unable to open local desk", systemImage: "exclamationmark.triangle")
        } description: {
            Text(message)
        } actions: {
            if canRetry {
                Button("Retry local dashboard") { reload() }
                    .accessibilityIdentifier("dashboard.retry")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.regularMaterial)
    }

    private func reload() {
        loadState = .loading
        reloadID = UUID()
    }
}
