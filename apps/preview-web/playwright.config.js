import { defineConfig } from "@playwright/test";

const pythonExecutable = process.platform === "win32" ? "python" : "python3";

export default defineConfig({
    testDir: "./tests",
    testMatch: "**/*.spec.js",
    testIgnore: "**/visionos.spec.js",
    outputDir: "../../artifacts/preview-tests",
    timeout: 20_000,
    fullyParallel: false,
    workers: 1,
    reporter: "list",
    use: {
        baseURL: "http://127.0.0.1:8765",
        browserName: "chromium",
        channel: "chrome",
        headless: true,
        viewport: { width: 1440, height: 960 },
        screenshot: "only-on-failure"
    },
    webServer: {
        command: `${pythonExecutable} ../../scripts/serve-preview.py --port 8765`,
        url: "http://127.0.0.1:8765",
        reuseExistingServer: !process.env.CI,
        timeout: 15_000
    }
});
