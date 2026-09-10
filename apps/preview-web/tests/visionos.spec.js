import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { bundleDirectory } from "../scripts/build-visionos.js";

const dashboardURL = pathToFileURL(path.join(bundleDirectory, "index.html")).href;
const browserIssues = new WeakMap();

test.beforeEach(async ({ browserName, context, page }) => {
    const issues = { externalRequests: [], routedRequests: [], errors: [], expectsPolicyViolations: false };
    browserIssues.set(page, issues);
    if (browserName !== "webkit") await context.setOffline(true);
    await context.route(/^https?:\/\//, (route) => {
        issues.routedRequests.push(route.request().url());
        return route.abort();
    });
    page.on("request", (request) => {
        if (!/^(file|data):/.test(request.url())) issues.externalRequests.push(request.url());
    });
    page.on("pageerror", (error) => issues.errors.push(error.message));
    page.on("console", (message) => {
        const expectedRejection = issues.expectsPolicyViolations && /content.?security.?policy|violates.*directive|refused to/i.test(message.text());
        if (message.type() === "error" && !expectedRejection) issues.errors.push(message.text());
    });
});

test.afterEach(async ({ page }) => {
    const issues = browserIssues.get(page);
    expect(issues.routedRequests).toEqual([]);
    if (!issues.expectsPolicyViolations) expect(issues.externalRequests).toEqual([]);
    expect(issues.errors).toEqual([]);
});

async function openDesk(page) {
    await page.goto(dashboardURL);
    await expect(page.locator("html")).toHaveAttribute("data-dashboard-ready", "true");
    await expect(page.locator("html")).toHaveAttribute("data-host", "visionos");
}

