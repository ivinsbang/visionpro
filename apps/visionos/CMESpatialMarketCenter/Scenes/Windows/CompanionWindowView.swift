import SpatialUI
import SwiftUI

struct CompanionWindowView: View {
    @Environment(\.dismissWindow) private var dismissWindow

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack(alignment: .top) {
                    Image(systemName: "rectangle.on.rectangle")
                        .font(.largeTitle)
                        .foregroundStyle(WorkspaceStyle.accent)
                    Spacer()
                    Button("Close", systemImage: "xmark") {
                        dismissWindow(id: WorkspaceWindow.companion.rawValue, value: WorkspaceWindow.companion.rawValue)
                    }
                    .labelStyle(.iconOnly)
                    .accessibilityLabel("Close companion window")
                    .accessibilityIdentifier("companion.close")
                }

                Text("Workspace companion")
                    .font(.largeTitle.bold())
                    .accessibilityIdentifier("companion.title")

                Text("Keep a second view beside your desk. Move and resize this window to make the space your own.")
                    .foregroundStyle(.secondary)

                WorkspaceCard {
                    WorkspaceStatusView()
                }
            }
            .padding(32)
        }
        .tint(WorkspaceStyle.accent)
    }
}
