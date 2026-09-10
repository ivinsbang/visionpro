import { constants, existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const origin = "http://127.0.0.1:8765";
const outputDirectory = join(repositoryRoot, "artifacts", "videos");
const playbackDirectory = join(repositoryRoot, "apps", "preview-web", "artifacts", "videos");
const portableDirectory = join(repositoryRoot, ".cache", "video-tools", "imageio_ffmpeg", "binaries");
const portableFiles = await readdir(portableDirectory).catch(() => []);
const candidates = [process.env.FFMPEG_PATH, "ffmpeg", ...portableFiles.filter((name) => name.startsWith("ffmpeg-")).map((name) => join(portableDirectory, name))].filter(Boolean);
const ffmpeg = candidates.find((candidate) => {
    const result = spawnSync(candidate, ["-hide_banner", "-encoders"], { encoding: "utf8", windowsHide: true });
    return result.status === 0 && /\blibx264\b/.test(result.stdout);
});
if (!ffmpeg) throw new Error("FFmpeg with libx264 is required. Set FFMPEG_PATH or install the optional portable encoder described in README.md.");
const response = await fetch(origin).catch(() => null);
if (!response?.ok) throw new Error("Start the local preview with python scripts/serve-preview.py before recording.");
await response.body.cancel();

await mkdir(outputDirectory, { recursive: true });
const timestamp = new Date().toISOString().slice(0, 19).replaceAll(":", "").replaceAll("-", "").replace("T", "-");
const defaultName = "cme-spatial-market-center-demo";
const nameExists = [".mp4", ".png", ".json", "-storyboard.jpg"].some((suffix) => existsSync(join(outputDirectory, defaultName + suffix))) || existsSync(join(playbackDirectory, `${defaultName}.mp4`));
const baseName = nameExists ? `${defaultName}-${timestamp}` : defaultName;
const sourceDirectory = await mkdtemp(join(outputDirectory, "capture-"));
const outputPath = join(outputDirectory, `${baseName}.mp4`);
const browserErrors = [];
const externalRequests = [];
const chapters = [];
const wait = (milliseconds) => new Promise((complete) => setTimeout(complete, milliseconds));

function runEncoder(argumentsList) {
    return new Promise((complete, reject) => {
        const process = spawn(ffmpeg, ["-hide_banner", "-nostdin", "-n", ...argumentsList], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
        let diagnostics = "";
        process.stderr.on("data", (chunk) => { diagnostics += chunk.toString(); });
        process.on("error", reject);
        process.on("close", (code) => code === 0 ? complete(diagnostics) : reject(new Error(`FFmpeg exited ${code}: ${diagnostics.slice(-4000)}`)));
    });
}

function durationFrom(diagnostics) {
    const duration = diagnostics.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!duration) throw new Error("Could not verify the recorded duration.");
    return Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
let context;
let video;
let posterTime;
let recordingStarted;

try {
    context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: { dir: sourceDirectory, size: { width: 1920, height: 1080 } },
        deviceScaleFactor: 1,
        colorScheme: "dark"
    });
    await context.route("**/*", (route) => {
        if (new URL(route.request().url()).origin === origin) return route.continue();
        externalRequests.push(route.request().url());
        return route.abort();
    });
    recordingStarted = performance.now();
    const page = await context.newPage();
    video = page.video();
    page.setDefaultTimeout(10_000);
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
    });
    await page.goto(origin);
    await expect(page.locator("#feed-state")).toHaveText("Demo feed · Streaming");
    await page.addStyleTag({ url: `${origin}/scripts/recording.css` });
    await page.evaluate(() => {
        document.body.dataset.demoRecording = "true";
        const caption = document.createElement("aside");
        caption.id = "recording-caption";
        caption.innerHTML = '<div id="recording-chapter"></div><div><h2 id="recording-title"></h2><p id="recording-description"></p></div><div class="recording-label">LOCAL PROTOTYPE<br><span>100% synthetic data</span></div>';
        const pointer = document.createElement("div");
        pointer.id = "recording-pointer";
        pointer.innerHTML = '<svg viewBox="0 0 30 36" aria-hidden="true"><path d="M3 2v26l7-7 6 12 5-2-6-12h10Z" fill="#eefbff" stroke="#0a2936" stroke-width="1.6"/></svg>';
        document.body.append(caption, pointer);
        document.addEventListener("pointermove", (event) => {
            pointer.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
        });
        document.addEventListener("pointerdown", () => pointer.classList.add("pressed"));
        document.addEventListener("pointerup", () => pointer.classList.remove("pressed"));
    });

    let pointerPosition = { left: 1820, top: 110 };
    await page.mouse.move(pointerPosition.left, pointerPosition.top);
    const button = (name) => page.getByRole("button", { name, exact: true });

    async function movePointer(left, top, milliseconds = 380) {
        const startingPosition = { ...pointerPosition };
        const steps = Math.max(1, Math.ceil(milliseconds / 30));
        for (let step = 1; step <= steps; step += 1) {
            const progress = 1 - (1 - step / steps) ** 3;
            await page.mouse.move(startingPosition.left + (left - startingPosition.left) * progress, startingPosition.top + (top - startingPosition.top) * progress);
            await wait(milliseconds / steps);
        }
        pointerPosition = { left, top };
    }

    async function pointTo(locator) {
        await locator.scrollIntoViewIfNeeded();
        const bounds = await locator.boundingBox();
        if (!bounds) throw new Error("A walkthrough control is not visible.");
        await movePointer(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    }

    async function click(locator, pause = 550) {
        await pointTo(locator);
        await page.mouse.down();
        await wait(100);
        await page.mouse.up();
        await wait(pause);
    }

    async function select(locator, value) {
        await pointTo(locator);
        await locator.selectOption(value);
        await wait(900);
    }

    async function chapter(label, title, description) {
        await page.evaluate(({ label, title, description }) => {
            document.getElementById("recording-chapter").textContent = label;
            document.getElementById("recording-title").textContent = title;
            document.getElementById("recording-description").textContent = description;
        }, { label, title, description });
        chapters.push({ timeSeconds: (performance.now() - recordingStarted) / 1000, label, title, description });
        console.log(`Recording: ${title}`);
        await wait(220);
    }

    async function scrollDesk(top) {
        await page.locator(".content-scroll").evaluate((element, offset) => element.scrollTo({ top: offset, behavior: "smooth" }), top);
        await wait(850);
    }

    async function dragWindow(name, left, top) {
        const handle = button(name);
        const windowBounds = await handle.locator("xpath=ancestor::section").boundingBox();
        const handleBounds = await handle.boundingBox();
        await movePointer(handleBounds.x + 80, handleBounds.y + 15);
        await page.mouse.down();
        await movePointer(left + handleBounds.x - windowBounds.x + 80, top + handleBounds.y - windowBounds.y + 15, 1100);
        await page.mouse.up();
        await wait(350);
    }

    await chapter("01 / INTRODUCTION", "CME-style Spatial Market Center", "A Vision Pro-inspired experience on Windows. Every price is synthetic.");
    await wait(4400);

    await chapter("02 / YOUR MARKETS", "A wider view of the market.", "Seven demo markets. Streaming local quotes. Zero exchange connections.");
    await click(button("Show NQ demo contract"));
    await wait(1600);
    await click(button("Show CL demo contract"));
    await wait(1600);

    await chapter("03 / WATCHLISTS", "Find a market. Make it yours.", "Search contracts, filter asset classes, and save a watchlist in this browser.");
    const search = page.getByRole("searchbox", { name: "Search demo contracts" });
    await click(search, 200);
    await search.pressSequentially("euro", { delay: 110 });
    await wait(850);
    await click(button("Add 6E to watchlist"));
    await search.fill("");
    await click(button("Watchlist"));
    await wait(1300);
    await select(page.locator("#asset-filter"), "Energy");
    await wait(1300);
    await select(page.locator("#asset-filter"), "all");
    await click(button("Show ES demo contract"));

    await chapter("04 / ANALYSIS", "See more than a price.", "Switch chart types and time ranges. Inspect generated candles with the pointer.");
    await click(button("15 minutes"));
    await wait(1200);
    await click(button("4 hours"));
    await wait(1200);
    await click(button("Area"));
    const chartBounds = await page.locator("#market-chart").boundingBox();
    await movePointer(chartBounds.x + chartBounds.width * 0.28, chartBounds.y + 80, 500);
    await movePointer(chartBounds.x + chartBounds.width * 0.69, chartBounds.y + 105, 1700);
    await wait(1200);
    await click(button("1 hour"));

    await chapter("05 / MARKET ACTIVITY", "Price, depth, and activity stay in sync.", "Illustrative order-book levels and simulated trade prints. Nothing is executable.");
    await click(button("Show CL demo contract"));
    await scrollDesk(10000);
    await wait(3600);

    await chapter("06 / SPATIAL WORKSPACE", "Give every market its own screen.", "Independent charts and a rotatable 3D desk, arranged with mouse controls.");
    await scrollDesk(0);
    await click(button("Show ES demo contract"));
    await click(button("Open chart window"));
    await select(page.locator("#detached-symbol"), "GC");
    await dragWindow("Move chart window", 1280, 250);
    await wait(1400);
    await click(button("Open spatial screens"));
    await dragWindow("Move spatial preview", 60, 230);
    const slider = await page.locator("#viewing-angle").boundingBox();
    const sliderPosition = (angle) => slider.x + 8 + (angle + 60) / 90 * (slider.width - 16);
    await movePointer(sliderPosition(-24), slider.y + slider.height / 2);
    await page.mouse.down();
    await movePointer(sliderPosition(15), slider.y + slider.height / 2, 1100);
    await movePointer(sliderPosition(-8), slider.y + slider.height / 2, 850);
    await page.mouse.up();
    await movePointer(1830, 850, 400);
    posterTime = (performance.now() - recordingStarted) / 1000;
    await wait(3700);

    await chapter("07 / SAFE SIMULATION", "Rehearse an interruption. Stay local.", "Pause, interrupt, and reconnect the demo feed. Held snapshots are clearly labeled.");
    await click(button("Close spatial preview"));
    await click(button("Close chart window"));
    await click(button("Pause feed"));
    await wait(1400);
    await click(button("Resume feed"));
    await click(button("Settings"));
    await click(button("Simulate feed outage"));
    await wait(1000);
    await click(button("Market desk"));
    await expect(page.locator("#feed-interrupted")).toBeVisible();
    await wait(2400);
    await click(button("Reconnect demo feed"));
    await expect(page.locator("#feed-state")).toHaveText("Demo feed · Streaming");
    await wait(1200);

    await chapter("08 / READY FOR REVIEW", "Real interactions. Entirely synthetic markets.", "No CME connections. No real orders. This is a Windows browser prototype.");
    await movePointer(1830, 850, 400);
    await wait(4900);
    if (browserErrors.length || externalRequests.length) throw new Error(JSON.stringify({ browserErrors, externalRequests }));
} finally {
    if (context) await context.close();
    await browser.close();
}

