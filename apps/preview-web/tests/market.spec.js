import { expect, test } from "@playwright/test";

const browserIssues = new WeakMap();

test.beforeEach(async ({ page }) => {
    const issues = { externalRequests: [], errors: [] };
    browserIssues.set(page, issues);
    page.on("request", (request) => {
        if (new URL(request.url()).hostname !== "127.0.0.1") issues.externalRequests.push(request.url());
    });
    page.on("pageerror", (error) => issues.errors.push(error.message));
    page.on("console", (message) => {
        if (message.type() === "error") issues.errors.push(message.text());
    });
    await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
});

test.afterEach(async ({ page }) => {
    expect(browserIssues.get(page).externalRequests).toEqual([]);
    expect(browserIssues.get(page).errors).toEqual([]);
});

test("synthetic streaming advances, pauses without rewriting timestamps, and resumes", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-09-09T13:30:20Z") });
    await page.goto("/");
    const startingSequence = await page.locator("#feed-sequence").textContent();
    await page.clock.runFor(1600);
    await expect(page.locator("#feed-sequence")).not.toHaveText(startingSequence);
    await page.getByRole("button", { name: "Pause feed", exact: true }).click();
    const frozen = await page.evaluate(() => ({
        price: document.querySelector("#selected-price").textContent,
        time: document.querySelector("#market-generated-at").textContent,
        header: document.querySelector("#header-feed-time").textContent,
        depth: document.querySelector("#depth-rows").textContent,
        tape: document.querySelector("#trade-rows").textContent,
        sequence: document.querySelector("#feed-sequence").textContent
    }));
    await page.clock.runFor(6000);
    await expect(page.locator("#selected-price")).toHaveText(frozen.price);
    await expect(page.locator("#market-generated-at")).toHaveText(frozen.time);
    await expect(page.locator("#header-feed-time")).toHaveText(frozen.header);
    await expect(page.locator("#depth-rows")).toHaveText(frozen.depth);
    await expect(page.locator("#trade-rows")).toHaveText(frozen.tape);
    await expect(page.locator("#feed-sequence")).toHaveText(frozen.sequence);
    await expect(page.locator("#data-freshness")).toHaveText("Paused snapshot");
    await page.getByRole("button", { name: "Resume feed", exact: true }).click();
    await expect(page.locator("#feed-sequence")).not.toHaveText(frozen.sequence);
    await expect(page.locator("#data-freshness")).toHaveText("Fresh synthetic data");
});

test("contract selection links price, chart, book, tape, and companion", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Pause feed", exact: true }).click();
    await page.getByRole("button", { name: "Select NQ demo contract", exact: true }).click();
    await expect(page.locator("#selected-name")).toHaveText("E-mini Nasdaq-100");
    await expect(page.locator("#market-chart")).toHaveAttribute("aria-label", /NQ synthetic candlestick chart/);
    await expect(page.locator("#depth-symbol")).toHaveText("NQ · DEMO");
    await expect(page.locator("#trade-rows tr").first()).toHaveAttribute("data-print-id", /^NQ-/);
    await page.getByRole("button", { name: "Open companion", exact: true }).click();
    await expect(page.locator("#companion-market")).toHaveText("NQ · E-mini Nasdaq-100");
    await expect(page.locator("#companion-price")).toHaveText(await page.locator("#selected-price").textContent());
    await expect(page.locator("#companion-feed-state")).toHaveText("Paused snapshot");
});

test("search, asset filters, and the no-results action work together", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("combobox", { name: "Filter by asset class" }).selectOption("Energy");
    await expect(page.locator(".market-row:visible")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Select CL demo contract", exact: true })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search demo contracts" }).fill("gold");
    await expect(page.locator("#market-empty-message")).toHaveText("No matching demo contracts.");
    await page.getByRole("button", { name: "Show all markets", exact: true }).click();
    await expect(page.locator(".market-row:visible")).toHaveCount(7);
    await expect(page.getByRole("searchbox", { name: "Search demo contracts" })).toHaveValue("");
    await page.getByRole("searchbox", { name: "Search demo contracts" }).fill("euro");
    await expect(page.locator(".market-row:visible")).toHaveCount(1);
    await page.getByRole("button", { name: "Select 6E demo contract", exact: true }).click();
    await expect(page.locator("#selected-price")).toHaveText(/^1\.\d{5}$/);
});

