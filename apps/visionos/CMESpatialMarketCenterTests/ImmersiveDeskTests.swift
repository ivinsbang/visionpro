import Foundation
import SwiftUI
import Testing
import UIKit
import WebKit
import simd
@testable import CMESpatialMarketCenter

@MainActor
struct ImmersiveDeskTests {
    @Test
    func cancelledAndFailedOpenKeepTheWindowAvailable() {
        let immersion = ImmersiveDeskModel()
        #expect(immersion.beginOpening())
        #expect(!immersion.beginOpening())
        #expect(immersion.dashboardHost == .window)
        immersion.finishOpening(.userCancelled)
        #expect(immersion.phase == .closed)
        #expect(immersion.message != nil)
        #expect(immersion.beginOpening())
        immersion.finishOpening(.error)
        #expect(immersion.dashboardHost == .window)
        #expect(immersion.phase == .closed)
    }

    @Test
    func sceneDismissalRestoresTheWindowWithoutResurrectingTheRoom() {
        let immersion = ImmersiveDeskModel()
        #expect(immersion.beginOpening())
        immersion.didAppear()
        #expect(immersion.dashboardHost == .immersive)
        #expect(immersion.isTransitioning)
        #expect(!immersion.beginClosing())
        immersion.didDisappear()
        #expect(!immersion.beginOpening())
        immersion.finishOpening(.opened)
        #expect(immersion.phase == .closed)
        #expect(immersion.dashboardHost == .window)

        #expect(immersion.beginOpening())
        immersion.finishOpening(.opened)
        #expect(immersion.beginClosing())
        #expect(!immersion.beginClosing())
        #expect(immersion.dashboardHost == .immersive)
        immersion.didDisappear()
        #expect(immersion.dashboardHost == .window)
        #expect(!immersion.beginOpening())
        immersion.finishClosing()
        #expect(immersion.beginOpening())
    }

    @Test
    func displaysSurroundTheViewerAndFaceInward() {
        let positions = (0..<6).map(SurroundDeskLayout.position(for:))
        #expect(positions.contains { $0.x > 2 })
        #expect(positions.contains { $0.x < -2 })
        #expect(positions.contains { $0.z > 2 })
        #expect(positions.contains { $0.z < -2 })
        for index in 0..<6 {
            let position = positions[index]
            let towardViewer = simd_normalize(SIMD3<Float>(-position.x, 0, -position.z))
            let front = SurroundDeskLayout.orientation(for: index).act([0, 0, 1])
            #expect(simd_dot(towardViewer, front) > 0.999)
            let horizontal = SIMD2<Float>(position.x, position.z)
            #expect(abs(simd_length(horizontal) - 2.8) < 0.001)
        }
        #expect(Set(SurroundPanelKind.allCases.map(\.roomIndex)) == Set(1...5))
    }

    @Test
    func bringDeskMovesItToTheSelectedPanelsWorldPosition() {
        let immersion = ImmersiveDeskModel()
        immersion.bringDesk(to: .portfolio)
        let desk = SurroundDeskLayout.orientation(for: immersion.rotationSteps).act(SurroundDeskLayout.position(for: 0))
        #expect(simd_distance(desk, SurroundDeskLayout.position(for: 3)) < 0.001)
        immersion.bringDesk(to: .risk)
        #expect(immersion.rotationSteps == 1)
        immersion.resetArrangement()
        #expect(immersion.rotationSteps == 0)
    }

    @Test
    func oldHostDismantlingCannotRemoveTheSharedWebViewFromItsNewHost() throws {
        let session = DashboardSession()
        let webView = try #require(session.viewForDisplay())
        let windowContainer = UIView()
        let immersiveContainer = UIView()
        windowContainer.addSubview(webView)
        immersiveContainer.addSubview(webView)
        DashboardWebView.dismantleUIView(windowContainer, coordinator: ())
        #expect(webView.superview === immersiveContainer)
        #expect(session.viewForDisplay() === webView)
        #expect(webView.navigationDelegate === session)
        windowContainer.addSubview(webView)
        DashboardWebView.dismantleUIView(immersiveContainer, coordinator: ())
        #expect(webView.superview === windowContainer)
        #expect(session.viewForDisplay() === webView)
        webView.stopLoading()
    }

    @Test
    func snapshotDecoderRequiresACompleteVersionedProjection() throws {
        var payload = snapshotPayload()
        let valid = try SurroundDashboardSnapshot.decode(json(payload))
        #expect(valid.panels.count == 5)
        #expect(valid.generatedAt == "2026-09-10T12:00:00.123Z")
        payload["version"] = 2
        #expect(throws: (any Error).self) { try SurroundDashboardSnapshot.decode(json(payload)) }
        payload = snapshotPayload()
        payload["panels"] = []
        #expect(throws: (any Error).self) { try SurroundDashboardSnapshot.decode(json(payload)) }
        payload = snapshotPayload()
        payload["generatedAt"] = "not a quote timestamp"
        #expect(throws: (any Error).self) { try SurroundDashboardSnapshot.decode(json(payload)) }
        payload = snapshotPayload()
        var panels = try #require(payload["panels"] as? [[String: Any]])
        panels[0]["rows"] = [["missing column"]]
        payload["panels"] = panels
        #expect(throws: (any Error).self) { try SurroundDashboardSnapshot.decode(json(payload)) }
    }

    private func json(_ payload: [String: Any]) throws -> String {
        String(decoding: try JSONSerialization.data(withJSONObject: payload), as: UTF8.self)
    }

    private func snapshotPayload() -> [String: Any] {
        let panels: [[String: Any]] = SurroundPanelKind.allCases.map { kind in
            ["id": kind.rawValue, "title": kind.title, "subtitle": "Synthetic", "metrics": [],
             "tableTitle": "Example", "columns": ["Contract", "Price"], "rows": [["ES", "5,400.00"]],
             "emptyMessage": "Empty", "note": "Simulation only", "chartValues": []]
        }
        return ["version": 1, "source": "Local synthetic engine", "generatedAt": "2026-09-10T12:00:00.123Z",
                "freshness": "Paused snapshot", "sequence": "Local sequence 00001", "panels": panels]
    }
}
