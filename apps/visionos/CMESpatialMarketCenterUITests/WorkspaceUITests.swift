import XCTest

final class WorkspaceUITests: XCTestCase {
    @MainActor
    func testLaunchShowsOfflineMarketDesk() {
        let application = XCUIApplication()
        application.launch()

        let status = application.staticTexts["dashboard.status"]
        XCTAssertTrue(status.waitForExistence(timeout: 10))
        let ready = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "label == %@", "Ready · No CME connection"),
            object: status
        )
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 20), .completed)

        let desk = application.webViews.firstMatch
        let pause = desk.buttons["Pause feed"].firstMatch
        XCTAssertTrue(pause.waitForExistence(timeout: 10))
        pause.tap()
        XCTAssertTrue(desk.buttons["Resume feed"].firstMatch.waitForExistence(timeout: 5))
    }

    @MainActor
    func testLaunchShowsSyntheticWorkspace() {
        let application = XCUIApplication()
        application.launch()
        openNativeWorkspace(in: application)

        XCTAssertTrue(application.staticTexts["overview.title"].waitForExistence(timeout: 10))
        XCTAssertTrue(application.staticTexts["No market data loaded"].waitForExistence(timeout: 5))
        let dataMode = application.descendants(matching: .any)["workspace.dataMode"].firstMatch
        XCTAssertTrue(dataMode.exists)
        XCTAssertTrue(dataMode.label.contains("Synthetic preview"))
    }

    @MainActor
    func testSettingsNavigationAndRefresh() {
        let application = XCUIApplication()
        application.launch()
        openNativeWorkspace(in: application)
        let settings = application.descendants(matching: .any)["navigation.settings"].firstMatch
        XCTAssertTrue(settings.waitForExistence(timeout: 10))
        settings.tap()

        let refresh = application.buttons["settings.refresh"]
        XCTAssertTrue(refresh.waitForExistence(timeout: 5))
        refresh.tap()
        XCTAssertTrue(application.staticTexts["No market data loaded"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testCompanionWindowCanOpenAndClose() {
        let application = XCUIApplication()
        application.launch()
        openNativeWorkspace(in: application)
        let workspace = application.descendants(matching: .any)["navigation.workspace"].firstMatch
        XCTAssertTrue(workspace.waitForExistence(timeout: 10))
        workspace.tap()
        let openCompanion = application.buttons["workspace.openCompanion"]
        XCTAssertTrue(openCompanion.waitForExistence(timeout: 10))
        openCompanion.tap()

        let closeCompanion = application.buttons["companion.close"]
        XCTAssertTrue(closeCompanion.waitForExistence(timeout: 10))
        closeCompanion.tap()
        XCTAssertTrue(closeCompanion.waitForNonExistence(timeout: 5))
    }

    @MainActor
    private func openNativeWorkspace(in application: XCUIApplication) {
        let openWorkspace = application.buttons["dashboard.openWorkspace"]
        XCTAssertTrue(openWorkspace.waitForExistence(timeout: 10))
        openWorkspace.tap()
    }
}
