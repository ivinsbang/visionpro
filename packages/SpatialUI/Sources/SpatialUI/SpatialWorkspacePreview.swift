#if os(visionOS)
import RealityKit
import SwiftUI

public struct SpatialWorkspacePreview: View {
    public init() {}

    public var body: some View {
        GeometryReader3D { geometry in
            RealityView { content in
                let workspace = makeWorkspace()
                content.add(workspace)
                fit(workspace, in: content.convert(geometry.frame(in: .local), from: .local, to: .scene))
            } update: { content in
                guard let workspace = content.entities.first else { return }
                fit(workspace, in: content.convert(geometry.frame(in: .local), from: .local, to: .scene))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Spatial workspace preview: three display panels arranged above a platform")
    }

    private func makeWorkspace() -> Entity {
        let workspace = Entity()
        let platform = ModelEntity(
            mesh: .generateBox(size: SIMD3<Float>(0.54, 0.018, 0.30), cornerRadius: 0.008),
            materials: [SimpleMaterial(color: .darkGray, isMetallic: true)]
        )
        platform.position.y = -0.14
        workspace.addChild(platform)

        for panelIndex in 0..<3 {
            let panel = ModelEntity(
                mesh: .generateBox(size: SIMD3<Float>(0.15, 0.19, 0.015), cornerRadius: 0.004),
                materials: [SimpleMaterial(color: panelIndex == 1 ? .cyan : .white, isMetallic: false)]
            )
            panel.position = SIMD3<Float>(Float(panelIndex - 1) * 0.18, 0, panelIndex == 1 ? -0.025 : 0.015)
            workspace.addChild(panel)
        }

        return workspace
    }

    private func fit(_ workspace: Entity, in bounds: BoundingBox) {
        let scale = min(bounds.extents.x / 0.62, min(bounds.extents.y / 0.42, bounds.extents.z / 0.40))
        guard scale.isFinite, scale > 0 else { return }
        workspace.scale = SIMD3<Float>(repeating: scale)
        workspace.position = bounds.center
    }
}
#endif