const sourcePath = await video.path();
const sourceInfo = await runEncoder(["-i", sourcePath, "-t", "0.04", "-f", "null", "-"]);
const trimStart = Math.max(0, chapters[0].timeSeconds - 0.15);
const expectedDuration = durationFrom(sourceInfo) - trimStart;
console.log("Encoding the 1080p MP4…");
await runEncoder([
    "-loglevel", "error", "-ss", trimStart.toFixed(3), "-i", sourcePath,
    "-an", "-vf", `fps=30,format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st=${Math.max(0, expectedDuration - 0.7).toFixed(3)}:d=0.7`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-threads", "2", "-movflags", "+faststart", outputPath
]);
const validation = await runEncoder(["-i", outputPath, "-f", "null", "-"]);
const durationSeconds = durationFrom(validation);
if (!validation.includes("1920x1080") || !validation.includes("Video: h264") || durationSeconds < 45 || durationSeconds > 180) {
    throw new Error("The exported movie did not pass format/duration validation.");
}
const posterPath = join(outputDirectory, `${baseName}.png`);
const storyboardPath = join(outputDirectory, `${baseName}-storyboard.jpg`);
await runEncoder(["-loglevel", "error", "-ss", Math.max(0, posterTime - trimStart + 1).toFixed(3), "-i", outputPath, "-frames:v", "1", posterPath]);
await runEncoder(["-loglevel", "error", "-ss", "2", "-i", outputPath, "-vf", `fps=1/${((durationSeconds - 4) / 6).toFixed(3)},scale=640:360,tile=3x2`, "-frames:v", "1", "-q:v", "2", storyboardPath]);
await mkdir(playbackDirectory, { recursive: true });
await copyFile(outputPath, join(playbackDirectory, `${baseName}.mp4`), constants.COPYFILE_EXCL);
const metadata = {
    video: relative(repositoryRoot, outputPath),
    playbackUrl: `${origin}/artifacts/videos/${baseName}.mp4`,
    source: relative(repositoryRoot, sourcePath),
    poster: relative(repositoryRoot, posterPath),
    durationSeconds,
    resolution: "1920x1080",
    frameRate: 30,
    codec: "H.264 / yuv420p",
    audio: "None; captions are burned into the video",
    bytes: (await stat(outputPath)).size,
    capturedAt: new Date().toISOString(),
    syntheticDataOnly: true,
    browserErrors,
    externalRequests,
    chapters: chapters.map((chapter) => ({ ...chapter, timeSeconds: Math.max(0, chapter.timeSeconds - trimStart) }))
};
await writeFile(join(outputDirectory, `${baseName}.json`), `${JSON.stringify(metadata, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ video: outputPath, playbackUrl: metadata.playbackUrl, durationSeconds, resolution: metadata.resolution, megabytes: (metadata.bytes / 1_000_000).toFixed(1), browserErrors, externalRequests }, null, 2));
