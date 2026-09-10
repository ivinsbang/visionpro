import Observation
import SwiftUI

enum DashboardHost {
    case window
    case immersive
}

@MainActor
@Observable
final class ImmersiveDeskModel {
    static let spaceID = "surround-market-desk"

    enum Phase {
        case closed, opening, open, closing
    }

    private(set) var phase: Phase = .closed
    private(set) var message: String?
    private(set) var rotationSteps = 0
    private var transitionPending = false

    var dashboardHost: DashboardHost {
        phase == .open || phase == .closing ? .immersive : .window
    }

    var isTransitioning: Bool { transitionPending }

    func beginOpening() -> Bool {
        guard phase == .closed, !transitionPending else { return false }
        message = nil
        rotationSteps = 0
        phase = .opening
        transitionPending = true
        return true
    }

    func finishOpening(_ result: OpenImmersiveSpaceAction.Result) {
        // Appearance may precede the async open result. Keep transition controls
        // disabled until it resolves, even if the scene has already disappeared.
        guard transitionPending else { return }
        transitionPending = false
        guard phase != .closed else { return }
        switch result {
        case .opened:
            phase = .open
        case .userCancelled:
            phase = .closed
            message = "Opening 360° view was cancelled. Your desk is still available."
        case .error:
            phase = .closed
            message = "The 360° room could not open. Close any other immersive experience and try again."
        @unknown default:
            phase = .closed
            message = "The 360° room is unavailable. Your desk is still available."
        }
    }

    func didAppear() {
        if phase == .opening { phase = .open }
    }

    func beginClosing() -> Bool {
        guard phase == .open, !transitionPending else { return false }
        phase = .closing
        transitionPending = true
        return true
    }

    func didDisappear() {
        phase = .closed
    }

    func finishClosing() {
        transitionPending = false
        phase = .closed
    }

    func bringDesk(to panel: SurroundPanelKind) {
        rotationSteps = (rotationSteps + panel.roomIndex) % 6
    }

    func resetArrangement() { rotationSteps = 0 }
}

@MainActor
struct ImmersiveDeskButton: View {
    let immersion: ImmersiveDeskModel
    var canEnter = true
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace
    @Environment(\.openWindow) private var openWindow
    @Environment(\.dismissWindow) private var dismissWindow

    var body: some View {
        Button(title, systemImage: "view.3d") {
            Task { @MainActor in
                if immersion.beginClosing() {
                    // Keep a return window available even if it was closed in the room.
                    openWindow(id: WorkspaceWindow.main.rawValue, value: WorkspaceWindow.main.rawValue)
                    await dismissImmersiveSpace()
                    immersion.finishClosing()
                } else if canEnter, immersion.beginOpening() {
                    let result = await openImmersiveSpace(id: ImmersiveDeskModel.spaceID)
                    immersion.finishOpening(result)
                    if case .opened = result, immersion.phase == .open {
                        // Wait for the space to open before closing the launch window.
                        dismissWindow(id: WorkspaceWindow.main.rawValue, value: WorkspaceWindow.main.rawValue)
                    }
                }
            }
        }
        .disabled(immersion.isTransitioning || (immersion.phase == .closed && !canEnter))
        .accessibilityIdentifier(immersion.dashboardHost == .immersive ? "dashboard.exitImmersive" : "dashboard.enterImmersive")
    }

    private var title: String {
        switch immersion.phase {
        case .closed: "Enter 360° view"
        case .opening: "Opening 360°…"
        case .open: "Return to window"
        case .closing: "Returning…"
        }
    }
}
