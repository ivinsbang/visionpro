import SwiftUI

@MainActor
struct MarketDashboardView: View {
    let session: DashboardSession
    let immersion: ImmersiveDeskModel
    var host: DashboardHost = .window
    @Environment(\.openWindow) private var openWindow
    @State private var showingReloadConfirmation = false

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

            if let message = immersion.message {
                Text(message)
                    .font(.callout)
                    .padding(.horizontal, 24)
                    .padding(.bottom, 12)
                    .accessibilityIdentifier("dashboard.immersiveMessage")
            }

            if host != immersion.dashboardHost {
                ContentUnavailableView {
                    Label("Your desk is in the 360° room", systemImage: "view.3d")
                } description: {
                    Text("Look around for the market screens, or return to this window. Your synthetic session and paper account stay with you.")
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if session.dashboard != nil {
                DashboardWebView(session: session, immersion: immersion, host: host)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .overlay {
                        switch session.loadState {
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
        .disabled(showingReloadConfirmation)
        .accessibilityHidden(showingReloadConfirmation)
        .overlay {
            if showingReloadConfirmation {
                // Modal SwiftUI presentations from attachments require visionOS 26.
                // Keep confirmation inside the surface for our visionOS 2 target.
                ZStack {
                    Color.black.opacity(0.65)
                    VStack(alignment: .leading, spacing: 24) {
                        Text("Reload this local desk?").font(.title2.bold())
                        Text("This resets the synthetic session, paper balance, positions and fills, open web panels, and in-memory watchlist. No real market data or orders are involved.")
                        HStack {
                            Button("Keep my desk") { showingReloadConfirmation = false }
                                .keyboardShortcut(.cancelAction)
                                .accessibilityIdentifier("dashboard.cancelReload")
                            Button("Reload and reset desk", role: .destructive) {
                                showingReloadConfirmation = false
                                session.reload()
                            }
                            .accessibilityIdentifier("dashboard.confirmReload")
                        }
                    }
                    .padding(32)
                    .frame(maxWidth: 620)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24))
                }
            }
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
        guard session.dashboard != nil else { return "Dashboard assets missing" }
        switch session.loadState {
        case .loading: return "Loading bundled dashboard…"
        case .ready: return "Ready · No CME connection"
        case .failed: return "Local dashboard unavailable"
        }
    }

    private var controls: some View {
        HStack(spacing: 12) {
            ImmersiveDeskButton(immersion: immersion, canEnter: session.loadState == .ready)
                .buttonStyle(.borderedProminent)
            if host == .window {
                Button("Native workspace", systemImage: "rectangle.3.group") {
                    openWindow(id: WorkspaceWindow.workspace.rawValue, value: WorkspaceWindow.workspace.rawValue)
                }
                .accessibilityIdentifier("dashboard.openWorkspace")
                Button("Native volume", systemImage: "cube") {
                    openWindow(id: WorkspaceWindow.spatialPreview.rawValue, value: WorkspaceWindow.spatialPreview.rawValue)
                }
                .accessibilityIdentifier("dashboard.openSpatialPreview")
            } else {
                Button("Reset room arrangement", systemImage: "arrow.uturn.backward") {
                    immersion.resetArrangement()
                }
                .accessibilityIdentifier("dashboard.resetRoom")
            }
            Button("Reload desk", systemImage: "arrow.clockwise") {
                showingReloadConfirmation = true
            }
            .disabled(session.dashboard == nil || immersion.isTransitioning)
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
                Button("Retry local dashboard") { session.reload() }
                    .accessibilityIdentifier("dashboard.retry")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.regularMaterial)
    }
}
