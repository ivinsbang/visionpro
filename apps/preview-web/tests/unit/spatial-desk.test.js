import assert from "node:assert/strict";
import test from "node:test";
import { arrangeWindows, clampNumber, FEATURE_TOUR, frameCamera, moveWindow, windowDimensions } from "../../spatial/desk-layout.js";

test("3D window dimensions adapt to desktop, compact, and mobile viewports", () => {
    for (const [width, height] of [[1920, 900], [1040, 350], [390, 520]]) {
        const dimensions = windowDimensions(width, height);
        for (const panel of Object.values(dimensions)) {
            assert.ok(panel.width > 0 && panel.width < width);
            assert.ok(panel.height > 0 && panel.height < height);
        }
    }
});

test("panorama layouts preserve unique window positions without changing inputs", () => {
    const dimensions = windowDimensions(1600, 820);
    const original = structuredClone(dimensions);
    const curved = arrangeWindows(dimensions);
    const flat = arrangeWindows(dimensions, "flat");
    assert.ok(curved.companion.rotation > 0);
    assert.ok(curved.chart.rotation < 0);
    assert.equal(flat.chart.rotation, 0);
    assert.equal(flat.companion.rotation, 0);
    assert.ok(curved.companion.horizontal < curved.desk.horizontal);
    assert.ok(curved.chart.horizontal > curved.desk.horizontal);
    assert.ok(curved.spatial.vertical > dimensions.desk.height / 2);
    assert.deepEqual(dimensions, original);
});

test("window movement is bounded and cannot mutate its prior position", () => {
    const position = { horizontal: 0, vertical: 0, depth: -140, rotation: 24 };
    assert.deepEqual(moveWindow(position, 20, -40), { ...position, horizontal: 20, vertical: -40 });
    const bounded = moveWindow(position, 5000, -5000);
    assert.equal(bounded.horizontal, 1900);
    assert.equal(bounded.vertical, -1100);
    assert.equal(position.horizontal, 0);
    assert.equal(clampNumber(Number.NaN, 0, 100, 50), 50);
});

test("focused cameras center each window and counter its panorama rotation", () => {
    const dimensions = windowDimensions(1600, 820);
    const positions = arrangeWindows(dimensions);
    for (const key of Object.keys(positions)) {
        const camera = frameCamera({ view: key, positions, dimensions, visible: Object.keys(positions), width: 1600, height: 820 });
        assert.equal(camera.horizontal, positions[key].horizontal);
        assert.equal(camera.vertical, positions[key].vertical);
        assert.equal(camera.depth, positions[key].depth);
        assert.ok(camera.yaw === -positions[key].rotation);
        assert.ok(camera.scale > 0 && camera.scale <= 1.5);
    }
});

test("room framing covers open windows and safely handles empty or extreme input", () => {
    const dimensions = windowDimensions(1440, 750);
    const positions = arrangeWindows(dimensions);
    const room = frameCamera({ view: "overview", positions, dimensions, visible: ["desk", "chart", "companion"], width: 1440, height: 750 });
    const expanded = frameCamera({ view: "overview", positions, dimensions, visible: Object.keys(positions), width: 1440, height: 750 });
    assert.ok(expanded.scale < room.scale);
    const invalid = frameCamera({ view: "unknown", positions, dimensions, visible: [], width: Number.NaN, height: 0, zoom: Number.NaN, orbit: 1000, tilt: -1000 });
    assert.ok(Object.values(invalid).every(Number.isFinite));
    assert.equal(invalid.yaw, 20);
    assert.equal(invalid.pitch, -10);
});

test("the tour covers built financial features without financial actions", () => {
    assert.equal(FEATURE_TOUR.length, 9);
    assert.ok(FEATURE_TOUR.some((step) => step.page === "paper"));
    assert.ok(FEATURE_TOUR.some((step) => step.page === "portfolio"));
    assert.ok(FEATURE_TOUR.some((step) => step.view === "spatial"));
    assert.ok(FEATURE_TOUR.some((step) => step.page === "settings"));
    for (const step of FEATURE_TOUR) {
        assert.ok(step.title && step.detail);
        assert.ok(!("order" in step) && !("reset" in step));
    }
});
