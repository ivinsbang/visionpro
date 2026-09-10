import { constants, existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import { filmSettings, storyboard } from "./spatial-film/storyboard.js";
import { createSubtitles, createTimeline, readWaveDetails } from "./spatial-film/timeline.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const previewRoot = join(repositoryRoot, "apps", "preview-web");
const sourceRoot = join(previewRoot, "scripts", "spatial-film");
const outputDirectory = join(repositoryRoot, "artifacts", "videos");
const playbackDirectory = join(previewRoot, "artifacts", "videos");
const origin = "http://127.0.0.1:8765";
const previewOnly = process.argv.includes("--preview");
if (process.argv.slice(2).some((argument) => argument !== "--preview")) throw new Error("Supported option: --preview (prepare narration and review frames without rendering the full movie).");
if (process.platform !== "win32") throw new Error("This optional recorder uses the installed Windows male speech voice.");

function run(executable, argumentsList) {
    return new Promise((complete, reject) => {
        const child = spawn(executable, argumentsList, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        let diagnostics = "";
        for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => { diagnostics = (diagnostics + chunk.toString()).slice(-30_000); });
        child.on("error", reject);
        child.on("close", (code) => code === 0 ? complete(diagnostics) : reject(new Error(`${basename(executable)} exited ${code}: ${diagnostics}`)));
    });
}

const portableDirectory = join(repositoryRoot, ".cache", "video-tools", "imageio_ffmpeg", "binaries");
const portableFiles = await readdir(portableDirectory).catch(() => []);
const candidates = [process.env.FFMPEG_PATH, "ffmpeg", ...portableFiles.filter((name) => name.startsWith("ffmpeg-")).map((name) => join(portableDirectory, name))].filter(Boolean);
const ffmpeg = candidates.find((candidate) => {
    const result = spawnSync(candidate, ["-hide_banner", "-encoders"], { encoding: "utf8", windowsHide: true });
    return result.status === 0 && /\blibx264\b/.test(result.stdout) && /\baac\b/.test(result.stdout);
});
if (!ffmpeg) throw new Error("An FFmpeg encoder with libx264 and AAC is required. Set FFMPEG_PATH or use the documented optional portable encoder.");
const response = await fetch(origin).catch(() => null);
if (!response?.ok) throw new Error("Start python scripts/serve-preview.py before recording.");
await response.body.cancel();

await mkdir(outputDirectory, { recursive: true });
await mkdir(playbackDirectory, { recursive: true });
const jobDirectory = await mkdtemp(join(outputDirectory, "spatial-render-"));
const webDirectory = join(playbackDirectory, basename(jobDirectory));
await mkdir(webDirectory);
const narrationManifest = join(jobDirectory, "narration-manifest.json");
await writeFile(narrationManifest, `${JSON.stringify({ voice: filmSettings.voice, cues: storyboard.flatMap((section) => section.cues) }, null, 2)}\n`, { flag: "wx" });
console.log("Generating the offline male narration...");
console.log(await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", join(sourceRoot, "narrate.ps1"), "-Manifest", narrationManifest, "-OutputDirectory", jobDirectory]));
const waves = await Promise.all(storyboard.flatMap((section) => section.cues).map(async (unused, index) => readWaveDetails(await readFile(join(jobDirectory, `cue-${String(index).padStart(2, "0")}.wav`)))));
for (const wave of waves) {
    let peak = 0;
    for (let offset = 0; offset < wave.data.length; offset += 2) peak = Math.max(peak, Math.abs(wave.data.readInt16LE(offset)));
    if (peak < 300) throw new Error("A narration cue is silent or unexpectedly quiet.");
}
const timeline = createTimeline(storyboard, waves.map((wave) => wave.duration));
const totalFrames = Math.ceil(timeline.duration * filmSettings.frameRate);
const duration = totalFrames / filmSettings.frameRate;
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
await writeFile(join(jobDirectory, "timeline.json"), `${JSON.stringify(timeline, null, 2)}\n`, { flag: "wx" });

await build({
    entryPoints: [join(sourceRoot, "scene.js")],
    outfile: join(webDirectory, "scene.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "chrome120",
    legalComments: "linked",
    minify: true,
    logLevel: "silent"
});
for (const asset of ["index.html", "scene.css"]) await copyFile(join(sourceRoot, asset), join(webDirectory, asset), constants.COPYFILE_EXCL);

const timestamp = new Date().toISOString().slice(0, 19).replaceAll(":", "").replaceAll("-", "").replace("T", "-");
const defaultName = "cme-spatial-market-center-3d-narrated";
const nameExists = [".mp4", ".png", ".json", ".srt", ".vtt", "-storyboard.jpg"].some((suffix) => existsSync(join(outputDirectory, defaultName + suffix))) || existsSync(join(playbackDirectory, `${defaultName}.mp4`));
const baseName = nameExists ? `${defaultName}-${timestamp}` : defaultName;
const outputPath = join(outputDirectory, `${baseName}.mp4`);
const browserErrors = [];
const externalRequests = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
let context;
let rendererInformation;
let renderSeconds;
const reviewFrames = [];

try {
    context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1, colorScheme: "dark" });
    await context.route("**/*", (route) => {
        if (new URL(route.request().url()).origin === origin) return route.continue();
        externalRequests.push(route.request().url());
        return route.abort();
    });
    context.on("page", (page) => {
        page.on("pageerror", (error) => browserErrors.push(error.message));
        page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
    });
    console.log("Capturing the actual local dashboard for the center panel...");
    const dashboard = await context.newPage();
    await dashboard.goto(origin);
    await expect(dashboard.locator("html")).toHaveAttribute("data-dashboard-ready", "true");
    await expect(dashboard.locator("#feed-state")).toContainText("Streaming");
    const dashboardImages = {};
    async function captureDashboard(name) {
        const path = join(jobDirectory, `dashboard-${name}.png`);
        const buffer = await dashboard.locator(".app-window").screenshot({ path, animations: "disabled" });
        dashboardImages[name] = `data:image/png;base64,${buffer.toString("base64")}`;
    }
    await captureDashboard("desk");
    await dashboard.getByRole("button", { name: "Show CL demo contract", exact: true }).click();
    await captureDashboard("energy");
    await dashboard.getByRole("button", { name: "Pause feed", exact: true }).click();
    await expect(dashboard.locator("#feed-state")).toContainText("Paused");
    await captureDashboard("paused");
    await dashboard.close();

    const page = await context.newPage();
    await page.setViewportSize({ width: filmSettings.width, height: filmSettings.height });
    const sceneUrl = `${origin}/artifacts/videos/${basename(jobDirectory)}/index.html`;
    await page.goto(sceneUrl);
    await page.waitForFunction(() => Boolean(window.spatialFilm), { timeout: 20_000 });
    rendererInformation = await page.evaluate((configuration) => window.spatialFilm.configure(configuration), { timeline, dashboardImages });
    console.log(`3D renderer ready. Film duration: ${duration.toFixed(2)} seconds; ${totalFrames} deterministic frames.`);
    for (const section of timeline.sections) {
        const time = section.start + (section.end - section.start) * 0.5;
        const frame = await page.evaluate((seconds) => window.spatialFilm.render(seconds), time);
        if (frame.triangles < 1000 || frame.section !== section.id) throw new Error("3D review frame failed validation.");
        const reviewPath = join(jobDirectory, `review-${String(section.index).padStart(2, "0")}.png`);
        await page.screenshot({ path: reviewPath });
        reviewFrames.push({ ...frame, path: relative(repositoryRoot, reviewPath) });
    }
    await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-nostdin", "-n", "-framerate", "1", "-i", join(jobDirectory, "review-%02d.png"), "-vf", "scale=640:360,tile=3x3:color=0x101b27", "-frames:v", "1", "-q:v", "2", join(jobDirectory, "review-storyboard.jpg")]);
    if (browserErrors.length || externalRequests.length) throw new Error(JSON.stringify({ browserErrors, externalRequests }));
    if (previewOnly) {
        console.log(JSON.stringify({ previewOnly, jobDirectory, duration, rendererInformation, reviewFrames, browserErrors, externalRequests }, null, 2));
    } else {
        console.log("Rendering full-resolution 3D frames and encoding H.264 / AAC...");
        const encoder = spawn(ffmpeg, [
            "-hide_banner", "-loglevel", "error", "-nostdin", "-n",
            "-f", "image2pipe", "-framerate", String(filmSettings.frameRate), "-vcodec", "mjpeg", "-i", "pipe:0", "-i", narrationPath,
            "-map", "0:v:0", "-map", "1:a:0", "-vf", "format=yuv420p",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-threads", "2",
            "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-af", "loudnorm=I=-17:TP=-1.5:LRA=7",
            "-t", duration.toFixed(6), "-movflags", "+faststart",
            "-metadata", "title=CME-style Spatial Market Center - 3D concept",
            "-metadata", "comment=Windows-rendered concept. Synthetic data only. Not Vision Pro or visionOS Simulator footage.",
            outputPath
        ], { windowsHide: true, stdio: ["pipe", "ignore", "pipe"] });
        let encoderDiagnostics = "";
        let encoderError;
        encoder.stderr.on("data", (chunk) => { encoderDiagnostics = (encoderDiagnostics + chunk.toString()).slice(-20_000); });
        encoder.on("error", (error) => { encoderError = error; });
        encoder.stdin.on("error", (error) => { encoderError = error; });
        const finished = new Promise((complete) => encoder.on("close", (code) => complete(code)));
        const started = performance.now();
        try {
            for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
                if (encoderError) throw encoderError;
                const seconds = Math.min(timeline.duration, frameIndex / filmSettings.frameRate);
                const encodedFrame = await page.evaluate((time) => window.spatialFilm.capture(time), seconds);
                const buffer = Buffer.from(encodedFrame, "base64");
                if (buffer.length < 10_000) throw new Error("Rendered frame is unexpectedly empty.");
                if (!encoder.stdin.write(buffer)) {
                    await Promise.race([
                        once(encoder.stdin, "drain"),
                        finished.then((code) => { throw new Error(`Encoder stopped before rendering finished (${code}): ${encoderDiagnostics}`); })
                    ]);
                }
                if (frameIndex % (filmSettings.frameRate * 5) === 0) {
                    const elapsed = (performance.now() - started) / 1000;
                    console.log(`Rendered ${seconds.toFixed(0)} / ${duration.toFixed(0)} seconds (${Math.round(frameIndex / totalFrames * 100)}%); elapsed ${elapsed.toFixed(0)}s`);
                }
            }
            encoder.stdin.end();
            const code = await finished;
            if (code !== 0 || encoderError) throw new Error(`Video encoding failed (${code}): ${encoderError?.message ?? encoderDiagnostics}`);
            renderSeconds = (performance.now() - started) / 1000;
        } catch (error) {
            encoder.stdin.destroy();
            encoder.kill();
            await finished;
            throw error;
        }
        if (browserErrors.length || externalRequests.length) throw new Error(JSON.stringify({ browserErrors, externalRequests }));
    }
} finally {
    if (context) await context.close();
    await browser.close();
}

