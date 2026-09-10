import SpatialUI
import SwiftUI

struct WorkspaceWindowsView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                Text("Space to think.")
                    .font(.largeTitle.bold())
                    .accessibilityIdentifier("workspace.title")

                Text("Place a companion window beside your desk, or open a small three-dimensional workspace model and look around it.")
                    .font(.title3)
                    .foregroundStyle(.secondary)

                WorkspaceLaunchControls()

                WorkspaceCard {
                    Label("A comfortable view", systemImage: "viewfinder")
                        .font(.headline)
                    Text("Move windows with their window bars. Keep frequently used controls within easy reach and take breaks when you need them.")
                        .foregroundStyle(.secondary)
                }
            }
            .padding(36)
        }
    }
}

struct WorkspaceLaunchControls: View {
    @Environment(\.openWindow) private var openWindow
    @Environment(\.dismissWindow) private var dismissWindow

    var body: some View {
        VStack(spacing: 18) {
            WorkspaceCard {
                Label("Another perspective", systemImage: "rectangle.on.rectangle")
                    .font(.title3.weight(.semibold))
                Text("Keep the workspace status in a separate, movable window.")
                    .foregroundStyle(.secondary)
                Button("Open companion window", systemImage: "plus.rectangle.on.rectangle") {
                    openWindow(id: WorkspaceWindow.companion.rawValue, value: WorkspaceWindow.companion.rawValue)
                }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("workspace.openCompanion")
            }

            WorkspaceCard {
                Label("Explore in three dimensions", systemImage: "cube.transparent")
                    .font(.title3.weight(.semibold))
                Text("A small model of three display panels gives you a feel for the spatial workspace.")
                    .foregroundStyle(.secondary)

                ViewThatFits(in: .horizontal) {
                    HStack {
                        spatialButtons
                    }
                    VStack(alignment: .leading) {
                        spatialButtons
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var spatialButtons: some View {
        Button("Open spatial preview", systemImage: "cube") {
            openWindow(id: WorkspaceWindow.spatialPreview.rawValue, value: WorkspaceWindow.spatialPreview.rawValue)
        }
        .accessibilityIdentifier("workspace.openSpatialPreview")

        Button("Close spatial preview", systemImage: "xmark") {
            dismissWindow(id: WorkspaceWindow.spatialPreview.rawValue, value: WorkspaceWindow.spatialPreview.rawValue)
        }
        .accessibilityIdentifier("workspace.closeSpatialPreview")
    }
}
