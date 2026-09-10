import SwiftUI
import UIKit

@MainActor
struct DashboardWebView: UIViewRepresentable {
    let session: DashboardSession
    let immersion: ImmersiveDeskModel
    let host: DashboardHost

    func makeUIView(context: Context) -> UIView {
        let container = UIView()
        attach(to: container)
        return container
    }

    func updateUIView(_ container: UIView, context: Context) {
        attach(to: container)
    }

    static func dismantleUIView(_ container: UIView, coordinator: ()) {
        // The other host may already have reparented the shared view. Removing
        // only this container's children cannot tear down that active host.
        for child in container.subviews { child.removeFromSuperview() }
    }

    private func attach(to container: UIView) {
        guard immersion.dashboardHost == host,
              let webView = session.viewForDisplay(),
              webView.superview !== container else { return }
        webView.removeFromSuperview()
        webView.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            webView.topAnchor.constraint(equalTo: container.topAnchor),
            webView.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])
    }
}