test("surround snapshots follow the selected market and the full saved watchlist", async ({ page }) => {
    await openDesk(page);
    await page.getByRole("button", { name: "Select CL demo contract", exact: true }).click();
    await page.getByRole("button", { name: "Add ZC to watchlist", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search demo contracts" }).fill("CL");
    const result = await page.evaluate(() => ({
        snapshot: window.readNativeDeskSnapshot(),
        last: document.querySelector("#selected-price").textContent,
        generatedAt: document.querySelector("#market-generated-at").title,
        depth: [...document.querySelectorAll("#depth-rows tr")].map((row) => [...row.cells].map((cell) => cell.textContent))
    }));
    const panels = new Map(result.snapshot.panels.map((panel) => [panel.id, panel]));
    expect(result.snapshot.version).toBe(1);
    expect(result.snapshot.source).toContain("synthetic");
    expect(result.snapshot.generatedAt).toBe(result.generatedAt);
    expect(panels.size).toBe(5);
    expect(panels.get("chart").title).toContain("CL");
    expect(panels.get("chart").metrics[0].value).toBe(result.last);
    expect(panels.get("chart").chartValues).toHaveLength(60);
    expect(panels.get("chart").chartValues.at(-1)).toBe(Number(result.last.replaceAll(",", "")));
    expect(panels.get("depth").rows).toEqual(result.depth);
    expect(panels.get("watchlist").rows.map((row) => row[0])).toContain("ZC");
    expect(panels.get("watchlist").rows).toHaveLength(5);
    for (const panel of panels.values()) {
        expect(panel.rows.every((row) => row.length === panel.columns.length)).toBe(true);
    }

    // Reading a projection cannot mutate feed, paper orders, or watchlist state.
    await page.getByRole("button", { name: "Pause feed", exact: true }).click();
    const before = await page.evaluate(() => window.readNativeDeskSnapshot());
    const after = await page.evaluate(() => {
        for (let index = 0; index < 20; index += 1) window.readNativeDeskSnapshot();
        return window.readNativeDeskSnapshot();
    });
    expect(after).toEqual(before);
});

test("surround portfolio and risk read confirmed fills from the existing paper ledger", async ({ page }) => {
    await openDesk(page);
    await page.locator('[data-page="paper"]').click();
    await page.locator("#paper-contract").selectOption("CL");
    await page.locator("#paper-quantity").fill("2");
    await page.getByRole("button", { name: "Review paper order", exact: true }).click();
    const reviewed = await page.evaluate(() => window.readNativeDeskSnapshot());
    expect(reviewed.panels.find((panel) => panel.id === "portfolio").rows).toEqual([]);
    expect(reviewed.panels.find((panel) => panel.id === "risk").rows).toEqual([]);
    await page.getByRole("button", { name: "Confirm paper order", exact: true }).click();
    await expect(page.locator("#paper-fill-count")).toHaveText("1 fill");

    // The portfolio page can remain hidden; its values still belong to this account.
    const result = await page.evaluate(() => ({
        snapshot: window.readNativeDeskSnapshot(),
        equity: document.querySelector("#portfolio-equity").textContent,
        margin: document.querySelector("#portfolio-margin").textContent,
        fillID: document.querySelector("#paper-fill-rows tr").dataset.fillId
    }));
    const portfolio = result.snapshot.panels.find((panel) => panel.id === "portfolio");
    const risk = result.snapshot.panels.find((panel) => panel.id === "risk");
    expect(portfolio.metrics[0].value).toBe(result.equity);
    expect(portfolio.rows).toHaveLength(1);
    expect(portfolio.rows[0].slice(0, 2)).toEqual(["CL Energy", "Long 2"]);
    expect(risk.metrics.find((metric) => metric.label === "Demo margin").value).toBe(result.margin);
    expect(risk.rows).toHaveLength(1);
    expect(risk.rows[0][0]).toContain(result.fillID);
    expect(risk.rows[0].slice(1, 4)).toEqual(["CL", "Buy", "2"]);
    expect(portfolio.rows[0]).toHaveLength(6); // No native close/submit command.

    await page.locator('[data-page="portfolio"]').click();
    await page.getByRole("button", { name: "Reset paper account", exact: true }).click();
    await page.getByRole("button", { name: "Confirm paper reset", exact: true }).click();
    const reset = await page.evaluate(() => window.readNativeDeskSnapshot());
    expect(reset.panels.find((panel) => panel.id === "portfolio").rows).toEqual([]);
    expect(reset.panels.find((panel) => panel.id === "risk").rows).toEqual([]);
});

test("surround reads mark old quotes stale even while the dashboard timer is suspended", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-09-10T12:00:00Z") });
    await page.clock.pauseAt(new Date("2026-09-10T12:00:01Z"));
    await openDesk(page);
    const initial = await page.evaluate(() => window.readNativeDeskSnapshot());
    await page.clock.setSystemTime(new Date("2026-09-10T12:00:11Z"));
    const stale = await page.evaluate(() => window.readNativeDeskSnapshot());
    expect(stale.generatedAt).toBe(initial.generatedAt);
    expect(stale.freshness).toBe("Stale snapshot");
    expect(stale.panels.find((panel) => panel.id === "portfolio").note).toContain("held synthetic marks");
});

test("surround projections keep held timestamps through pause and outage", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-09-10T12:00:00Z") });
    await openDesk(page);
    await page.getByRole("button", { name: "Pause feed", exact: true }).click();
    const paused = await page.evaluate(() => window.readNativeDeskSnapshot());
    await page.clock.runFor(8000);
    const held = await page.evaluate(() => window.readNativeDeskSnapshot());
    expect(held.generatedAt).toBe(paused.generatedAt);
    expect(held.freshness).toBe("Paused snapshot");
    expect(held.panels.find((panel) => panel.id === "portfolio").note).toContain("held synthetic marks");
    await page.getByRole("button", { name: "Resume feed", exact: true }).click();
    await page.locator('[data-page="settings"]').click();
    await page.getByRole("button", { name: "Simulate feed outage", exact: true }).click();
    const interrupted = await page.evaluate(() => window.readNativeDeskSnapshot());
    await page.clock.runFor(8000);
    const stale = await page.evaluate(() => window.readNativeDeskSnapshot());
    expect(stale.generatedAt).toBe(interrupted.generatedAt);
    expect(stale.freshness).toBe("Stale snapshot");
    expect(stale.panels.find((panel) => panel.id === "chart").chartValues)
        .toEqual(interrupted.panels.find((panel) => panel.id === "chart").chartValues);
});

