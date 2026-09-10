import Foundation

struct BundledDashboard {
    static let requiredAssets = ["index.html", "app.bundle.js", "dashboard.css", "icon.svg"]

    let directoryURL: URL

    var indexURL: URL {
        directoryURL.appendingPathComponent("index.html", isDirectory: false)
    }

    static func load(bundle: Bundle = .main) -> BundledDashboard? {
        guard let indexURL = bundle.url(forResource: "index", withExtension: "html", subdirectory: "MarketDashboard") else {
            return nil
        }
        let dashboard = BundledDashboard(directoryURL: indexURL.deletingLastPathComponent())
        let hasAllAssets = requiredAssets.allSatisfy { filename in
            let assetURL = dashboard.directoryURL.appendingPathComponent(filename, isDirectory: false)
            return (try? assetURL.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true
        }
        return hasAllAssets ? dashboard : nil
    }

    func allowsNavigation(to destination: URL?) -> Bool {
        guard let destination,
              destination.isFileURL,
              destination.host == nil || destination.host == "",
              destination.user == nil,
              destination.password == nil,
              destination.port == nil,
              destination.query == nil else {
            return false
        }
        let destinationPath = destination.standardizedFileURL.resolvingSymlinksInPath().path
        let indexPath = indexURL.standardizedFileURL.resolvingSymlinksInPath().path
        return destinationPath == indexPath
    }
}
