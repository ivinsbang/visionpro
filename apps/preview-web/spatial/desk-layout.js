export const WINDOW_NAMES = Object.freeze({
    desk: "Market center",
    chart: "Independent chart",
    companion: "Linked quote",
    spatial: "Spatial model"
});

export const FEATURE_TOUR = Object.freeze([
    { title: "Your whole workspace, in view.", detail: "These are the working app windows, not screenshots. Focus a window to use its controls at a comfortable size.", view: "overview", page: "markets" },
    { title: "Seven markets. Your own watchlist.", detail: "Search and filter the generated contracts, star a watchlist, and select a market. No CME data is used.", view: "desk", page: "markets", target: ".market-browser" },
    { title: "Charts, depth, and the tape.", detail: "Switch chart type and range, inspect candles, and compare the linked eight-level book and generated prints.", view: "desk", page: "markets", target: ".price-panel" },
    { title: "Give another market its own screen.", detail: "This chart has an independent contract selector. The separate quote window follows the main desk. Drag a title bar or use its arrow keys.", view: "chart" },
    { title: "Practice with fictional funds.", detail: "Buy or sell in Paper trading. Review and explicitly confirm each order. The tour never places orders or resets your account.", view: "desk", page: "paper", target: "#paper-ticket" },
    { title: "See the effect on your portfolio.", detail: "Confirmed paper fills appear as positions, P/L, exposure, and illustrative margin. Start flat, or place your own paper order to populate this view.", view: "desk", page: "portfolio" },
    { title: "A small model of a bigger idea.", detail: "Rotate the existing three-market spatial model. It is a CSS 3D prototype, not a native RealityKit scene or headset tracking.", view: "spatial" },
    { title: "The foundation stays available.", detail: "Overview and Spatial workspace keep the original window launchers. Every page uses the same running market session and paper ledger.", view: "desk", page: "overview" },
    { title: "Offline, with visible limits.", detail: "Pause or simulate an outage in the app to hold quotes and block paper fills. Reset needs confirmation after paper activity. Calendar, voice search, and real connections are not built.", view: "desk", page: "settings" }
]);

export function clampNumber(value, minimum, maximum, fallback = minimum) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(minimum, Math.min(numeric, maximum)) : fallback;
}

export function windowDimensions(width, height) {
    const availableWidth = clampNumber(width, 320, 6000, 1120);
    const availableHeight = clampNumber(height, 300, 4000, 780);
    return {
        desk: { width: Math.min(1120, availableWidth - 32), height: Math.min(780, availableHeight - 52) },
        chart: { width: Math.min(620, availableWidth - 32), height: Math.min(480, availableHeight - 24) },
        companion: { width: Math.min(360, availableWidth - 32), height: Math.min(500, availableHeight - 24) },
        spatial: { width: Math.min(590, availableWidth - 32), height: Math.min(470, availableHeight - 24) }
    };
}

export function arrangeWindows(dimensions, arrangement = "arc") {
    const halfDesk = dimensions.desk.width / 2;
    const spacing = arrangement === "flat" ? 70 : 100;
    return {
        desk: { horizontal: 0, vertical: 0, depth: 0, rotation: 0 },
        chart: { horizontal: halfDesk + dimensions.chart.width / 2 + spacing, vertical: -16, depth: arrangement === "flat" ? 0 : -140, rotation: arrangement === "flat" ? 0 : -24 },
        companion: { horizontal: -halfDesk - dimensions.companion.width / 2 - spacing, vertical: -36, depth: arrangement === "flat" ? 0 : -100, rotation: arrangement === "flat" ? 0 : 24 },
        spatial: { horizontal: 0, vertical: dimensions.desk.height / 2 + dimensions.spatial.height / 2 + 90, depth: -100, rotation: 0 }
    };
}

export function moveWindow(position, horizontalChange, verticalChange) {
    return {
        ...position,
        horizontal: clampNumber(position.horizontal + horizontalChange, -1900, 1900, position.horizontal),
        vertical: clampNumber(position.vertical + verticalChange, -1100, 1400, position.vertical)
    };
}

export function frameCamera({ view, positions, dimensions, visible, width, height, zoom = 100, orbit = 0, tilt = 0 }) {
    const availableWidth = clampNumber(width, 320, 6000, 1120);
    const availableHeight = clampNumber(height, 200, 4000, 700);
    let horizontal = 0;
    let vertical = 0;
    let depth = 0;
    let rotation = 0;
    let scale;
    if (view !== "overview" && visible.includes(view) && positions[view]) {
        const position = positions[view];
        const size = dimensions[view];
        horizontal = position.horizontal;
        vertical = position.vertical;
        depth = position.depth;
        rotation = -position.rotation;
        scale = Math.min((availableWidth - 40) / size.width, (availableHeight - 42) / (size.height + (view === "desk" ? 42 : 0)), view === "desk" ? 1.05 : 1.5);
    } else {
        const frames = visible.filter((key) => positions[key] && dimensions[key]);
        const left = Math.min(...frames.map((key) => positions[key].horizontal - dimensions[key].width / 2), -100);
        const right = Math.max(...frames.map((key) => positions[key].horizontal + dimensions[key].width / 2), 100);
        const top = Math.min(...frames.map((key) => positions[key].vertical - dimensions[key].height / 2 - 42), -100);
        const bottom = Math.max(...frames.map((key) => positions[key].vertical + dimensions[key].height / 2), 100);
        horizontal = (left + right) / 2;
        vertical = (top + bottom) / 2;
        scale = Math.min((availableWidth - 96) / (right - left), (availableHeight - 76) / (bottom - top), 1) * 0.9;
    }
    return {
        horizontal, vertical, depth,
        scale: Math.max(0.1, scale * clampNumber(zoom, 65, 125, 100) / 100),
        yaw: rotation + clampNumber(orbit, -20, 20, 0),
        pitch: clampNumber(tilt, -10, 10, 0)
    };
}