for (const viewport of [{ width: 1440, height: 840 }, { width: 1040, height: 590 }, { width: 600, height: 600 }]) {
    test(`native document scrolling reaches every page bottom at ${viewport.width}x${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await openDesk(page);

        for (const tab of ["markets", "paper", "portfolio", "overview", "workspace", "settings"]) {
            await page.locator(`.navigation [data-page="${tab}"]`).click();
            await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

            // WKWebView's main scroll view needs document overflow, even when a
            // desktop browser can scroll a nested element with the mouse wheel.
            if (tab === "markets" || viewport.height <= 600) {
                expect(await page.evaluate(() => document.scrollingElement.scrollHeight > innerHeight)).toBe(true);
            }

            const content = page.locator(".content-scroll");
            const bounds = await content.boundingBox();
            await page.mouse.move(bounds.x + bounds.width - 40, Math.min(bounds.y + 100, viewport.height - 40));
            await page.mouse.wheel(0, 10000);

            await expect(page.locator(".window-footer")).toBeInViewport({ ratio: 1 });
            await expect.poll(() => page.locator(`#page-${tab}`).evaluate((element) =>
                element.lastElementChild.getBoundingClientRect().bottom
            )).toBeLessThanOrEqual(viewport.height);
            await expect.poll(() => page.evaluate(() => {
                const scroller = document.scrollingElement;
                return scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
            })).toBe(true);
            expect(await content.evaluate((element) => element.scrollTop)).toBe(0);

            if (viewport.width > 720) {
                await expect(page.locator('.navigation [data-page="settings"]')).toBeInViewport({ ratio: 1 });
            }
        }
    });
}

test("bundled file loads and streams without network requests or a server", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-09-09T13:30:20Z") });
    await openDesk(page);
    await expect(page.locator("#selected-price")).not.toHaveText("—");
    await expect(page.locator("#depth-rows tr")).toHaveCount(8);
    await expect(page.locator("#trade-rows tr")).toHaveCount(5);
    const sequence = await page.locator("#feed-sequence").textContent();
    await page.clock.runFor(1600);
    await expect(page.locator("#feed-sequence")).not.toHaveText(sequence);
    await page.getByRole("button", { name: "Pause feed", exact: true }).click();
    const timestamp = await page.locator("#market-generated-at").textContent();
    await page.clock.runFor(6000);
    await expect(page.locator("#market-generated-at")).toHaveText(timestamp);
    await expect(page.locator("#data-freshness")).toHaveText("Paused snapshot");
});

test("bundled selection, independent chart, and spatial panel stay interactive", async ({ page }) => {
    await openDesk(page);
    await page.getByRole("button", { name: "Select CL demo contract", exact: true }).click();
    await expect(page.locator("#selected-symbol")).toHaveText("CL");
    await expect(page.locator("#depth-symbol")).toHaveText("CL · DEMO");
    await page.getByRole("button", { name: "Area", exact: true }).click();
    await expect(page.locator("#market-chart .price-area-line")).toHaveCount(1);
    await page.getByRole("button", { name: "Open chart window", exact: true }).click();
    await page.getByRole("combobox", { name: "Chart screen contract" }).selectOption("GC");
    await expect(page.locator("#detached-chart")).toHaveAttribute("aria-label", /GC synthetic/);
    await expect(page.locator("#selected-symbol")).toHaveText("CL");
    const chart = page.locator("#window-chart");
    const beforeMove = await chart.boundingBox();
    await page.getByRole("button", { name: "Move chart window", exact: true }).press("ArrowRight");
    expect((await chart.boundingBox()).x).toBeGreaterThan(beforeMove.x);
    await page.getByRole("button", { name: "Close chart window", exact: true }).click();
    await page.getByRole("button", { name: "Open spatial screens", exact: true }).click();
    await expect(page.locator("#window-spatial")).toBeVisible();
    await page.locator("#viewing-angle").fill("12");
    await expect(page.locator("#angle-value")).toHaveText("12°");
    await page.getByRole("button", { name: "Close spatial preview", exact: true }).click();
    await expect(page.locator("#window-spatial")).toBeHidden();
});

