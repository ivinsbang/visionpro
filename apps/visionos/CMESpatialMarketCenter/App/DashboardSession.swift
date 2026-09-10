import Observation
import UIKit
import WebKit

enum DashboardLoadState: Equatable {
    case loading
    case ready
    case failed(String)
}

@MainActor
@Observable
final class DashboardSession: NSObject, WKNavigationDelegate {
    let dashboard: BundledDashboard?
    private(set) var loadState: DashboardLoadState = .loading
    private(set) var surroundSnapshot: SurroundDashboardSnapshot?
    private(set) var snapshotReceivedAt: Date?
    private(set) var snapshotIssue: String?
    @ObservationIgnored private(set) var webView: WKWebView?
    @ObservationIgnored private var generation = UUID()
    @ObservationIgnored private var activeNavigation: WKNavigation?

    init(dashboard: BundledDashboard? = BundledDashboard.load()) {
        self.dashboard = dashboard
        super.init()
        guard dashboard != nil else { return }
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = self
        view.allowsLinkPreview = false
        view.isOpaque = false
        view.backgroundColor = .clear
        view.scrollView.backgroundColor = .clear
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.accessibilityIdentifier = "dashboard.webView"
        webView = view
        reload()
    }

    func viewForDisplay() -> WKWebView? { webView }

    // This is the only navigation that resets the JavaScript market and ledger.
    // Reparenting the retained WKWebView between hosts never calls this method.
    func reload() {
        guard let dashboard, let webView else { return }
        generation = UUID()
        loadState = .loading
        surroundSnapshot = nil
        snapshotReceivedAt = nil
        snapshotIssue = nil
        activeNavigation = webView.loadFileURL(dashboard.indexURL, allowingReadAccessTo: dashboard.directoryURL)
    }

    func observeSurroundSnapshots() async {
        while !Task.isCancelled {
            await readSurroundSnapshot()
            do {
                try await Task.sleep(for: .seconds(1))
            } catch { return }
        }
    }

    private func readSurroundSnapshot() async {
        guard loadState == .ready, let webView else { return }
        let currentGeneration = generation
        do {
            let value = try await webView.evaluateJavaScript("JSON.stringify(window.readNativeDeskSnapshot?.() ?? null)")
            guard !Task.isCancelled, currentGeneration == generation else { return }
            guard let json = value as? String else {
                throw SurroundDashboardSnapshot.SnapshotError.invalidSnapshot
            }
            surroundSnapshot = try SurroundDashboardSnapshot.decode(json)
            snapshotReceivedAt = .now
            snapshotIssue = nil
        } catch {
            guard !Task.isCancelled, currentGeneration == generation else { return }
            snapshotIssue = "Surround screens are not updating. Any displayed values are held. Return to the desk to retry."
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard navigationAction.targetFrame?.isMainFrame == true else { return .cancel }
        return dashboard?.allowsNavigation(to: navigationAction.request.url) == true ? .allow : .cancel
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse) async -> WKNavigationResponsePolicy {
        guard navigationResponse.isForMainFrame else { return .cancel }
        return dashboard?.allowsNavigation(to: navigationResponse.response.url) == true ? .allow : .cancel
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard navigation === activeNavigation else { return }
        let currentGeneration = generation
        Task { @MainActor [weak self, weak webView] in
            guard let self, let webView else { return }
            do {
                let ready = try await webView.evaluateJavaScript("document.documentElement.dataset.dashboardReady === 'true'")
                guard self.generation == currentGeneration else { return }
                self.loadState = ready as? Bool == true
                    ? .ready
                    : .failed("The bundled dashboard did not finish starting. Reload the desk or rebuild its resources.")
            } catch {
                guard self.generation == currentGeneration else { return }
                self.loadState = .failed("The local dashboard could not be initialized. Reload the desk to try again.")
            }
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
        guard navigation === activeNavigation else { return }
        reportLoadFailure(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) {
        guard navigation === activeNavigation else { return }
        reportLoadFailure(error)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        generation = UUID()
        loadState = .failed("The local web renderer stopped. Reloading starts a new synthetic desk session.")
        snapshotIssue = "The desk stopped. Displayed values are held until you reload the desk."
    }

    private func reportLoadFailure(_ error: any Error) {
        // A deliberate reload may cancel an older navigation in this same view.
        let loadError = error as NSError
        guard loadError.domain != NSURLErrorDomain || loadError.code != NSURLErrorCancelled else { return }
        generation = UUID()
        loadState = .failed("The bundled dashboard could not be loaded. No network connection is required; try reloading the desk.")
        snapshotIssue = "The desk is unavailable. Displayed values are held."
    }
}
