enum WorkspaceDestination: String, CaseIterable, Identifiable, Hashable {
    case overview
    case workspace
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .overview: "Overview"
        case .workspace: "Spatial workspace"
        case .settings: "Settings"
        }
    }

    var symbol: String {
        switch self {
        case .overview: "square.grid.2x2"
        case .workspace: "rectangle.3.group"
        case .settings: "gearshape"
        }
    }
}

enum WorkspaceWindow: String {
    case main = "market-center"
    case workspace = "native-workspace"
    case companion = "workspace-companion"
    case spatialPreview = "spatial-preview"
}