if (!previewOnly) {
    console.log("Validating the complete video, audio level, and output format...");
    const validation = await run(ffmpeg, ["-hide_banner", "-nostdin", "-i", outputPath, "-af", "volumedetect", "-f", "null", "-"]);
    const durationMatch = validation.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    const durationSeconds = durationMatch ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]) : NaN;
    const peakMatch = validation.match(/max_volume:\s*(-?[\d.]+) dB/);
    const meanMatch = validation.match(/mean_volume:\s*(-?[\d.]+) dB/);
    if (!validation.includes("1920x1080") || !validation.includes("Video: h264") || !validation.includes("Audio: aac") || !validation.includes("30 fps") || !Number.isFinite(durationSeconds) || Math.abs(durationSeconds - duration) > 0.15 || !peakMatch || Number(peakMatch[1]) < -15 || Number(meanMatch?.[1] ?? -100) < -40) {
        throw new Error(`Export did not pass format/audio/duration checks: ${validation.slice(-5000)}`);
    }
    const screensSection = timeline.sections.find((section) => section.id === "screens");
    const posterTime = screensSection.start + (screensSection.end - screensSection.start) * 0.5;
    const posterPath = join(outputDirectory, `${baseName}.png`);
    const storyboardPath = join(outputDirectory, `${baseName}-storyboard.jpg`);
    await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-nostdin", "-n", "-ss", posterTime.toFixed(3), "-i", outputPath, "-frames:v", "1", posterPath]);
    await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-nostdin", "-n", "-ss", "3", "-i", outputPath, "-vf", `fps=1/${((durationSeconds - 6) / 6).toFixed(4)},scale=640:360,tile=3x2`, "-frames:v", "1", "-q:v", "2", storyboardPath]);
    await writeFile(join(outputDirectory, `${baseName}.srt`), createSubtitles(timeline), { flag: "wx" });
    await writeFile(join(outputDirectory, `${baseName}.vtt`), createSubtitles(timeline, "vtt"), { flag: "wx" });
    for (const extension of [".mp4", ".png", ".srt", ".vtt"]) await copyFile(join(outputDirectory, baseName + extension), join(playbackDirectory, baseName + extension), constants.COPYFILE_EXCL);
    const metadata = {
        video: relative(repositoryRoot, outputPath),
        playbackUrl: `${origin}/artifacts/videos/${baseName}.mp4`,
        poster: relative(repositoryRoot, posterPath),
        storyboard: relative(repositoryRoot, storyboardPath),
        subtitles: ["srt", "vtt"].map((extension) => relative(repositoryRoot, join(outputDirectory, `${baseName}.${extension}`))),
        durationSeconds,
        resolution: `${filmSettings.width}x${filmSettings.height}`,
        frameRate: filmSettings.frameRate,
        frames: totalFrames,
        codec: "H.264 / yuv420p",
        audio: { codec: "AAC", sampleRate: 48_000, voice: filmSettings.voice, gender: "male", language: "en-US", generatedOffline: true, peakDb: Number(peakMatch[1]), meanDb: Number(meanMatch[1]) },
        burnedInSubtitles: true,
        syntheticDataOnly: true,
        actualVisionProFootage: false,
        actualVisionOSSimulatorFootage: false,
        stereoVideo: false,
        description: "A monoscopic 1080p film of a rendered 3D room, actual dashboard screenshots, generated side charts, scripted focus, and an illustrative 3D depth concept.",
        fixtureTime: filmSettings.fixtureTime,
        bytes: (await stat(outputPath)).size,
        createdAt: new Date().toISOString(),
        renderSeconds,
        rendererInformation,
        browserErrors,
        externalRequests,
        fullDecodeValidated: true,
        jobDirectory: relative(repositoryRoot, jobDirectory),
        sections: timeline.sections,
        cues: timeline.cues
    };
    await writeFile(join(outputDirectory, `${baseName}.json`), `${JSON.stringify(metadata, null, 2)}\n`, { flag: "wx" });
    console.log(JSON.stringify({ video: outputPath, playbackUrl: metadata.playbackUrl, durationSeconds, resolution: metadata.resolution, voice: metadata.audio.voice, subtitles: metadata.subtitles, megabytes: (metadata.bytes / 1_000_000).toFixed(1), browserErrors, externalRequests }, null, 2));
}
