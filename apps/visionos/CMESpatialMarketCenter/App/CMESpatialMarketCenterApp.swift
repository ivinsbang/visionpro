import SwiftUI

@main
@MainActor
struct CMESpatialMarketCenterApp: App {
    @State private var workspace = WorkspaceModel()

    var body: some Scene {
        WindowGroup("CME Spatial Market Center", id: WorkspaceWindow.main.rawValue) {
            MarketDashboardView()
                .frame(minWidth: 1040, minHeight: 700)
        }
        .defaultSize(width: 1440, height: 960)
        .windowResizability(.contentMinSize)

        WindowGroup("Native workspace", id: WorkspaceWindow.workspace.rawValue, for: String.self) { _ in
            MarketCenterRootView()
                .environment(workspace)
                .frame(minWidth: 860, minHeight: 620)
                .task { await workspace.loadIfNeeded() }
        } defaultValue: {
            WorkspaceWindow.workspace.rawValue
        }
        .defaultSize(width: 1120, height: 760)
        .windowResizability(.contentMinSize)

        WindowGroup("Workspace companion", id: WorkspaceWindow.companion.rawValue, for: String.self) { _ in
            CompanionWindowView()
                .environment(workspace)
                .frame(minWidth: 420, minHeight: 400)
                .task { await workspace.loadIfNeeded() }
        } defaultValue: {
            WorkspaceWindow.companion.rawValue
        }
        .defaultSize(width: 480, height: 520)
        .windowResizability(.contentMinSize)

        WindowGroup("Spatial preview", id: WorkspaceWindow.spatialPreview.rawValue, for: String.self) { _ in
            SpatialPreviewScene()
        } defaultValue: {
            WorkspaceWindow.spatialPreview.rawValue
        }
        .windowStyle(.volumetric)
        .defaultSize(width: 0.65, height: 0.50, depth: 0.45, in: .meters)
    }
}
