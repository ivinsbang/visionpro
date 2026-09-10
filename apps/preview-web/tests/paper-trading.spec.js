import { expect, test } from "@playwright/test";

const issues = new WeakMap();

test.beforeEach(async ({ context, page }) => {
    const state = { external: [], errors: [] };
    issues.set(page, state);
    await context.route("**/*", (route) => {
        if (new URL(route.request().url()).origin === "http://127.0.0.1:8765") return route.continue();
        state.external.push(route.request().url());
        return route.abort();
    });
    page.on("pageerror", (error) => state.errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") state.errors.push(message.text()); });
    await page.clock.install({ time: new Date("2026-09-09T13:30:20Z") });
});

test.afterEach(async ({ page }) => {
    expect(issues.get(page)).toEqual({ external: [], errors: [] });
});

async function openPaper(page) {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-dashboard-ready", "true");
    await page.locator('[data-page="paper"]').click();
}

async function submitPaper(page, { symbol = "ES", quantity = "1", side = "buy" } = {}) {
    await page.locator("#paper-contract").selectOption(symbol);
    await page.locator("#paper-quantity").fill(quantity);
    await page.locator(`[data-paper-side="${side}"]`).click();
    await page.getByRole("button", { name: "Review paper order", exact: true }).click();
    await expect(page.locator("#paper-review-dialog")).toBeVisible();
    await page.getByRole("button", { name: "Confirm paper order", exact: true }).click();
    await expect(page.locator("#paper-review-dialog")).toBeHidden();
}

test("a selected market opens a reviewed paper order and fills only after explicit confirmation", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Show NQ demo contract", exact: true }).click();
    await page.getByRole("button", { name: "Paper trade this contract", exact: true }).click();
    await expect(page.locator("#paper-contract")).toHaveValue("NQ");
    await expect(page.locator("#paper-equity")).toHaveText("$100,000.00");
    await page.getByRole("button", { name: "Review paper order", exact: true }).click();
    await expect(page.getByRole("button", { name: "Back to ticket", exact: true })).toBeFocused();
    await expect(page.locator("#paper-review-description")).toHaveText(/Buy 1 NQ demo contract/);
    await expect(page.locator("#paper-review-margin")).toHaveText("$7,500.00");
    await expect(page.locator("#paper-fill-rows tr")).toHaveCount(0);
    await page.getByRole("button", { name: "Confirm paper order", exact: true }).click();
    await expect(page.locator("#paper-fill-rows tr")).toHaveCount(1);
    await expect(page.locator("#paper-success")).toContainText("No real order was placed");
    await page.locator('[data-page="portfolio"]').click();
    await expect(page.locator('#portfolio-position-rows tr[data-symbol="NQ"]')).toContainText("Long 1");
    await expect(page.locator("#portfolio-margin")).toHaveText("$7,500.00");
});

