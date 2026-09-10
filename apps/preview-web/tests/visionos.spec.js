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
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
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
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
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
