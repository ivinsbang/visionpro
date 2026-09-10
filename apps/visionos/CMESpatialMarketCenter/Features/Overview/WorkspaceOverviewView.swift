import SpatialUI
import SwiftUI

struct WorkspaceOverviewView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                VStack(alignment: .leading, spacing: 14) {
                    WorkspaceBadge("CME Spatial Market Center", symbol: "visionpro")

                    Text("A wider view\nof the market.")
                        .font(.system(.largeTitle, design: .rounded).weight(.semibold))
                        .accessibilityIdentifier("overview.title")

                    Text("Make room for a new perspective. Arrange your workspace and explore how a market desk can live around you.")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                WorkspaceCard {
                    WorkspaceStatusView()
                }

                WorkspaceLaunchControls()

                Label("Use your eyes and a pinch to select a control. Your windows stay yours to arrange.", systemImage: "hand.tap")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(36)
        }
    }
}
