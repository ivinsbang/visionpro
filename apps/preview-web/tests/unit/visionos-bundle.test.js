import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Script } from "node:vm";
import test from "node:test";
import { checkVisionOSBundle, contentSecurityPolicy, createVisionOSBundle } from "../../scripts/build-visionos.js";

test("native bundle is deterministic and contains only approved offline resources", async () => {
    const first = await createVisionOSBundle();
    const second = await createVisionOSBundle();
    assert.deepEqual(first, second);
    assert.deepEqual([...first.keys()].sort(), [
        "app.bundle.js", "bundle-manifest.json", "dashboard.css", "icon.svg", "index.html"
    ]);
});

test("native HTML uses a classic local script and a deny-by-default content policy", async () => {
    const files = await createVisionOSBundle();
    const html = files.get("index.html");
    assert.ok(html.includes(`content="${contentSecurityPolicy}"`));
    assert.ok(html.includes('data-host="visionos"'));
    assert.ok(html.includes('<script src="./app.bundle.js" defer></script>'));
    assert.ok(html.includes("Watchlist lasts while this desk is open."));
    assert.ok(!html.includes('type="module"'));
    assert.ok(!/\b(?:src|href)="(?:https?:|\/\/)/i.test(html));
    assert.doesNotThrow(() => new Script(files.get("app.bundle.js")));
    assert.ok(contentSecurityPolicy.includes("connect-src 'none'"));
    assert.ok(contentSecurityPolicy.includes("script-src file:"));
    assert.ok(contentSecurityPolicy.includes("style-src file:"));
    assert.ok(contentSecurityPolicy.includes("img-src file: data:"));
    assert.ok(!contentSecurityPolicy.includes("'self'"));
    assert.ok(contentSecurityPolicy.includes("form-action 'none'"));
    assert.ok(!contentSecurityPolicy.includes("unsafe-inline"));
    assert.ok(!contentSecurityPolicy.includes("unsafe-eval"));
});

test("native manifest hashes every runtime file without machine paths or timestamps", async () => {
    const files = await createVisionOSBundle();
    const manifest = JSON.parse(files.get("bundle-manifest.json"));
    assert.equal(manifest.host, "visionos");
    assert.equal(manifest.mode, "synthetic");
    assert.deepEqual(manifest.bundler, { name: "esbuild", version: "0.28.2", target: "safari17" });
    assert.equal(Object.keys(manifest.files).length, 4);
    assert.equal(Object.keys(manifest.sources).length, 18);
    for (const [filename, expected] of Object.entries(manifest.files)) {
        assert.equal(createHash("sha256").update(files.get(filename)).digest("hex"), expected);
    }
    assert.ok(!/generatedAt|[A-Z]:\\|\/Users\//.test(files.get("bundle-manifest.json")));
    await checkVisionOSBundle(files);
});

test("native bundle verification rejects stale content without modifying resources", async () => {
    const files = await createVisionOSBundle();
    files.set("icon.svg", `${files.get("icon.svg")} `);
    await assert.rejects(checkVisionOSBundle(files), /missing or stale: icon\.svg/);
});

test("native bundle verification refuses unexpected resource files", async () => {
    const files = await createVisionOSBundle();
    files.delete("bundle-manifest.json");
    await assert.rejects(checkVisionOSBundle(files), /Unexpected native resources/);
});
