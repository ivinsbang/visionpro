import { expect, test } from "@playwright/test";

const browserIssues = new WeakMap();

test.beforeEach(async ({ context, page }) => {
    const issues = { external: [], errors: [] };
    browserIssues.set(page, issues);
    await context.route("**/*", (route) => {
        if (new URL(route.request().url()).origin === "http://127.0.0.1:8765") return route.continue();
        issues.external.push(route.request().url());
        return route.abort();
    });
    page.on("pageerror", (error) => issues.errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") issues.errors.push(message.text()); });
    await page.clock.install({ time: new Date("2026-09-09T13:30:20Z") });
});

test.afterEach(async ({ page }) => {
    expect(browserIssues.get(page)).toEqual({ external: [], errors: [] });
});

async function openRoom(page) {
    await page.goto("/?demo=3d");
    await expect(page.locator("html")).toHaveAttribute("data-dashboard-ready", "true");
    await expect(page.locator("#spatial-desk")).toBeVisible();
}

async function fillPaperOrder(page) {
    await page.locator("#spatial-feature").selectOption("paper");
    await page.locator("#paper-contract").selectOption("ES");
    await page.locator("#paper-quantity").fill("2");
    await page.locator("#paper-review-order").click();
    await expect(page.locator("#paper-review-dialog")).toBeVisible();
    await page.locator("#paper-confirm-order").click();
    await expect(page.locator("#paper-fill-count")).toHaveText("1 fill");
}

test("the 3D room uses the running dashboard and independently selectable chart with no duplicate engines", async ({ page }) => {
    await openRoom(page);
    await expect(page.locator("#spatial-desk")).toHaveAttribute("data-view", "overview");
    await expect(page.locator("#spatial-main-frame > .app-window")).toHaveCount(1);
    await expect(page.locator("#spatial-world #window-chart")).toBeVisible();
    await expect(page.locator("#spatial-world #window-companion")).toBeVisible();
    await expect(page.locator("#market-chart")).toHaveCount(1);
    const sequence = await page.locator("#feed-sequence").textContent();
    await page.clock.runFor(1600);
    await expect(page.locator("#feed-sequence")).not.toHaveText(sequence);
    await page.locator("#spatial-focus-desk").click();
    await page.getByRole("button", { name: "Select CL demo contract", exact: true }).click();
    await expect(page.locator("#companion-market")).toContainText("CL");
    await page.locator("#spatial-focus").selectOption("chart");
    await page.locator("#detached-symbol").selectOption("GC");
    await expect(page.locator("#selected-symbol")).toHaveText("CL");
    await expect(page.locator("#detached-chart")).toHaveAttribute("aria-label", /GC/);
    await page.locator("#spatial-focus").selectOption("companion");
    await expect(page.locator("#companion-price")).toHaveText(await page.locator("#selected-price").textContent());
});

test("entering and leaving 3D reuses actual DOM and preserves fills, input, watchlist, and prior flat windows", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open chart window", exact: true }).click();
    const previousStyle = await page.locator("#window-chart").getAttribute("style");
    await page.evaluate(() => { window.originalMarketWindow = document.querySelector(".app-window"); });
    const watchlist = await page.evaluate(() => localStorage.getItem("cme-spatial-demo.watchlist.v1"));
    await page.locator("#enter-spatial-desk").click();
    await fillPaperOrder(page);
    await page.locator("#spatial-feature").selectOption("portfolio");
    await expect(page.locator("#portfolio-margin")).toHaveText("$13,000.00");
    await page.locator("#exit-spatial-desk").click();
    await expect(page.locator("#spatial-desk")).toBeHidden();
    await expect(page.locator("#window-chart")).toBeVisible();
    await expect(page.locator("#window-chart")).toHaveAttribute("style", previousStyle);
    await expect(page.locator("#window-companion")).toBeHidden();
    expect(await page.evaluate(() => window.originalMarketWindow === document.querySelector(".app-window"))).toBe(true);
    await expect(page.locator(".stage > .app-window")).toHaveCount(1);
    await expect(page.locator("#paper-fill-count")).toHaveText("1 fill");
    expect(await page.evaluate(() => localStorage.getItem("cme-spatial-demo.watchlist.v1"))).toBe(watchlist);
    await page.locator("#enter-spatial-desk").click();
    await page.locator("#spatial-feature").selectOption("paper");
    await expect(page.locator("#paper-quantity")).toHaveValue("2");
    await expect(page.locator("#paper-ticket")).toHaveCount(1);
    await expect(page.locator("#paper-fill-count")).toHaveText("1 fill");
});

test("the nine-step tour shows every built feature without placing orders or resetting a funded paper session", async ({ page }) => {
    await openRoom(page);
    await fillPaperOrder(page);
    await page.locator("#spatial-start-tour").click();
    const visited = [];
    for (let index = 0; index < 9; index += 1) {
        await expect(page.locator("#spatial-tour-count")).toHaveText(`${index + 1} / 9`);
        visited.push(await page.locator("#spatial-tour-title").textContent());
        await expect(page.locator("#paper-fill-count")).toHaveText("1 fill");
        await page.locator("#spatial-tour-next").click();
    }
    await expect(page.locator("#spatial-tour-panel")).toBeHidden();
    expect(visited.some((title) => title.includes("fictional funds"))).toBe(true);
    expect(visited.some((title) => title.includes("portfolio"))).toBe(true);
    await expect(page.locator("#paper-fill-count")).toHaveText("1 fill");
    await expect(page.locator("#portfolio-position-count")).toHaveText("1");
    await expect(page.locator("#paper-reset-dialog")).toBeHidden();
    await expect(page.locator("#paper-review-dialog")).toBeHidden();
});

