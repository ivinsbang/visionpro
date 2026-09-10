import Foundation

enum SurroundPanelKind: String, CaseIterable, Decodable, Identifiable, Sendable {
    case chart, depth, portfolio, risk, watchlist

    var id: String { rawValue }

    // The interactive desk is index 0; these five panels complete a 360° ring.
    var roomIndex: Int {
        switch self {
        case .chart: 1
        case .depth: 2
        case .portfolio: 3
        case .risk: 4
        case .watchlist: 5
        }
    }

    var title: String {
        switch self {
        case .chart: "Selected market"
        case .depth: "Market depth"
        case .portfolio: "Paper portfolio"
        case .risk: "Illustrative risk & fills"
        case .watchlist: "Your watchlist"
        }
    }
}

struct SurroundPanelSnapshot: Decodable, Identifiable, Sendable {
    struct Metric: Decodable, Sendable {
        let label: String
        let value: String
    }

    let id: SurroundPanelKind
    let title: String
    let subtitle: String
    let metrics: [Metric]
    let tableTitle: String
    let columns: [String]
    let rows: [[String]]
    let emptyMessage: String
    let note: String
    let chartValues: [Double]
}

// Formatted display values from the existing JavaScript desk, with no Swift
// account, pricing, order, or risk calculations.
struct SurroundDashboardSnapshot: Decodable, Sendable {
    let version: Int
    let source: String
    let generatedAt: String
    let freshness: String
    let sequence: String
    let panels: [SurroundPanelSnapshot]

    static func decode(_ json: String) throws -> Self {
        let snapshot = try JSONDecoder().decode(Self.self, from: Data(json.utf8))
        guard snapshot.version == 1,
              !snapshot.source.isEmpty,
              ISO8601DateFormatter().date(from: snapshot.generatedAt) != nil
                || validFractionalTimestamp(snapshot.generatedAt) else {
            throw SnapshotError.invalidSnapshot
        }
        guard snapshot.panels.count == SurroundPanelKind.allCases.count,
              Set(snapshot.panels.map(\.id)) == Set(SurroundPanelKind.allCases),
              snapshot.panels.allSatisfy({ panel in
                  panel.metrics.count <= 4 && panel.columns.count <= 6 && panel.rows.count <= 8
                    && panel.rows.allSatisfy { $0.count == panel.columns.count }
                    && panel.chartValues.count <= 60 && panel.chartValues.allSatisfy(\.isFinite)
              }) else {
            throw SnapshotError.invalidSnapshot
        }
        return snapshot
    }

    private static func validFractionalTimestamp(_ timestamp: String) -> Bool {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: timestamp) != nil
    }

    enum SnapshotError: Error { case invalidSnapshot }
}
