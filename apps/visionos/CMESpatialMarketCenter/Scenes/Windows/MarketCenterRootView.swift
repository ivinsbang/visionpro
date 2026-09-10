import SpatialUI
import SwiftUI

struct MarketCenterRootView: View {
    @State private var selection: WorkspaceDestination? = .overview

    var body: some View {
        NavigationSplitView {
            List(WorkspaceDestination.allCases, selection: $selection) { destination in
                Label(destination.title, systemImage: destination.symbol)
                    .tag(destination)
                    .accessibilityIdentifier("navigation.\(destination.rawValue)")
            }
            .navigationTitle("Market Center")
            .navigationSplitViewColumnWidth(min: 200, ideal: 230, max: 270)
            .safeAreaInset(edge: .bottom) {
                WorkspaceBadge("Preview workspace", symbol: "sparkles")
                    .padding()
            }
        } detail: {
            Group {
                switch selection ?? .overview {
                case .overview:
                    WorkspaceOverviewView()
                case .workspace:
                    WorkspaceWindowsView()
                case .settings:
                    WorkspaceSettingsView()
                }
            }
            .navigationTitle((selection ?? .overview).title)
        }
        .tint(WorkspaceStyle.accent)
    }
}
