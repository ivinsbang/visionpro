import SwiftUI

public enum WorkspaceStyle {
    public static let accent = Color(red: 0.28, green: 0.85, blue: 0.85)
    public static let cardCornerRadius: CGFloat = 24
}

public struct WorkspaceBadge: View {
    private let title: String
    private let symbol: String

    public init(_ title: String, symbol: String) {
        self.title = title
        self.symbol = symbol
    }

    public var body: some View {
        Label(title, systemImage: symbol)
            .font(.caption.weight(.semibold))
            .foregroundStyle(WorkspaceStyle.accent)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(WorkspaceStyle.accent.opacity(0.12), in: Capsule())
            .accessibilityElement(children: .combine)
    }
}

public struct WorkspaceCard<Content: View>: View {
    private let content: Content

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(24)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: WorkspaceStyle.cardCornerRadius))
        .overlay {
            RoundedRectangle(cornerRadius: WorkspaceStyle.cardCornerRadius)
                .strokeBorder(.white.opacity(0.08), lineWidth: 1)
        }
    }
}