test("native watchlist uses memory even when file-origin storage is unavailable", async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(window, "localStorage", { get() { throw new Error("Storage must not be used by the native host"); } });
    });
    await openDesk(page);
    await page.getByRole("button", { name: "Add ZC to watchlist", exact: true }).click();
    await expect(page.locator("#watchlist-count")).toHaveText("5 saved");
    await expect(page.locator("#watchlist-storage")).toHaveText("Watchlist kept for this open desk only.");
    await page.getByRole("button", { name: "Watchlist", exact: true }).click();
    await expect(page.locator(".market-row:visible")).toHaveCount(5);
    await page.reload();
    await expect(page.locator("#watchlist-count")).toHaveText("4 saved");
});

test("offline demo outage and recovery work at the native minimum window size", async ({ page }) => {
    await page.setViewportSize({ width: 1040, height: 590 });
    await openDesk(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator('[data-page="settings"]').click();
    await page.getByRole("button", { name: "Simulate feed outage", exact: true }).click();
    await page.locator('[data-page="markets"]').click();
    await expect(page.locator("#feed-interrupted")).toBeVisible();
    await expect(page.locator("#data-freshness")).toHaveText("Stale snapshot");
    await page.getByRole("button", { name: "Reconnect demo feed", exact: true }).click();
    await expect(page.locator("#feed-interrupted")).toBeHidden();
    await expect(page.locator("#feed-state")).toHaveText("Demo feed · Streaming");
    await page.getByRole("button", { name: "Open chart window", exact: true }).click();
    const bounds = await page.locator("#window-chart").boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(590);
    await page.getByRole("button", { name: "Close chart window", exact: true }).click();
});

test("bundled paper orders require confirmation, update the portfolio, and reset on reload", async ({ page }) => {
    await openDesk(page);
    await page.locator('[data-page="paper"]').click();
    await page.locator("#paper-contract").selectOption("CL");
    await page.locator("#paper-quantity").fill("2");
    await page.getByRole("button", { name: "Review paper order", exact: true }).click();
    await expect(page.locator("#paper-review-dialog")).toBeVisible();
    await expect(page.locator("#paper-fill-rows tr")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Back to ticket", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Confirm paper order", exact: true }).click();
    await expect(page.locator("#paper-fill-count")).toHaveText("1 fill");
    await page.locator('[data-page="portfolio"]').click();
    await expect(page.locator('#portfolio-position-rows tr[data-symbol="CL"]')).toContainText("Long 2");
    await expect(page.locator("#portfolio-margin")).toHaveText("$8,000.00");
    await page.reload();
    await page.locator('[data-page="paper"]').click();
    await expect(page.locator("#paper-fill-count")).toHaveText("0 fills");
    await expect(page.locator("#paper-equity")).toHaveText("$100,000.00");
});