test("Escape and back cancel review without fills and do not close a background spatial window", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open chart window", exact: true }).click();
    await page.locator('[data-page="paper"]').click();
    await page.getByRole("button", { name: "Review paper order", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#paper-review-dialog")).toBeHidden();
    await expect(page.locator("#window-chart")).toBeVisible();
    await expect(page.getByRole("button", { name: "Review paper order", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator("#window-chart")).toBeHidden();
    await page.getByRole("button", { name: "Review paper order", exact: true }).click();
    await page.getByRole("button", { name: "Back to ticket", exact: true }).click();
    await expect(page.locator("#paper-fill-count")).toHaveText("0 fills");
    await expect(page.locator("#paper-equity")).toHaveText("$100,000.00");
});

test("invalid quantities and excessive illustrative margin are rejected without opening confirmation", async ({ page }) => {
    await openPaper(page);
    for (const quantity of ["0", "1.5", "21"]) {
        await page.locator("#paper-quantity").fill(quantity);
        await page.getByRole("button", { name: "Review paper order", exact: true }).click();
        await expect(page.locator("#paper-ticket-error")).toHaveText(/whole number from 1 to 20/);
        await expect(page.locator("#paper-review-dialog")).toBeHidden();
    }
    await page.locator("#paper-quantity").fill("20");
    await page.getByRole("button", { name: "Review paper order", exact: true }).click();
    await expect(page.locator("#paper-ticket-error")).toHaveText(/Insufficient demo equity/);
    await expect(page.locator("#paper-fill-count")).toHaveText("0 fills");
    await expect(page.locator("#paper-review-dialog")).toBeHidden();
});

test("shorts are visible in the portfolio and closing prepopulates a new reviewed opposite order", async ({ page }) => {
    await openPaper(page);
    await submitPaper(page, { quantity: "2", side: "sell" });
    await page.locator('[data-page="portfolio"]').click();
    await expect(page.locator('#portfolio-position-rows tr[data-symbol="ES"]')).toContainText("Short 2");
    await expect(page.locator("#portfolio-margin")).toHaveText("$13,000.00");
    await page.getByRole("button", { name: "Prepare close ES paper position", exact: true }).click();
    await expect(page.locator("#paper-quantity")).toHaveValue("2");
    await expect(page.locator('[data-paper-side="buy"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#paper-fill-count")).toHaveText("1 fill");
    await page.getByRole("button", { name: "Review paper order", exact: true }).click();
    await expect(page.locator("#paper-review-position")).toHaveText("Flat");
    await page.getByRole("button", { name: "Confirm paper order", exact: true }).click();
    await expect(page.locator("#paper-fill-count")).toHaveText("2 fills");
    await page.locator('[data-page="portfolio"]').click();
    await expect(page.locator("#portfolio-empty")).toBeVisible();
    await expect(page.locator("#portfolio-margin")).toHaveText("$0.00");
    await expect(page.locator("#portfolio-unrealized")).toHaveText("$0.00");
});

test("paused and interrupted feeds block paper orders and preserve held portfolio marks", async ({ page }) => {
    await openPaper(page);
    await submitPaper(page);
    await page.locator('[data-page="markets"]').click();
    await page.getByRole("button", { name: "Pause feed", exact: true }).click();
    await page.locator('[data-page="paper"]').click();
    await expect(page.locator("#paper-review-order")).toBeDisabled();
    await expect(page.locator("#paper-feed-message")).toContainText("paused");
    await page.locator('[data-page="portfolio"]').click();
    const equity = await page.locator("#portfolio-equity").textContent();
    const timestamp = await page.locator("#portfolio-mark-time").textContent();
    await page.clock.runFor(6500);
    await expect(page.locator("#portfolio-equity")).toHaveText(equity);
    await expect(page.locator("#portfolio-mark-time")).toHaveText(timestamp);
    await expect(page.locator("#portfolio-held-notice")).toContainText("held synthetic marks");
    await expect(page.getByRole("button", { name: "Prepare close ES paper position", exact: true })).toBeDisabled();
    await page.locator('[data-page="settings"]').click();
    await page.getByRole("button", { name: "Simulate feed outage", exact: true }).click();
    await page.locator('[data-page="paper"]').click();
    await expect(page.locator("#paper-feed-message")).toContainText("interrupted");
    await expect(page.locator("#paper-review-order")).toBeDisabled();
    await page.locator('[data-page="markets"]').click();
    await page.getByRole("button", { name: "Reconnect demo feed", exact: true }).click();
    await page.locator('[data-page="paper"]').click();
    await expect(page.locator("#paper-review-order")).toBeEnabled();
    await expect(page.locator("#paper-fill-count")).toHaveText("1 fill");
});

test("an expired review cannot confirm until it is deliberately refreshed", async ({ page }) => {
    await openPaper(page);
    await page.getByRole("button", { name: "Review paper order", exact: true }).click();
    await page.clock.runFor(16_000);
    await expect(page.locator("#paper-review-error")).toContainText("expired");
    await expect(page.locator("#paper-confirm-order")).toBeDisabled();
    await expect(page.locator("#paper-fill-rows tr")).toHaveCount(0);
    await page.getByRole("button", { name: "Refresh review", exact: true }).click();
    await expect(page.locator("#paper-confirm-order")).toBeEnabled();
    await page.getByRole("button", { name: "Confirm paper order", exact: true }).click();
    await expect(page.locator("#paper-fill-count")).toHaveText("1 fill");
});

test("duplicate confirmation events create only one fill", async ({ page }) => {
    await openPaper(page);
    await page.getByRole("button", { name: "Review paper order", exact: true }).click();
    await page.locator("#paper-confirm-order").evaluate((button) => {
        button.click();
        button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await expect(page.locator("#paper-fill-count")).toHaveText("1 fill");
    await expect(page.locator("#paper-fill-rows tr")).toHaveCount(1);
});

test("reset requires confirmation, restores fictional funds, and preserves the watchlist", async ({ page }) => {
    await openPaper(page);
    await submitPaper(page);
    await page.locator('[data-page="markets"]').click();
    await page.getByRole("button", { name: "Add ZC to watchlist", exact: true }).click();
    await page.locator('[data-page="portfolio"]').click();
    await page.getByRole("button", { name: "Reset paper account", exact: true }).click();
    await expect(page.getByRole("button", { name: "Keep my session", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Keep my session", exact: true }).click();
    await expect(page.locator("#portfolio-position-count")).toHaveText("1");
    await page.getByRole("button", { name: "Reset paper account", exact: true }).click();
    await page.getByRole("button", { name: "Confirm paper reset", exact: true }).click();
    await expect(page.locator("#portfolio-position-count")).toHaveText("0");
    await expect(page.locator("#portfolio-equity")).toHaveText("$100,000.00");
    await page.locator('[data-page="paper"]').click();
    await expect(page.locator("#paper-fill-count")).toHaveText("0 fills");
    await page.locator('[data-page="markets"]').click();
    await expect(page.locator("#watchlist-count")).toHaveText("5 saved");
});

test("layout reset preserves the ledger while a market restart protects and then clears paper activity", async ({ page }) => {
    await openPaper(page);
    await submitPaper(page);
    await page.getByRole("button", { name: "Reset layout", exact: true }).click();
    await page.locator('[data-page="paper"]').click();
    await expect(page.locator("#paper-fill-count")).toHaveText("1 fill");
    await page.locator('[data-page="settings"]').click();
    await page.getByRole("button", { name: "Restart synthetic session", exact: true }).click();
    await expect(page.locator("#paper-reset-description")).toContainText("clearing every paper position and fill");
    await page.keyboard.press("Escape");
    await page.locator('[data-page="paper"]').click();
    await expect(page.locator("#paper-fill-count")).toHaveText("1 fill");
    await page.locator('[data-page="settings"]').click();
    await page.getByRole("button", { name: "Restart synthetic session", exact: true }).click();
    await page.getByRole("button", { name: "Confirm session restart", exact: true }).click();
    await page.locator('[data-page="paper"]').click();
    await expect(page.locator("#paper-fill-count")).toHaveText("0 fills");
    await expect(page.locator("#paper-equity")).toHaveText("$100,000.00");
    await expect(page.locator("#paper-review-order")).toBeEnabled();
});

test("the paper account stays in memory and still works when browser storage is blocked", async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(window, "localStorage", { get() { throw new Error("Storage disabled for test"); } });
    });
    await openPaper(page);
    await submitPaper(page, { symbol: "6E", quantity: "2" });
    await expect(page.locator("#paper-success")).toContainText("6E");
    await page.reload();
    await page.locator('[data-page="paper"]').click();
    await expect(page.locator("#paper-fill-count")).toHaveText("0 fills");
    await expect(page.locator("#paper-equity")).toHaveText("$100,000.00");
});

test("mobile tickets, review dialogs, and portfolio controls remain reachable without horizontal page overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openPaper(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Review paper order", exact: true }).click();
    const bounds = await page.locator("#paper-review-dialog").boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    expect(bounds.height).toBeLessThanOrEqual(844);
    await page.getByRole("button", { name: "Confirm paper order", exact: true }).click();
    await page.locator('[data-page="portfolio"]').click();
    await expect(page.locator("#portfolio-position-count")).toHaveText("1");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Prepare close ES paper position", exact: true }).click();
    await expect(page.locator("#paper-quantity")).toHaveValue("1");
});

test("portfolio P/L follows synthetic marks and the display exposes fictional calculation assumptions", async ({ page }) => {
    await openPaper(page);
    await submitPaper(page, { quantity: "2" });
    await page.locator('[data-page="portfolio"]').click();
    const oldTime = await page.locator("#portfolio-mark-time").textContent();
    await page.clock.runFor(4600);
    await expect(page.locator("#portfolio-mark-time")).not.toHaveText(oldTime);
    const values = await page.locator('#portfolio-position-rows tr[data-symbol="ES"]').evaluate((row) => {
        const cells = row.querySelectorAll("td");
        const number = (value) => Number(value.replace(/[^\d.-]/g, ""));
        return { entry: number(cells[2].textContent), mark: number(cells[3].textContent), profitCents: Math.round(number(cells[4].textContent) * 100) };
    });
    expect(values.profitCents).toBe(Math.round((values.mark - values.entry) / 0.25) * 500 * 2);
    await page.getByText("Calculation assumptions and simulation limits", { exact: true }).click();
    await expect(page.locator("#paper-assumption-rows tr")).toHaveCount(7);
    await expect(page.locator(".paper-assumptions")).toContainText("No FX conversion");
    await expect(page.locator(".paper-assumptions")).toContainText("not financial risk guidance");
});
