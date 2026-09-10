import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, version as esbuildVersion } from "esbuild";
import { syncPaperTradingModel } from "./sync-paper-trading.js";

const previewRoot = fileURLToPath(new URL("../", import.meta.url));
export const bundleDirectory = path.resolve(previewRoot, "../visionos/CMESpatialMarketCenter/Resources/MarketDashboard");
const sourcePaths = [
    "index.html", "app.js", "styles.css", "icon.svg", "market/contracts.js",
    "market/simulator.js", "market/chart.js", "market/dashboard.js", "market/dashboard.css",
    "market/paper-trading-model.js", "market/paper-trading-fixtures.js", "market/paper-trading.js", "market/paper-trading.css",
    "spatial/desk-layout.js", "spatial/desk.js", "spatial/desk.css",
    "hosts/visionos.css", "scripts/build-visionos.js"
];

export const contentSecurityPolicy = [
    "default-src 'none'", "script-src file:", "style-src file:",
    "img-src file: data:", "connect-src 'none'", "font-src 'none'",
    "media-src 'none'", "object-src 'none'", "frame-src 'none'",
    "base-uri 'none'", "form-action 'none'"
].join("; ");

function digest(contents) {
    return createHash("sha256").update(contents).digest("hex");
}

function replaceOnce(contents, original, replacement) {
    if (contents.split(original).length !== 2) {
        throw new Error(`Expected exactly one HTML packaging marker: ${original}`);
    }
    return contents.replace(original, replacement);
}

export async function createVisionOSBundle() {
    await syncPaperTradingModel({ check: true });
    const sources = new Map(await Promise.all(sourcePaths.map(async (sourcePath) => [
        sourcePath, (await readFile(path.join(previewRoot, sourcePath), "utf8")).replace(/\r\n/g, "\n")
    ])));
    const commonOptions = {
        absWorkingDir: previewRoot,
        bundle: true,
        write: false,
        target: "safari17",
        legalComments: "none",
        minifyWhitespace: true,
        minifySyntax: true,
        logLevel: "silent"
    };
    const javascript = await build({
        ...commonOptions,
        entryPoints: ["app.js"],
        platform: "browser",
        format: "iife",
        metafile: true
    });
    const unexpectedInputs = Object.keys(javascript.metafile.inputs).filter((input) => !sources.has(input.replaceAll("\\", "/")));
    if (unexpectedInputs.length > 0) {
        throw new Error(`Unapproved dashboard bundle inputs: ${unexpectedInputs.join(", ")}`);
    }
    const stylesheet = await build({
        ...commonOptions,
        stdin: {
            contents: ["styles.css", "market/dashboard.css", "market/paper-trading.css", "spatial/desk.css", "hosts/visionos.css"].map((sourcePath) => sources.get(sourcePath)).join("\n"),
            loader: "css",
            resolveDir: previewRoot
        }
    });

    let html = sources.get("index.html");
    const replacements = [
        ['<html lang="en">', '<html lang="en" data-host="visionos">'],
        ['<meta charset="utf-8">', `<meta charset="utf-8">\n    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">`],
        ['<link rel="stylesheet" href="./styles.css">', '<link rel="stylesheet" href="./dashboard.css">'],
        ['    <link rel="stylesheet" href="./market/dashboard.css">\n', ""],
        ['    <link rel="stylesheet" href="./market/paper-trading.css">\n', ""],
        ['    <link rel="stylesheet" href="./spatial/desk.css">\n', ""],
        ['<script src="./app.js" type="module"></script>', '<script src="./app.bundle.js" defer></script>'],
        ["for local Windows review", "bundled for offline visionOS use"],
        ["Star markets to save on this browser.", "Watchlist lasts while this desk is open."],
        ["Browser prototype", "Bundled dashboard"],
        ["Only your demo watchlist is saved in this browser.", "Your demo watchlist stays in memory while this desk is open. Closing or reloading the desk resets it."],
        ["WINDOWS SPATIAL PROTOTYPE", "OFFLINE VISIONOS PROTOTYPE"],
        ["Not a CME service or a visionOS simulator.", "Not a CME service. Web panels stay inside this app window."]
    ];
    for (const [original, replacement] of replacements) {
        html = replaceOnce(html, original, replacement);
    }

    const files = new Map([
        ["index.html", html],
        ["app.bundle.js", javascript.outputFiles[0].text],
        ["dashboard.css", stylesheet.outputFiles[0].text],
        ["icon.svg", sources.get("icon.svg")]
    ]);
    const manifest = {
        formatVersion: 1,
        source: "apps/preview-web",
        host: "visionos",
        mode: "synthetic",
        bundler: { name: "esbuild", version: esbuildVersion, target: "safari17" },
        sources: Object.fromEntries([...sources].map(([sourcePath, contents]) => [sourcePath, digest(contents)])),
        files: Object.fromEntries([...files].map(([filename, contents]) => [filename, digest(contents)]))
    };
    files.set("bundle-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
    return files;
}

export async function checkVisionOSBundle(files) {
    const expectedFiles = files ?? await createVisionOSBundle();
    const existing = await readdir(bundleDirectory).catch((error) => {
        if (error.code === "ENOENT") return [];
        throw error;
    });
    const unexpected = existing.filter((filename) => !expectedFiles.has(filename));
    if (unexpected.length > 0) {
        throw new Error(`Unexpected native resources; review manually: ${unexpected.join(", ")}`);
    }
    const stale = [];
    for (const [filename, expected] of expectedFiles) {
        const actual = await readFile(path.join(bundleDirectory, filename), "utf8").catch((error) => {
            if (error.code === "ENOENT") return undefined;
            throw error;
        });
        if (actual?.replace(/\r\n/g, "\n") !== expected) stale.push(filename);
    }
    if (stale.length > 0) {
        throw new Error(`Native dashboard resources are missing or stale: ${stale.join(", ")}. Run npm run build:visionos in apps/preview-web.`);
    }
}

async function main() {
    const argumentsList = process.argv.slice(2);
    if (argumentsList.length > 1 || (argumentsList.length === 1 && argumentsList[0] !== "--check")) {
        throw new Error("Usage: node scripts/build-visionos.js [--check]");
    }
    const files = await createVisionOSBundle();
    if (argumentsList.includes("--check")) {
        await checkVisionOSBundle(files);
        console.log("Native dashboard bundle matches its sources (offline, synthetic only).");
        return;
    }
    await mkdir(bundleDirectory, { recursive: true });
    const unexpected = (await readdir(bundleDirectory)).filter((filename) => !files.has(filename));
    if (unexpected.length > 0) {
        throw new Error(`Refusing to package unexpected resources: ${unexpected.join(", ")}`);
    }
    for (const [filename, contents] of files) {
        await writeFile(path.join(bundleDirectory, filename), contents, "utf8");
    }
    console.log(`Bundled ${files.size} local dashboard resources into ${bundleDirectory}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
