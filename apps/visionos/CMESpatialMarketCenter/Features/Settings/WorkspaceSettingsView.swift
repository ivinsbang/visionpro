import SpatialUI
import SwiftUI

struct WorkspaceSettingsView: View {
    @Environment(WorkspaceModel.self) private var workspace

    var body: some View {
        Form {
            Section("Workspace") {
                LabeledContent("Market data", value: workspace.marketStatus?.mode.displayName ?? "Unavailable")
                    .accessibilityIdentifier("settings.marketData")
                LabeledContent("Trading", value: "Practice only")
                LabeledContent("Account connection", value: "None")
            }

            Section("Connection") {
                WorkspaceStatusView()
                Button("Refresh workspace status", systemImage: "arrow.clockwise") {
                    Task { await workspace.refresh() }
                }
                .disabled(workspace.state == .loading)
                .accessibilityIdentifier("settings.refresh")
            }

            Section("About") {
                LabeledContent("Application", value: "CME Spatial Market Center")
                LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown")
            }
        }
        .accessibilityIdentifier("settings.form")
    }
}
