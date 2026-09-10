import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests",
    testMatch: "**/visionos.spec.js",
    outputDir: "../../artifacts/bundled-dashboard-tests",
    timeout: 30_000,
    fullyParallel: false,
    workers: 1,
    reporter: "list",
    use: {
        headless: true,
        viewport: { width: 1440, height: 840 },
        screenshot: "only-on-failure"
    },
    projects: [
        { name: "bundled-chrome", use: { browserName: "chromium", channel: "chrome" } },
        { name: "bundled-webkit", use: { browserName: "webkit" } }
    ]
});
