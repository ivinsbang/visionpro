import RealityKit
import SwiftUI
import UIKit
import simd

enum SurroundDeskLayout {
    static let radius: Float = 2.8
    static let height: Float = 1.45

    static func angle(for index: Int) -> Float { Float(index) * .pi / 3 }

    static func position(for index: Int) -> SIMD3<Float> {
        let angle = angle(for: index)
        return [sin(angle) * radius, height, -cos(angle) * radius]
    }

    static func orientation(for index: Int) -> simd_quatf {
        // Attachment fronts point along +Z. Turn each front toward the viewer.
        simd_quatf(angle: -angle(for: index), axis: [0, 1, 0])
    }
}

@MainActor
struct ImmersiveDeskScene: View {
    let session: DashboardSession
    let immersion: ImmersiveDeskModel
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        let rotationSteps = immersion.rotationSteps
        RealityView { content, attachments in
            content.add(makeEnvironment())
            let room = Entity()
            room.name = "SurroundDesk"
            content.add(room)
            arrange(attachments, in: room, rotationSteps: rotationSteps)
        } update: { content, attachments in
            guard let room = content.entities.first(where: { $0.name == "SurroundDesk" }) else { return }
            arrange(attachments, in: room, rotationSteps: rotationSteps)
        } attachments: {
            Attachment(id: "interactive-desk") {
                MarketDashboardView(session: session, immersion: immersion, host: .immersive)
                    .frame(width: 1440, height: 960)
                    .background(Color(red: 0.025, green: 0.04, blue: 0.065))
                    .clipShape(RoundedRectangle(cornerRadius: 28))
                    .glassBackgroundEffect()
                    .preferredColorScheme(.dark)
            }
            ForEach(SurroundPanelKind.allCases) { kind in
                Attachment(id: kind.rawValue) {
                    SurroundPanelView(kind: kind, session: session, immersion: immersion)
                }
            }
        }
        .onAppear {
            immersion.didAppear()
        }
        .onDisappear {
            immersion.didDisappear()
            // Restore the desk for both our Exit button and system dismissal.
            openWindow(id: WorkspaceWindow.main.rawValue, value: WorkspaceWindow.main.rawValue)
        }
        .task { await session.observeSurroundSnapshots() }
    }

    private func arrange(_ attachments: RealityViewAttachments, in room: Entity, rotationSteps: Int) {
        if let desk = attachments.entity(for: "interactive-desk") {
            place(desk, index: 0, width: 2.25, in: room)
        }
        for kind in SurroundPanelKind.allCases {
            if let panel = attachments.entity(for: kind.rawValue) {
                place(panel, index: kind.roomIndex, width: 1.95, in: room)
            }
        }
        room.orientation = SurroundDeskLayout.orientation(for: rotationSteps)
    }

    private func place(_ attachment: ViewAttachmentEntity, index: Int, width: Float, in room: Entity) {
        if attachment.parent !== room { room.addChild(attachment) }
        attachment.position = SurroundDeskLayout.position(for: index)
        attachment.orientation = SurroundDeskLayout.orientation(for: index)
        // Measure local attachment bounds instead of assuming a point/metre ratio.
        let bounds = attachment.visualBounds(relativeTo: attachment)
        if bounds.extents.x > 0 {
            attachment.scale = .init(repeating: width / bounds.extents.x)
        }
    }

    private func makeEnvironment() -> Entity {
        let environment = Entity()
        let backdrop = ModelEntity(
            mesh: .generateSphere(radius: 20),
            materials: [UnlitMaterial(color: UIColor(red: 0.018, green: 0.028, blue: 0.05, alpha: 1))]
        )
        backdrop.scale = [-1, 1, 1]
        environment.addChild(backdrop)

        let floor = ModelEntity(
            mesh: .generateBox(size: [12, 0.01, 12]),
            materials: [UnlitMaterial(color: UIColor(red: 0.026, green: 0.044, blue: 0.064, alpha: 1))]
        )
        floor.position.y = -0.02
        environment.addChild(floor)

        // A stationary floor ring helps make the complete room visible when the
        // simulator camera turns between displays. It has no interaction target.
        for index in 0..<72 {
            let angle = Float(index) * .pi / 36
            let marker = ModelEntity(
                mesh: .generateBox(size: [0.016, 0.008, index.isMultiple(of: 12) ? 0.24 : 0.09]),
                materials: [UnlitMaterial(color: UIColor(red: 0.10, green: 0.34, blue: 0.40, alpha: 1))]
            )
            marker.position = [sin(angle) * 3.35, -0.01, -cos(angle) * 3.35]
            marker.orientation = simd_quatf(angle: -angle, axis: [0, 1, 0])
            environment.addChild(marker)
        }
        return environment
    }
}
