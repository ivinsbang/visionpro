import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const modelSource = fileURLToPath(new URL("../../../packages/TradingSimulation/Sources/TradingSimulation/paper-trading.mjs", import.meta.url));
export const modelCopy = fileURLToPath(new URL("../market/paper-trading-model.js", import.meta.url));

export async function syncPaperTradingModel({ check = false } = {}) {
    const source = (await readFile(modelSource, "utf8")).replace(/\r\n/g, "\n");
    const existing = await readFile(modelCopy, "utf8").catch((error) => {
        if (error.code === "ENOENT") return undefined;
        throw error;
    });
    if (existing?.replace(/\r\n/g, "\n") === source) return;
    if (check) throw new Error("The browser paper-trading model is stale. Run npm run build:simulation in apps/preview-web.");
    await writeFile(modelCopy, source, "utf8");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const argumentsList = process.argv.slice(2);
    if (argumentsList.length > 1 || argumentsList.some((argument) => argument !== "--check")) throw new Error("Usage: node scripts/sync-paper-trading.js [--check]");
    syncPaperTradingModel({ check: argumentsList.includes("--check") }).then(() => {
        console.log("The browser model matches the shared local paper-trading source.");
    }).catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