test("a custom watchlist survives reload, including an intentionally empty list", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Add ZC to watchlist", exact: true }).click();
    await expect(page.locator("#watchlist-count")).toHaveText("5 saved");
    await page.reload();
    await page.getByRole("button", { name: "Watchlist", exact: true }).click();
    await expect(page.locator(".market-row:visible")).toHaveCount(5);
    for (const symbol of ["ES", "NQ", "CL", "GC", "ZC"]) {
        await page.getByRole("button", { name: `Remove ${symbol} from watchlist`, exact: true }).click();
    }
    await expect(page.locator("#market-empty-message")).toContainText("Your watchlist is empty.");
    await expect(page.getByRole("button", { name: "All markets", exact: true })).toBeFocused();
    await page.reload();
    await page.getByRole("button", { name: "Watchlist", exact: true }).click();
    await expect(page.locator("#watchlist-count")).toHaveText("0 saved");
    await expect(page.locator(".market-row:visible")).toHaveCount(0);
});

test("malformed saved preferences recover to a usable default watchlist", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("cme-spatial-demo.watchlist.v1", "{bad json"));
    await page.goto("/");
    await expect(page.locator("#watchlist-count")).toHaveText("4 saved");
    await page.getByRole("button", { name: "Add ZC to watchlist", exact: true }).click();
    await expect(page.locator("#watchlist-count")).toHaveText("5 saved");
});

test("unavailable browser storage does not break watchlist interaction", async ({ page }) => {
    await page.addInitScript(() => {
        Storage.prototype.setItem = () => { throw new DOMException("Storage disabled", "SecurityError"); };
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Add ZC to watchlist", exact: true }).click();
    await expect(page.locator("#watchlist-count")).toHaveText("5 saved");
    await expect(page.locator("#watchlist-storage")).toHaveText("Storage unavailable. Watchlist kept for this tab only.");
});

test("chart ranges, rendering modes, and keyboard inspection are interactive", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Pause feed", exact: true }).click();
    await page.getByRole("button", { name: "15 minutes", exact: true }).click();
    await expect(page.locator("#market-chart .candle-body")).toHaveCount(15);
    await page.getByRole("button", { name: "4 hours", exact: true }).click();
    const aggregateCount = await page.locator("#market-chart .candle-body").count();
    expect(aggregateCount).toBeGreaterThanOrEqual(60);
    expect(aggregateCount).toBeLessThanOrEqual(61);
    await page.getByRole("button", { name: "Area", exact: true }).click();
    await expect(page.locator("#market-chart .price-area-line")).toHaveCount(1);
    await expect(page.locator("#market-chart .candle-body")).toHaveCount(0);
    await page.locator("#market-chart").focus();
    await page.locator("#market-chart").press("Home");
    const firstTime = await page.locator("#market-chart").getAttribute("data-inspected-time");
    await expect(page.locator("#market-chart .chart-marker")).toHaveCount(1);
    await page.locator("#market-chart").press("End");
    expect(Number(await page.locator("#market-chart").getAttribute("data-inspected-time"))).toBeGreaterThan(Number(firstTime));
    await page.locator("#market-chart").press("Escape");
    await expect(page.locator("#market-chart .chart-marker")).toHaveCount(0);
});

test("a floating chart keeps its own contract and reuses the same window", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Pause feed", exact: true }).click();
    const trigger = page.getByRole("button", { name: "Open chart window", exact: true });
    await trigger.click();
    const chartWindow = page.getByRole("dialog", { name: "Independent chart screen", exact: true });
    await expect(chartWindow).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Chart screen contract" })).toHaveValue("NQ");
    await page.getByRole("combobox", { name: "Chart screen contract" }).selectOption("CL");
    await expect(page.locator("#selected-symbol")).toHaveText("ES");
    await expect(page.locator("#detached-chart")).toHaveAttribute("aria-label", /CL synthetic area chart/);
    await page.getByRole("button", { name: "Select GC demo contract", exact: true }).click();
    await expect(page.locator("#selected-symbol")).toHaveText("GC");
    await expect(page.getByRole("combobox", { name: "Chart screen contract" })).toHaveValue("CL");
    await trigger.click();
    await expect(chartWindow).toHaveCount(1);
    const before = await chartWindow.boundingBox();
    await page.getByRole("button", { name: "Move chart window", exact: true }).press("Shift+ArrowLeft");
    expect((await chartWindow.boundingBox()).x).toBeCloseTo(before.x - 40, 0);
    await page.screenshot({ path: testInfo.outputPath("independent-chart.png"), fullPage: true });
    await page.getByRole("button", { name: "Close chart window", exact: true }).click();
    await expect(chartWindow).toBeHidden();
    await expect(trigger).toBeFocused();
});

