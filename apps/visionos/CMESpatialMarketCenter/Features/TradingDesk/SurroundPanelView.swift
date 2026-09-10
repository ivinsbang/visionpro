import SwiftUI

@MainActor
struct SurroundPanelView: View {
    let kind: SurroundPanelKind
    let session: DashboardSession
    let immersion: ImmersiveDeskModel

    private var panel: SurroundPanelSnapshot? {
        session.surroundSnapshot?.panels.first { $0.id == kind }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Label("360° SYNTHETIC DESK", systemImage: "view.3d")
                Spacer()
                Text("\(kind.roomIndex + 1) / 6")
            }
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(.mint)

            VStack(alignment: .leading, spacing: 8) {
                Text(panel?.title ?? kind.title)
                    .font(.system(size: 34, weight: .semibold))
                Text(panel?.subtitle ?? "Waiting for your local desk…")
                    .font(.system(size: 19))
                    .foregroundStyle(.secondary)
            }
            .accessibilityIdentifier("surround.\(kind.rawValue).title")

            freshness
            Divider()

            ScrollView {
                if let panel {
                    VStack(alignment: .leading, spacing: 24) {
                        metrics(panel.metrics)
                        if panel.chartValues.count > 1 {
                            SurroundPriceLine(values: panel.chartValues)
                                .frame(height: 150)
                                .accessibilityLabel("Last 60 synthetic one-minute closes. Inspect the full chart on the interactive desk.")
                        }
                        table(panel)
                        Text(panel.note)
                            .font(.system(size: 17))
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } else if let issue = session.snapshotIssue {
                    Text(issue).padding(24)
                } else {
                    ProgressView("Reading your local synthetic desk…")
                        .frame(maxWidth: .infinity, minHeight: 200)
                }
            }

            Divider()
            HStack {
                Button("Bring interactive desk here", systemImage: "rectangle.on.rectangle") {
                    immersion.bringDesk(to: kind)
                }
                .disabled(immersion.phase != .open)
                .accessibilityIdentifier("surround.\(kind.rawValue).bringDesk")
                Spacer()
                ImmersiveDeskButton(immersion: immersion, canEnter: false)
            }
            .font(.system(size: 18))
        }
        .padding(30)
        .frame(width: 1000, height: 800)
        .background(Color(red: 0.025, green: 0.04, blue: 0.065))
        .clipShape(RoundedRectangle(cornerRadius: 28))
        .glassBackgroundEffect()
        .preferredColorScheme(.dark)
    }

    private var freshness: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let expired = session.snapshotReceivedAt.map { context.date.timeIntervalSince($0) > 5 } ?? true
            let held = expired || session.snapshotIssue != nil || session.loadState != .ready
            let fresh = !held && session.surroundSnapshot?.freshness == "Fresh synthetic data"
            VStack(alignment: .leading, spacing: 6) {
                Text(session.surroundSnapshot == nil ? "Waiting for synthetic data" : held ? "Display updates paused · values held" : session.surroundSnapshot?.freshness ?? "Unavailable")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(fresh ? .mint : .orange)
                    .accessibilityIdentifier("surround.\(kind.rawValue).freshness")
                if let snapshot = session.surroundSnapshot {
                    Text("\(snapshot.source) · Generated \(snapshot.generatedAt) · \(snapshot.sequence)")
                        .font(.system(size: 14))
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func metrics(_ metrics: [SurroundPanelSnapshot.Metric]) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 14) {
            ForEach(metrics.indices, id: \.self) { index in
                VStack(alignment: .leading, spacing: 8) {
                    Text(metrics[index].label)
                        .font(.system(size: 17))
                        .foregroundStyle(.secondary)
                    Text(metrics[index].value)
                        .font(.system(size: 28, weight: .medium, design: .monospaced))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(18)
                .background(.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 16))
            }
        }
    }

    private func table(_ panel: SurroundPanelSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(panel.tableTitle)
                .font(.system(size: 22, weight: .semibold))
            if panel.rows.isEmpty {
                Text(panel.emptyMessage)
                    .font(.system(size: 20))
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 24)
            } else {
                Grid(alignment: .leading, horizontalSpacing: 14, verticalSpacing: 18) {
                    GridRow {
                        ForEach(panel.columns.indices, id: \.self) { column in
                            Text(panel.columns[column])
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(.secondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    ForEach(panel.rows.indices, id: \.self) { row in
                        GridRow {
                            ForEach(panel.columns.indices, id: \.self) { column in
                                Text(panel.rows[row][column])
                                    .font(.system(size: 18, design: .monospaced))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }
    }
}

private struct SurroundPriceLine: View {
    let values: [Double]

    var body: some View {
        GeometryReader { geometry in
            Path { path in
                guard values.count > 1, let low = values.min(), let high = values.max() else { return }
                for (index, value) in values.enumerated() {
                    let normalized = high == low ? 0.5 : (value - low) / (high - low)
                    let point = CGPoint(
                        x: geometry.size.width * CGFloat(index) / CGFloat(values.count - 1),
                        y: 10 + (geometry.size.height - 20) * CGFloat(1 - normalized)
                    )
                    if index == 0 { path.move(to: point) } else { path.addLine(to: point) }
                }
            }
            .stroke(.mint, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
        }
    }
}
