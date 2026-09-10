import SwiftUI
import UIKit
import WebKit

@MainActor
struct DashboardWebView: UIViewRepresentable {
    let dashboard: BundledDashboard
    @Binding var loadState: DashboardLoadState

    func makeCoordinator() -> Coordinator {
        Coordinator(dashboard: dashboard, loadState: $loadState)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsLinkPreview = false
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.accessibilityIdentifier = "dashboard.webView"
        webView.loadFileURL(dashboard.indexURL, allowingReadAccessTo: dashboard.directoryURL)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        coordinator.isActive = false
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.loadHTMLString("", baseURL: nil)
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate {
        let dashboard: BundledDashboard
        @Binding var loadState: DashboardLoadState
        var isActive = true

        init(dashboard: BundledDashboard, loadState: Binding<DashboardLoadState>) {
            self.dashboard = dashboard
            self._loadState = loadState
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
            guard isActive, navigationAction.targetFrame?.isMainFrame == true else {
                return .cancel
            }
            return dashboard.allowsNavigation(to: navigationAction.request.url) ? .allow : .cancel
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse) async -> WKNavigationResponsePolicy {
            guard isActive, navigationResponse.isForMainFrame else {
                return .cancel
            }
            return dashboard.allowsNavigation(to: navigationResponse.response.url) ? .allow : .cancel
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            Task { @MainActor [weak self, weak webView] in
                guard let self, let webView, self.isActive else { return }
                do {
                    let ready = try await webView.evaluateJavaScript("document.documentElement.dataset.dashboardReady === 'true'")
                    guard self.isActive else { return }
                    self.loadState = ready as? Bool == true
                        ? .ready
                        : .failed("The bundled dashboard did not finish starting. Reload the desk or rebuild its resources.")
                } catch {
                    guard self.isActive else { return }
                    self.loadState = .failed("The local dashboard could not be initialized. Reload the desk to try again.")
                }
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
            reportLoadFailure()
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) {
            reportLoadFailure()
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            guard isActive else { return }
            loadState = .failed("The local web renderer stopped. Reloading starts a new synthetic desk session.")
        }

        private func reportLoadFailure() {
            guard isActive else { return }
            loadState = .failed("The bundled dashboard could not be loaded. No network connection is required; try reloading the desk.")
        }
    }
}
