import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";
import { modelCopy, modelSource, syncPaperTradingModel } from "../../scripts/sync-paper-trading.js";
import { createVisionOSBundle } from "../../scripts/build-visionos.js";

test("Windows and native packaging use the exact shared paper-trading model", async () => {
    const source = (await readFile(modelSource, "utf8")).replace(/\r\n/g, "\n");
    const copy = (await readFile(modelCopy, "utf8")).replace(/\r\n/g, "\n");
    assert.equal(copy, source);
    await syncPaperTradingModel({ check: true });
    const bundle = await createVisionOSBundle();
    const manifest = JSON.parse(bundle.get("bundle-manifest.json"));
    assert.equal(manifest.sources["market/paper-trading-model.js"], createHash("sha256").update(source).digest("hex"));
    assert.ok(bundle.get("index.html").includes("paper-review-dialog"));
    assert.ok(bundle.get("index.html").includes("FICTIONAL FUNDS"));
    assert.ok(!bundle.get("index.html").includes('href="./market/paper-trading.css"'));
});