test("3D windows move with keyboard and pointer without the camera following their drag", async ({ page }) => {
    await openRoom(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator("#spatial-focus").selectOption("chart");
    const chart = page.locator("#window-chart");
    const handle = page.getByRole("button", { name: "Move chart window", exact: true });
    await handle.focus();
    const previousPosition = await chart.evaluate((element) => parseFloat(element.style.getPropertyValue("--panel-horizontal")));
    const before = await chart.boundingBox();
    await handle.press("ArrowLeft");
    expect(await chart.evaluate((element) => parseFloat(element.style.getPropertyValue("--panel-horizontal")))).toBe(previousPosition - 20);
    const afterKey = await chart.boundingBox();
    expect(afterKey.x).toBeLessThan(before.x - 5);
    const handleBounds = await handle.boundingBox();
    await page.mouse.move(handleBounds.x + handleBounds.width / 2, handleBounds.y + handleBounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBounds.x + handleBounds.width / 2 + 65, handleBounds.y + handleBounds.height / 2 + 30, { steps: 5 });
    await page.mouse.up();
    const afterDrag = await chart.boundingBox();
    expect(afterDrag.x).toBeGreaterThan(afterKey.x + 20);
    await expect(page.locator("#spatial-desk")).not.toHaveClass(/spatial-dragging/);
});

test("paper confirmation stays deliberate above the 3D room and Escape cancels before exiting", async ({ page }) => {
    await openRoom(page);
    await page.locator("#spatial-feature").selectOption("paper");
    await page.locator("#paper-review-order").click();
    await expect(page.locator("#paper-review-back")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("#paper-review-dialog")).toBeHidden();
    await expect(page.locator("#spatial-desk")).toBeVisible();
    await expect(page.locator("#paper-fill-count")).toHaveText("0 fills");
    await page.keyboard.press("Escape");
    await expect(page.locator("#spatial-desk")).toBeHidden();
    await expect(page.locator("#enter-spatial-desk")).toBeFocused();
});

test("camera and layout controls are bounded and never clear paper positions", async ({ page }) => {
    await openRoom(page);
    await fillPaperOrder(page);
    await page.locator("#spatial-view-controls summary").click();
    await page.locator("#spatial-orbit").fill("12");
    await page.locator("#spatial-tilt").fill("-5");
    await page.locator("#spatial-zoom").fill("110");
    expect(await page.locator("#spatial-world").evaluate((element) => element.style.getPropertyValue("--camera-yaw"))).toBe("12deg");
    await expect(page.locator("#spatial-zoom-value")).toHaveText("110%");
    await page.locator("#spatial-arrangement").selectOption("flat");
    expect(await page.locator("#window-chart").evaluate((element) => element.style.getPropertyValue("--panel-rotation"))).toBe("0deg");
    await page.locator("#spatial-recenter").click();
    await expect(page.locator("#paper-fill-count")).toHaveText("1 fill");
    await expect(page.locator("#portfolio-margin")).toHaveText("$13,000.00");
    await page.locator("#spatial-view-controls summary").click();
    await page.locator("#spatial-focus").selectOption("chart");
    await page.getByRole("button", { name: "Close chart window", exact: true }).click();
    await expect(page.locator("#spatial-desk")).toHaveAttribute("data-view", "desk");
    await page.locator("#spatial-focus").selectOption("chart");
    await expect(page.locator("#window-chart")).toBeVisible();
});

test("mobile 3D focus, paper forms, portfolio, and tour controls remain reachable with reduced motion", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openRoom(page);
    await expect(page.locator("#spatial-desk")).toHaveAttribute("data-view", "desk");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await fillPaperOrder(page);
    await page.locator("#spatial-feature").selectOption("portfolio");
    await expect(page.locator("#portfolio-margin")).toHaveText("$13,000.00");
    await page.screenshot({ path: testInfo.outputPath("mobile-3d-portfolio.png") });
    await page.locator("#spatial-start-tour").click();
    await page.locator("#spatial-tour-next").click();
    await expect(page.locator("#spatial-tour-count")).toHaveText("2 / 9");
    await page.locator("#spatial-tour-close").click();
    await page.locator("#exit-spatial-desk").click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator("#paper-fill-count")).toHaveText("1 fill");
});

test("resizing and the 3D spatial model retain data and return to usable ordinary controls", async ({ page }, testInfo) => {
    await openRoom(page);
    await page.locator("#spatial-focus").selectOption("spatial");
    await page.locator("#viewing-angle").fill("10");
    expect(await page.locator(".model-layout").evaluate((element) => element.style.getPropertyValue("--model-angle"))).toBe("10deg");
    await page.setViewportSize({ width: 1040, height: 590 });
    await page.locator("#spatial-feature").selectOption("settings");
    await page.locator("#simulate-outage").click();
    await page.locator("#spatial-feature").selectOption("paper");
    await expect(page.locator("#paper-review-order")).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath("compact-3d-paper.png") });
    await page.locator("#exit-spatial-desk").click();
    await expect(page.locator("#paper-review-order")).toBeDisabled();
    await page.locator('[data-page="markets"]').click();
    await page.locator("#reconnect-feed").click();
    await expect(page.locator("#feed-state")).toContainText("Streaming");
});
