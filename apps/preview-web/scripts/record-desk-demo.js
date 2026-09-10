import { constants, existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { createSubtitles, readWaveDetails } from "./spatial-film/timeline.js";
import { createDeskCaptions, createDeskTimeline, deskFilmSettings, deskStoryboard } from "./desk-demo/storyboard.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const scriptsRoot = join(repositoryRoot, "apps", "preview-web", "scripts");
const outputDirectory = join(repositoryRoot, "artifacts", "videos");
const playbackDirectory = join(repositoryRoot, "apps", "preview-web", "artifacts", "videos");
const origin = "http://127.0.0.1:8765";
const previewOnly = process.argv.includes("--preview");
if (process.argv.slice(2).some((argument) => argument !== "--preview")) throw new Error("Supported option: --preview (rehearse all features and capture stills without recording a movie).");
if (process.platform !== "win32") throw new Error("The narrated desk recorder uses the installed Windows male speech voice.");
const wait = (milliseconds) => new Promise((complete) => setTimeout(complete, Math.max(0, milliseconds)));

function run(executable, argumentsList, cwd) {
    return new Promise((complete, reject) => {
        const child = spawn(executable, argumentsList, { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        let diagnostics = "";
        for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { diagnostics = (diagnostics + chunk.toString()).slice(-30_000); });
        child.on("error", reject);
        child.on("close", (code) => code === 0 ? complete(diagnostics) : reject(new Error(`${basename(executable)} exited ${code}: ${diagnostics}`)));
    });
}

function readDuration(diagnostics) {
    const match = diagnostics.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!match) throw new Error("No readable media duration in encoder diagnostics.");
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

const portableDirectory = join(repositoryRoot, ".cache", "video-tools", "imageio_ffmpeg", "binaries");
const portableFiles = await readdir(portableDirectory).catch(() => []);
const candidates = [process.env.FFMPEG_PATH, "ffmpeg", ...portableFiles.filter((name) => name.startsWith("ffmpeg-")).map((name) => join(portableDirectory, name))].filter(Boolean);
const ffmpeg = candidates.find((candidate) => {
    const encoders = spawnSync(candidate, ["-hide_banner", "-encoders"], { encoding: "utf8", windowsHide: true });
    const filters = spawnSync(candidate, ["-hide_banner", "-filters"], { encoding: "utf8", windowsHide: true });
    return encoders.status === 0 && /\blibx264\b/.test(encoders.stdout) && /\baac\b/.test(encoders.stdout) && filters.status === 0 && /\bsubtitles\b/.test(filters.stdout);
});
if (!ffmpeg) throw new Error("FFmpeg with libx264, AAC, and the subtitles filter is required. Use the documented portable encoder or FFMPEG_PATH.");
const response = await fetch(origin).catch(() => null);
if (!response?.ok) throw new Error("Start python scripts/serve-preview.py before recording.");
await response.body.cancel();
await mkdir(outputDirectory, { recursive: true });
await mkdir(playbackDirectory, { recursive: true });
const jobDirectory = await mkdtemp(join(outputDirectory, "desk-recording-"));
const manifestPath = join(jobDirectory, "narration-manifest.json");
const narrationCues = deskStoryboard.flatMap((section) => section.cues);
await writeFile(manifestPath, `${JSON.stringify({ voice: deskFilmSettings.voice, cues: narrationCues }, null, 2)}\n`, { flag: "wx" });
console.log("Generating male narration locally with Microsoft David Desktop...");
console.log(await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", join(scriptsRoot, "spatial-film", "narrate.ps1"), "-Manifest", manifestPath, "-OutputDirectory", jobDirectory]));
const waves = await Promise.all(narrationCues.map(async (unused, index) => readWaveDetails(await readFile(join(jobDirectory, `cue-${String(index).padStart(2, "0")}.wav`)))));
for (const wave of waves) {
    let peak = 0;
    for (let offset = 0; offset < wave.data.length; offset += 2) peak = Math.max(peak, Math.abs(wave.data.readInt16LE(offset)));
    if (peak < 300) throw new Error("A narration cue is unexpectedly quiet.");
}
const timeline = createDeskTimeline(waves.map((wave) => wave.duration));
const duration = Math.ceil(timeline.duration * deskFilmSettings.frameRate) / deskFilmSettings.frameRate;
const audio = Buffer.alloc(Math.round(duration * 24_000) * 2);
timeline.cues.forEach((cue, index) => waves[index].data.copy(audio, Math.round(cue.start * 24_000) * 2));
const waveHeader = Buffer.alloc(44);
waveHeader.write("RIFF", 0);
waveHeader.writeUInt32LE(audio.length + 36, 4);
waveHeader.write("WAVEfmt ", 8);
waveHeader.writeUInt32LE(16, 16);
waveHeader.writeUInt16LE(1, 20);
waveHeader.writeUInt16LE(1, 22);
waveHeader.writeUInt32LE(24_000, 24);
waveHeader.writeUInt32LE(48_000, 28);
waveHeader.writeUInt16LE(2, 32);
waveHeader.writeUInt16LE(16, 34);
waveHeader.write("data", 36);
waveHeader.writeUInt32LE(audio.length, 40);
const narrationPath = join(jobDirectory, "narration.wav");
await writeFile(narrationPath, Buffer.concat([waveHeader, audio]), { flag: "wx" });
await writeFile(join(jobDirectory, "subtitles.srt"), createSubtitles(timeline), { flag: "wx" });
await writeFile(join(jobDirectory, "subtitles.vtt"), createSubtitles(timeline, "vtt"), { flag: "wx" });
await writeFile(join(jobDirectory, "subtitles.ass"), createDeskCaptions(timeline), { flag: "wx" });
await writeFile(join(jobDirectory, "timeline.json"), `${JSON.stringify(timeline, null, 2)}\n`, { flag: "wx" });

const timestamp = new Date().toISOString().slice(0, 19).replaceAll(":", "").replaceAll("-", "").replace("T", "-");
const defaultName = "cme-spatial-market-center-all-features-3d";
const nameExists = [".mp4", ".png", ".json", ".srt", ".vtt", "-storyboard.jpg"].some((suffix) => existsSync(join(outputDirectory, defaultName + suffix)) || existsSync(join(playbackDirectory, defaultName + suffix)));
const baseName = nameExists ? `${defaultName}-${timestamp}` : defaultName;
const outputPath = join(outputDirectory, `${baseName}.mp4`);
const browserErrors = [];
const externalRequests = [];
const actionTimes = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
let context;
let video;
let trimStart = 0;
let recordingStarted;
let timelineStarted;

try {
    context = await browser.newContext({
        viewport: { width: deskFilmSettings.width, height: deskFilmSettings.height },
        ...(previewOnly ? {} : { recordVideo: { dir: jobDirectory, size: { width: deskFilmSettings.width, height: deskFilmSettings.height } } }),
        deviceScaleFactor: 1, colorScheme: "dark"
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
    page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
    await page.goto(`${origin}/?demo=3d`);
    await expect(page.locator("#spatial-desk")).toBeVisible();
    await expect(page.locator("#feed-state")).toContainText("Streaming");
    await page.addStyleTag({ url: `${origin}/scripts/desk-demo/recording.css` });
    await page.evaluate(() => {
        document.body.dataset.deskRecording = "true";
        const caption = document.createElement("aside");
        caption.id = "desk-film-caption";
        caption.innerHTML = '<header><span id="desk-film-chapter"></span><span>SCRIPTED LOCAL DEMO · PAPER ONLY · NOT VISION PRO FOOTAGE</span></header><h2 id="desk-film-title"></h2>';
        const pointer = document.createElement("div");
        pointer.id = "desk-film-pointer";
        pointer.innerHTML = '<svg viewBox="0 0 30 36" aria-hidden="true"><path d="M3 2v26l7-7 6 12 5-2-6-12h10Z" fill="#eefbff" stroke="#0a2936" stroke-width="1.6"/></svg>';
        document.body.append(caption, pointer);
        document.addEventListener("pointermove", (event) => { pointer.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`; });
        document.addEventListener("pointerdown", () => pointer.classList.add("pressed"));
        document.addEventListener("pointerup", () => pointer.classList.remove("pressed"));
        window.dispatchEvent(new Event("resize"));
    });
    await wait(600);
    await page.mouse.move(1780, 95);
    timelineStarted = performance.now();
    trimStart = Math.max(0, (timelineStarted - recordingStarted) / 1000);

    async function click(locator) {
        await locator.scrollIntoViewIfNeeded();
        const bounds = await locator.boundingBox();
        if (!bounds) throw new Error("A recording control is not visible.");
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { steps: 12 });
        await locator.click({ delay: 90 });
    }

    async function select(locator, value) {
        await locator.scrollIntoViewIfNeeded();
        const bounds = await locator.boundingBox();
        if (bounds) await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { steps: 10 });
        await locator.selectOption(value);
    }

    async function paperOrder(symbol, quantity, side) {
        await select(page.locator("#paper-contract"), symbol);
        await page.locator("#paper-quantity").fill(String(quantity));
        await click(page.locator(`[data-paper-side="${side}"]`));
        await click(page.locator("#paper-review-order"));
        await expect(page.locator("#paper-review-dialog")).toBeVisible();
        await click(page.locator("#paper-confirm-order"));
        await expect(page.locator("#paper-review-dialog")).toBeHidden();
    }

    for (const section of timeline.sections) {
        if (!previewOnly) await wait(timelineStarted + section.start * 1000 - performance.now());
        await page.evaluate(({ index, title, count }) => {
            document.querySelector("#desk-film-chapter").textContent = `${String(index + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")} · WORKING 3D DEMO`;
            document.querySelector("#desk-film-title").textContent = title;
        }, { index: section.index, title: section.title, count: timeline.sections.length });
        console.log(`${previewOnly ? "Rehearsing" : "Recording"}: ${section.title}`);
        async function at(progress, action) {
            const planned = section.start + (section.end - section.start) * progress;
            if (!previewOnly) await wait(timelineStarted + planned * 1000 - performance.now());
            const actual = (performance.now() - timelineStarted) / 1000;
            if (!previewOnly && actual - planned > 2.5) throw new Error(`Walkthrough timing slipped by ${(actual - planned).toFixed(2)} seconds in ${section.id}. Keep other heavy jobs idle and retry.`);
            await action();
            actionTimes.push({ section: section.id, planned, actual });
        }

        if (section.id === "arrival") {
            await at(0.2, () => click(page.locator("#spatial-room-view")));
        } else if (section.id === "markets") {
            await at(0.03, () => click(page.locator("#spatial-focus-desk")));
            await at(0.14, () => page.locator("#market-search").fill("euro"));
            await at(0.26, () => click(page.getByRole("button", { name: "Add 6E to watchlist", exact: true })));
            await at(0.36, () => page.locator("#market-search").fill(""));
            await at(0.48, () => click(page.getByRole("button", { name: "Watchlist", exact: true })));
            await at(0.61, () => select(page.locator("#asset-filter"), "Energy"));
            await at(0.74, () => select(page.locator("#asset-filter"), "all"));
            await at(0.84, () => click(page.getByRole("button", { name: "Show CL demo contract", exact: true })));
        } else if (section.id === "analysis") {
            await at(0.08, () => click(page.getByRole("button", { name: "15 minutes", exact: true })));
            await at(0.25, () => click(page.getByRole("button", { name: "4 hours", exact: true })));
            await at(0.39, () => click(page.getByRole("button", { name: "Area", exact: true })));
            await at(0.55, async () => {
                const bounds = await page.locator("#market-chart").boundingBox();
                await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.4, { steps: 20 });
                await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.4, { steps: 35 });
            });
            await at(0.69, () => click(page.getByRole("button", { name: "1 hour", exact: true })));
            await at(0.79, () => page.locator(".content-scroll").evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "smooth" })));
        } else if (section.id === "windows") {
            await at(0.04, () => select(page.locator("#spatial-focus"), "chart"));
            await at(0.2, () => select(page.locator("#detached-symbol"), "GC"));
            await at(0.37, async () => {
                const handle = page.getByRole("button", { name: "Move chart window", exact: true });
                const bounds = await handle.boundingBox();
                await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
                await page.mouse.down();
                await page.mouse.move(bounds.x + bounds.width / 2 + 70, bounds.y + bounds.height / 2 + 26, { steps: 35 });
                await page.mouse.up();
            });
            await at(0.56, () => select(page.locator("#spatial-focus"), "companion"));
            await at(0.76, () => click(page.locator("#spatial-room-view")));
        } else if (section.id === "paper") {
            await at(0.02, () => select(page.locator("#spatial-feature"), "paper"));
            await at(0.12, async () => {
                await select(page.locator("#paper-contract"), "ES");
                await page.locator("#paper-quantity").fill("8");
            });
            await at(0.23, () => click(page.locator("#paper-review-order")));
            await expect(page.locator("#paper-fill-count")).toHaveText("0 fills");
            await page.screenshot({ path: join(jobDirectory, "paper-review.png") });
            await at(0.38, () => click(page.locator("#paper-confirm-order")));
            await at(0.53, () => paperOrder("NQ", 2, "sell"));
            await at(0.67, () => paperOrder("CL", 2, "buy"));
            await at(0.81, () => paperOrder("GC", 1, "buy"));
            await expect(page.locator("#paper-fill-count")).toHaveText("4 fills");
            await at(0.93, () => page.locator(".content-scroll").evaluate((element) => element.scrollTo({ top: 0, behavior: "smooth" })));
        } else if (section.id === "risk") {
            await at(0.02, () => select(page.locator("#spatial-feature"), "portfolio"));
            await expect(page.locator("#portfolio-margin")).toHaveText("$79,500.00");
            await at(0.25, () => page.screenshot({ path: join(jobDirectory, "portfolio-overview.png") }));
            await at(0.38, () => page.locator("#portfolio-position-rows").scrollIntoViewIfNeeded());
            await at(0.52, () => click(page.locator('#portfolio-position-rows tr[data-symbol="NQ"] button')));
            await at(0.61, () => click(page.locator("#paper-review-order")));
            await at(0.7, () => click(page.locator("#paper-review-back")));
            await at(0.78, () => select(page.locator("#spatial-feature"), "portfolio"));
            await at(0.86, () => click(page.locator("#page-portfolio summary")));
            await expect(page.locator("#paper-fill-count")).toHaveText("4 fills");
        } else if (section.id === "workspace") {
            await at(0.02, () => select(page.locator("#spatial-feature"), "overview"));
            await at(0.27, () => select(page.locator("#spatial-feature"), "workspace"));
            await at(0.45, () => select(page.locator("#spatial-focus"), "spatial"));
            await at(0.61, async () => {
                const slider = await page.locator("#viewing-angle").boundingBox();
                const thumb = slider.x + (36 / 90) * slider.width;
                await page.mouse.move(thumb, slider.y + slider.height / 2);
                await page.mouse.down();
                await page.mouse.move(slider.x + slider.width * 0.85, slider.y + slider.height / 2, { steps: 40 });
                await page.mouse.up();
            });
            await at(0.85, () => click(page.getByRole("button", { name: "Close spatial preview", exact: true })));
        } else if (section.id === "safety") {
            await at(0.01, () => select(page.locator("#spatial-feature"), "settings"));
            await at(0.12, () => click(page.locator("#simulate-outage")));
            await at(0.24, () => select(page.locator("#spatial-feature"), "paper"));
            await expect(page.locator("#paper-review-order")).toBeDisabled();
            await at(0.36, () => select(page.locator("#spatial-feature"), "portfolio"));
            await at(0.48, async () => {
                await select(page.locator("#spatial-feature"), "markets");
                await click(page.locator("#reconnect-feed"));
            });
            await at(0.58, () => click(page.locator("#toggle-feed")));
            await at(0.68, () => click(page.locator("#toggle-feed")));
            await at(0.78, async () => {
                await select(page.locator("#spatial-feature"), "settings");
                await click(page.locator("#restart-simulation"));
            });
            await at(0.9, () => click(page.locator("#paper-reset-cancel")));
            await expect(page.locator("#paper-fill-count")).toHaveText("4 fills");
        } else if (section.id === "closing") {
            await at(0.03, () => select(page.locator("#spatial-feature"), "portfolio"));
            await at(0.18, () => click(page.locator("#spatial-room-view")));
            await at(0.48, () => page.mouse.move(1810, 840, { steps: 25 }));
        }
        if (!previewOnly) await wait(timelineStarted + section.end * 1000 - performance.now());
        await page.screenshot({ path: join(jobDirectory, `chapter-${String(section.index).padStart(2, "0")}.png`), animations: "disabled" });
        if (browserErrors.length || externalRequests.length) throw new Error(JSON.stringify({ browserErrors, externalRequests }));
    }
    if (!previewOnly) await wait(timelineStarted + duration * 1000 + 350 - performance.now());
} finally {
    if (context) await context.close();
    await browser.close();
}

await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-nostdin", "-n", "-framerate", "1", "-i", join(jobDirectory, "chapter-%02d.png"), "-vf", "scale=640:360,tile=3x3:color=0x101b27", "-frames:v", "1", "-q:v", "2", join(jobDirectory, "review-storyboard.jpg")]);
if (previewOnly) {
    console.log(JSON.stringify({ previewOnly, jobDirectory, plannedDuration: duration, browserErrors, externalRequests, fills: 4 }, null, 2));
} else {
    const sourcePath = await video.path();
    const sourceInfo = await run(ffmpeg, ["-hide_banner", "-nostdin", "-i", sourcePath, "-t", "0.04", "-f", "null", "-"]);
    if (readDuration(sourceInfo) - trimStart < duration - 0.3) throw new Error("The browser recording ended before its narration timeline.");
    console.log("Encoding the actual 3D browser recording with male narration and burned-in English subtitles...");
    const subtitleFilter = "subtitles=filename=subtitles.ass";
    await run(ffmpeg, [
        "-hide_banner", "-loglevel", "error", "-nostdin", "-n", "-ss", trimStart.toFixed(4), "-i", sourcePath, "-i", narrationPath,
        "-map", "0:v:0", "-map", "1:a:0", "-vf", `fps=30,format=yuv420p,${subtitleFilter},fade=t=in:st=0:d=0.35,fade=t=out:st=${(duration - 0.65).toFixed(4)}:d=0.65`,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-threads", "2", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-af", "loudnorm=I=-17:TP=-1.5:LRA=7",
        "-t", duration.toFixed(4), "-movflags", "+faststart", "-metadata", "title=Spatial Market Center - All built features in the Windows 3D desk",
        "-metadata", "comment=Actual Windows browser demo. Synthetic paper account only. Not Vision Pro or visionOS Simulator footage.", outputPath
    ], jobDirectory);
    console.log("Decoding the full export and checking audio, duration, and format...");
    const validation = await run(ffmpeg, ["-hide_banner", "-nostdin", "-i", outputPath, "-af", "volumedetect", "-f", "null", "-"]);
    const durationSeconds = readDuration(validation);
    const peakMatch = validation.match(/max_volume:\s*(-?[\d.]+) dB/);
    const meanMatch = validation.match(/mean_volume:\s*(-?[\d.]+) dB/);
    if (!validation.includes("1920x1080") || !validation.includes("Video: h264") || !validation.includes("Audio: aac") || !validation.includes("30 fps") || Math.abs(durationSeconds - duration) > 0.2 || !peakMatch || Number(peakMatch[1]) < -15 || Number(meanMatch?.[1] ?? -100) < -40) throw new Error(`Export validation failed: ${validation.slice(-5000)}`);
    const posterPath = join(outputDirectory, `${baseName}.png`);
    const storyboardPath = join(outputDirectory, `${baseName}-storyboard.jpg`);
    const riskSection = timeline.sections.find((section) => section.id === "risk");
    await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-nostdin", "-n", "-ss", (riskSection.start + 3).toFixed(3), "-i", outputPath, "-frames:v", "1", posterPath]);
    await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-nostdin", "-n", "-ss", "4", "-i", outputPath, "-vf", `fps=1/${((durationSeconds - 8) / 9).toFixed(5)},scale=640:360,tile=3x3:color=0x101b27`, "-frames:v", "1", "-q:v", "2", storyboardPath]);
    await copyFile(join(jobDirectory, "subtitles.srt"), join(outputDirectory, `${baseName}.srt`), constants.COPYFILE_EXCL);
    await copyFile(join(jobDirectory, "subtitles.vtt"), join(outputDirectory, `${baseName}.vtt`), constants.COPYFILE_EXCL);
    for (const suffix of [".mp4", ".png", ".srt", ".vtt"]) await copyFile(join(outputDirectory, baseName + suffix), join(playbackDirectory, baseName + suffix), constants.COPYFILE_EXCL);
    const metadata = {
        video: relative(repositoryRoot, outputPath), playbackUrl: `${origin}/artifacts/videos/${baseName}.mp4`, interactiveUrl: `${origin}/?demo=3d`,
        source: relative(repositoryRoot, sourcePath), poster: relative(repositoryRoot, posterPath), storyboard: relative(repositoryRoot, storyboardPath),
        subtitles: ["srt", "vtt"].map((extension) => relative(repositoryRoot, join(outputDirectory, `${baseName}.${extension}`))),
        durationSeconds, resolution: "1920x1080", frameRate: 30, codec: "H.264 / yuv420p",
        audio: { codec: "AAC", sampleRate: 48_000, voice: deskFilmSettings.voice, gender: "male", language: "en-US", generatedOffline: true, peakDb: Number(peakMatch[1]), meanDb: Number(meanMatch[1]) },
        burnedInSubtitles: true, syntheticDataOnly: true, actualBrowserRecording: true, actualVisionProFootage: false, actualVisionOSSimulatorFootage: false, stereoVideo: false,
        description: "Actual interactive Windows CSS 3D desk with existing markets, watchlists, charts, depth, paper orders, portfolio/risk, spatial model, and feed controls. Scripted isolated paper session, not the owner's browser profile.",
        paperScenario: [{ symbol: "ES", side: "buy", quantity: 8 }, { symbol: "NQ", side: "sell", quantity: 2 }, { symbol: "CL", side: "buy", quantity: 2 }, { symbol: "GC", side: "buy", quantity: 1 }],
        bytes: (await stat(outputPath)).size, createdAt: new Date().toISOString(), browserErrors, externalRequests, fullDecodeValidated: true, trimStart, actionTimes,
        jobDirectory: relative(repositoryRoot, jobDirectory), sections: timeline.sections, cues: timeline.cues
    };
    await writeFile(join(outputDirectory, `${baseName}.json`), `${JSON.stringify(metadata, null, 2)}\n`, { flag: "wx" });
    console.log(JSON.stringify({ video: outputPath, playbackUrl: metadata.playbackUrl, durationSeconds, resolution: metadata.resolution, voice: metadata.audio.voice, subtitles: metadata.subtitles, megabytes: (metadata.bytes / 1_000_000).toFixed(1), browserErrors, externalRequests }, null, 2));
}
