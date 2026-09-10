import Foundation
import Testing
@testable import CMESpatialMarketCenter

struct BundledDashboardTests {
    @Test
    func appBundleContainsOfflineDashboard() throws {
        let dashboard = try #require(BundledDashboard.load())
        let html = try String(contentsOf: dashboard.indexURL, encoding: .utf8)
        #expect(html.contains("data-host=\"visionos\""))
        #expect(html.contains("Content-Security-Policy"))
        #expect(html.contains("connect-src 'none'"))
        #expect(html.contains("app.bundle.js\" defer"))
        #expect(!html.contains("type=\"module\""))

        for filename in BundledDashboard.requiredAssets {
            let contents = try Data(contentsOf: dashboard.directoryURL.appendingPathComponent(filename))
            #expect(!contents.isEmpty)
        }
    }

    @Test
    func allowsOnlyTheBundledEntryPageAndItsFragments() throws {
        let dashboard = BundledDashboard(directoryURL: URL(fileURLWithPath: "/demo/MarketDashboard", isDirectory: true))
        let fragment = try #require(URL(string: "#markets", relativeTo: dashboard.indexURL)?.absoluteURL)
        #expect(dashboard.allowsNavigation(to: dashboard.indexURL))
        #expect(dashboard.allowsNavigation(to: fragment))
        #expect(!dashboard.allowsNavigation(to: nil))
        #expect(!dashboard.allowsNavigation(to: dashboard.directoryURL.appendingPathComponent("app.bundle.js")))
    }

    @Test(arguments: [
        "https://example.invalid/index.html",
        "http://127.0.0.1:8765/index.html",
        "data:text/html,blocked",
        "javascript:alert(1)",
        "about:blank",
        "file:///demo/MarketDashboard/index.html?redirect=remote",
        "file:///demo/MarketDashboard/../index.html",
        "file:///demo/MarketDashboard/%2e%2e/index.html",
        "file:///demo/MarketDashboard-backup/index.html",
        "file:///private/index.html",
        "file://example.invalid/demo/MarketDashboard/index.html"
    ])
    func rejectsRemoteAndUnrelatedNavigation(destination: String) throws {
        let dashboard = BundledDashboard(directoryURL: URL(fileURLWithPath: "/demo/MarketDashboard", isDirectory: true))
        let destinationURL = try #require(URL(string: destination))
        #expect(!dashboard.allowsNavigation(to: destinationURL))
    }
}