test("bundled paper trading honors paused data and confirms destructive resets at compact size", async ({ page }) => {
    await page.setViewportSize({ width: 1040, height: 590 });
    await openDesk(page);
    await page.getByRole("button", { name: "Pause feed", exact: true }).click();
    await page.locator('[data-page="paper"]').click();
    await expect(page.locator("#paper-review-order")).toBeDisabled();
    await page.locator('[data-page="markets"]').click();
    await page.getByRole("button", { name: "Resume feed", exact: true }).click();
    await page.locator('[data-page="paper"]').click();
    await page.getByRole("button", { name: "Review paper order", exact: true }).click();
    const bounds = await page.locator("#paper-review-dialog").boundingBox();
    expect(bounds.height).toBeLessThanOrEqual(590);
    await page.getByRole("button", { name: "Confirm paper order", exact: true }).click();
    await page.locator('[data-page="settings"]').click();
    await page.getByRole("button", { name: "Restart synthetic session", exact: true }).click();
    await page.getByRole("button", { name: "Keep my session", exact: true }).click();
    await page.locator('[data-page="portfolio"]').click();
    await expect(page.locator("#portfolio-position-count")).toHaveText("1");
    await page.getByRole("button", { name: "Reset paper account", exact: true }).click();
    await page.getByRole("button", { name: "Confirm paper reset", exact: true }).click();
    await expect(page.locator("#portfolio-position-count")).toHaveText("0");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("bundled 3D room reuses paper state and exits without network or ledger reset", async ({ page }) => {
    await openDesk(page);
    await page.getByRole("button", { name: "Open chart window", exact: true }).click();
    await page.locator("#enter-spatial-desk").click();
    await expect(page.locator("#spatial-main-frame > .app-window")).toHaveCount(1);
    await page.locator("#spatial-feature").selectOption("paper");
    await page.locator("#paper-review-order").click();
    await expect(page.locator("#paper-review-dialog")).toBeVisible();
    await page.locator("#paper-confirm-order").click();
    await page.locator("#spatial-feature").selectOption("portfolio");
    await expect(page.locator("#portfolio-margin")).toHaveText("$6,500.00");
    await page.locator("#exit-spatial-desk").click();
    await expect(page.locator("#paper-fill-count")).toHaveText("1 fill");
    await expect(page.locator(".stage > .app-window")).toHaveCount(1);
});

test("bundled compact 3D tour and spatial controls remain usable without pretending to be native tracking", async ({ page }) => {
    await page.setViewportSize({ width: 1040, height: 590 });
    await openDesk(page);
    await page.locator("#enter-spatial-desk").click();
    await page.locator("#spatial-start-tour").click();
    await page.locator("#spatial-tour-next").click();
    await expect(page.locator("#spatial-tour-count")).toHaveText("2 / 9");
    await page.locator("#spatial-tour-close").click();
    await page.locator("#spatial-focus").selectOption("spatial");
    await page.locator("#viewing-angle").fill("15");
    await expect(page.locator("#spatial-desk")).toContainText("Browser 3D demo, not Vision Pro footage");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator("#spatial-desk")).toBeHidden();
    await expect(page.locator("#paper-fill-count")).toHaveText("0 fills");
});

test("bundled content policy blocks external fetches, assets, and inline scripts", async ({ page }) => {
    await openDesk(page);
    browserIssues.get(page).expectsPolicyViolations = true;
    await page.evaluate(async () => {
        window.blockedDirectives = [];
        document.addEventListener("securitypolicyviolation", (event) => window.blockedDirectives.push(event.effectiveDirective));
        const remoteImage = new Image();
        remoteImage.src = "https://example.invalid/image.png";
        document.body.append(remoteImage);
        const remoteScript = document.createElement("script");
        remoteScript.src = "https://example.invalid/script.js";
        document.head.append(remoteScript);
        const inlineScript = document.createElement("script");
        inlineScript.textContent = "document.documentElement.dataset.inlineEscaped = 'true'";
        document.head.append(inlineScript);
        await fetch("https://example.invalid/quotes").catch(() => undefined);
    });
    await expect.poll(() => page.evaluate(() => window.blockedDirectives.includes("connect-src"))).toBe(true);
    await expect.poll(() => page.evaluate(() => window.blockedDirectives.includes("img-src"))).toBe(true);
    await expect.poll(() => page.evaluate(() => window.blockedDirectives.some((directive) => directive.startsWith("script-src")))).toBe(true);
    await expect(page.locator("html")).not.toHaveAttribute("data-inline-escaped", "true");
});
