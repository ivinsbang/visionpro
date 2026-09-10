import { expect, test } from "@playwright/test";

test("the dashboard and overview are synthetic and only load local resources", async ({ page }, testInfo) => {
    const externalRequests = [];
    const browserErrors = [];
    page.on("request", (request) => {
        if (new URL(request.url()).hostname !== "127.0.0.1") externalRequests.push(request.url());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
    });
    const response = await page.goto("/");

    await expect(page.getByRole("heading", { name: "Your markets, in focus." })).toBeVisible();
    await expect(page.locator("#market-chart .candle-body")).toHaveCount(60);
    await expect(page.locator("#feed-state")).toHaveText("Demo feed · Streaming");
    await expect(page.getByText("No external connections", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Pause feed", exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath("dashboard.png"), fullPage: true });
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(page.getByRole("heading", { name: "A wider view of the market." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Seven markets. Zero external connections." })).toBeVisible();
    expect(response.headers()["content-security-policy"]).toContain("connect-src 'none'");
    expect(externalRequests).toEqual([]);
    expect(browserErrors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("overview.png"), fullPage: true });
});

test("settings refresh stays local and reset cancels an in-flight refresh", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Keep it in view." })).toBeVisible();
    await page.getByRole("button", { name: "Refresh workspace status" }).click();
    await expect(page.locator("#connection-status")).toHaveText("Local synthetic feed is streaming. No CME connection.");

    await page.getByRole("button", { name: "Refresh workspace status" }).click();
    await page.getByRole("button", { name: "Reset layout" }).click();
    await expect(page.locator("#page-markets")).toBeVisible();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByRole("button", { name: "Refresh workspace status" })).toBeEnabled();
    await expect(page.locator("#connection-status")).toHaveText("Local synthetic feed is streaming. No CME connection.");
});

test("the companion is reused, moves by keyboard, and closes with focus restored", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    const trigger = page.getByRole("button", { name: "Open companion", exact: true });
    await trigger.click();
    const companion = page.getByRole("dialog", { name: "Workspace companion" });
    await expect(companion).toBeVisible();
    await trigger.click();
    await expect(companion).toHaveCount(1);

    const initialBounds = await companion.boundingBox();
    const moveHandle = page.getByRole("button", { name: "Move companion window" });
    await moveHandle.focus();
    await moveHandle.press("ArrowLeft");
    const movedBounds = await companion.boundingBox();
    expect(movedBounds.x).toBe(initialBounds.x - 10);

    await page.getByRole("button", { name: "Close companion window" }).click();
    await expect(companion).toBeHidden();
    await expect(trigger).toBeFocused();
});

test("spatial view rotates, drags, and closes with Escape", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Spatial workspace", exact: true }).click();
    await page.getByRole("button", { name: "Open spatial preview", exact: true }).click();
    const spatialWindow = page.getByRole("dialog", { name: "Spatial preview", exact: true });
    await expect(spatialWindow).toBeVisible();

    const angle = page.getByRole("slider", { name: "Viewing angle" });
    await angle.focus();
    await angle.press("ArrowRight");
    await expect(page.locator("#angle-value")).toHaveText("-23°");
    expect(await page.locator(".model-layout").evaluate((element) => element.style.getPropertyValue("--model-angle"))).toBe("-23deg");

    const handleBounds = await page.getByRole("button", { name: "Move spatial preview" }).boundingBox();
    const initialBounds = await spatialWindow.boundingBox();
    await page.mouse.move(handleBounds.x + 50, handleBounds.y + 15);
    await page.mouse.down();
    await page.mouse.move(handleBounds.x + 110, handleBounds.y + 45, { steps: 5 });
    await page.mouse.up();
    const movedBounds = await spatialWindow.boundingBox();
    expect(movedBounds.x).toBeCloseTo(initialBounds.x + 60, 0);
    expect(movedBounds.y).toBeCloseTo(initialBounds.y + 30, 0);

    await page.screenshot({ path: testInfo.outputPath("spatial-preview.png"), fullPage: true });
    await page.keyboard.press("Escape");
    await expect(spatialWindow).toBeHidden();
});

test("a narrow viewport keeps the preview and floating controls reachable", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Spatial workspace", exact: true }).click();
    await page.getByRole("button", { name: "Open spatial preview", exact: true }).click();
    const bounds = await page.getByRole("dialog", { name: "Spatial preview", exact: true }).boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
    await page.screenshot({ path: testInfo.outputPath("narrow-preview.png"), fullPage: true });
    await page.getByRole("button", { name: "Close spatial preview", exact: true }).click();
    await expect(page.getByRole("button", { name: "Open spatial preview", exact: true })).toBeFocused();
});