test("an interrupted demo feed keeps stale snapshots and reconnects locally", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-09-09T13:30:20Z") });
    await page.goto("/");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Simulate feed outage", exact: true }).click();
    await expect(page.locator("#connection-status")).toHaveText("Local synthetic feed is interrupted. No CME connection.");
    const sequence = await page.locator("#feed-sequence").textContent();
    const generated = await page.locator("#header-feed-time").textContent();
    await page.clock.runFor(6500);
    await expect(page.locator("#feed-sequence")).toHaveText(sequence);
    await expect(page.locator("#header-feed-time")).toHaveText(generated);
    await page.getByRole("button", { name: "Market desk", exact: true }).click();
    await expect(page.locator("#feed-interrupted")).toBeVisible();
    await expect(page.locator("#data-freshness")).toHaveText("Stale snapshot");
    await expect(page.locator("#detached-feed-label")).toContainText("Stale snapshot");
    await expect(page.locator("#spatial-feed-label")).toContainText("Stale snapshot");
    await page.getByRole("button", { name: "Reconnect demo feed", exact: true }).click();
    await expect(page.locator("#feed-interrupted")).toBeHidden();
    await expect(page.locator("#feed-sequence")).not.toHaveText(sequence);
    await expect(page.locator("#data-freshness")).toHaveText("Fresh synthetic data");
    await expect(page.getByRole("button", { name: "Pause feed", exact: true })).toBeFocused();
});

test("restarting a synthetic session preserves saved markets", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Add ZC to watchlist", exact: true }).click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Simulate feed outage", exact: true }).click();
    await page.getByRole("button", { name: "Restart synthetic session", exact: true }).click();
    await expect(page.locator("#connection-status")).toHaveText("Local synthetic feed is streaming. No CME connection.");
    await page.getByRole("button", { name: "Market desk", exact: true }).click();
    await expect(page.locator("#watchlist-count")).toHaveText("5 saved");
    await expect(page.locator("#feed-interrupted")).toBeHidden();
});

test("a narrow dashboard and independent chart remain reachable with reduced motion", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: "Pause feed", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("mobile-dashboard.png"), fullPage: true });
    await page.getByRole("button", { name: "Open chart window", exact: true }).click();
    const chartWindow = page.getByRole("dialog", { name: "Independent chart screen", exact: true });
    const bounds = await chartWindow.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
    await page.getByRole("combobox", { name: "Chart screen contract" }).selectOption("6E");
    await expect(page.locator("#detached-price")).toHaveText(/^1\.\d{5}$/);
    await page.getByRole("button", { name: "Close chart window", exact: true }).click();
    await expect(page.getByRole("button", { name: "Open chart window", exact: true })).toBeFocused();
});
