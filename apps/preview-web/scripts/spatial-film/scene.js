import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { SyntheticMarket } from "../../market/simulator.js";
import { filmSettings } from "./storyboard.js";
import { stateAt } from "./timeline.js";

const { width, height } = filmSettings;
const film = document.getElementById("film");
const graphics = film.getContext("2d", { alpha: false });
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
renderer.setSize(width, height);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#b6c4cb");
scene.fog = new THREE.Fog("#c5c9cd", 23, 60);
const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 90);
const target = new THREE.Vector3();
const mint = "#8ce6d6";
const rose = "#f1a9b4";
let timeline;
let snapshots;
let dashboardImages;
let lastSnapshot = -1;
let lastDashboard = "";

function roundedRectangle(context, left, top, rectangleWidth, rectangleHeight, radius, fill, stroke) {
    context.beginPath();
    context.roundRect(left, top, rectangleWidth, rectangleHeight, radius);
    if (fill) {
        context.fillStyle = fill;
        context.fill();
    }
    if (stroke) {
        context.strokeStyle = stroke;
        context.lineWidth = 1.5;
        context.stroke();
    }
}

function text(context, value, left, top, size = 24, color = "#e7f2f6", weight = 400, alignment = "left") {
    context.font = `${weight} ${size}px "Segoe UI", sans-serif`;
    context.fillStyle = color;
    context.textAlign = alignment;
    context.textBaseline = "alphabetic";
    context.fillText(value, left, top);
}

function canvasTexture(textureWidth, textureHeight, painter) {
    const canvas = document.createElement("canvas");
    canvas.width = textureWidth;
    canvas.height = textureHeight;
    const context = canvas.getContext("2d");
    if (painter) painter(context, canvas);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return { canvas, context, texture };
}

function material(color, roughness = 0.75, metalness = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(dimensions, position, surface, radius = 0) {
    const geometry = radius > 0 ? new RoundedBoxGeometry(...dimensions, 2, radius) : new THREE.BoxGeometry(...dimensions);
    const mesh = new THREE.Mesh(geometry, surface);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
}

function smooth(value) {
    const clamped = Math.max(0, Math.min(1, value));
    return clamped * clamped * (3 - 2 * clamped);
}

function interpolate(first, second, progress) {
    return first.map((value, index) => THREE.MathUtils.lerp(value, second[index], progress));
}

function glowTexture() {
    return canvasTexture(128, 128, (context) => {
        const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, "rgba(24, 40, 47, 0.36)");
        gradient.addColorStop(0.5, "rgba(24, 40, 47, 0.10)");
        gradient.addColorStop(1, "rgba(24, 40, 47, 0)");
        context.fillStyle = gradient;
        context.fillRect(0, 0, 128, 128);
    }).texture;
}

function buildRoom() {
    scene.add(new THREE.HemisphereLight("#e6f2ff", "#89735f", 2.5));
    const sunlight = new THREE.DirectionalLight("#ffe0b4", 3.4);
    sunlight.position.set(-7, 9, -7);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(1024, 1024);
    sunlight.shadow.camera.left = -14;
    sunlight.shadow.camera.right = 14;
    sunlight.shadow.camera.top = 10;
    sunlight.shadow.camera.bottom = -12;
    sunlight.shadow.normalBias = 0.05;
    sunlight.shadow.bias = -0.0003;
    scene.add(sunlight);

    const floor = material("#aaa297", 0.78);
    box([24, 0.18, 26], [0, -0.1, -1], floor);
    const seam = material("#8e8c85", 0.95);
    for (let column = -5; column <= 5; column += 1) box([0.012, 0.006, 24], [column * 2.2, 0, -1], seam);
    for (let row = -5; row <= 5; row += 1) box([24, 0.006, 0.012], [0, 0, row * 2.2], seam);
    const ivory = material("#d4d2c9");
    box([0.25, 7.5, 19], [-10, 3.7, -1], ivory);
    box([0.25, 7.5, 19], [10, 3.7, -1], ivory);
    box([20, 0.25, 19], [0, 7.3, -1], ivory);
    const frame = material("#3b4648", 0.5, 0.25);
    for (let column = -3; column <= 3; column += 1) box([0.095, 7.2, 0.13], [column * 3.1, 3.6, -7.1], frame);
    box([20, 0.13, 0.13], [0, 5.65, -7.1], frame);
    box([20, 0.18, 0.3], [0, 0.1, -7.1], frame);

    const sky = canvasTexture(1600, 900, (context) => {
        const gradient = context.createLinearGradient(0, 0, 0, 900);
        gradient.addColorStop(0, "#5d829c");
        gradient.addColorStop(0.52, "#bac5ca");
        gradient.addColorStop(0.85, "#eecab0");
        gradient.addColorStop(1, "#d1b5a2");
        context.fillStyle = gradient;
        context.fillRect(0, 0, 1600, 900);
        const halo = context.createRadialGradient(280, 515, 8, 280, 515, 250);
        halo.addColorStop(0, "rgba(255,239,204,0.85)");
        halo.addColorStop(1, "rgba(255,229,190,0)");
        context.fillStyle = halo;
        context.fillRect(0, 0, 1600, 900);
        for (let layer = 0; layer < 3; layer += 1) {
            context.fillStyle = ["#92a7b4", "#8398a7", "#778c9c"][layer];
            context.beginPath();
            context.moveTo(0, 900);
            for (let point = 0; point <= 40; point += 1) {
                const elevation = 670 + layer * 44 - Math.abs(Math.sin(point * 0.46 + layer * 2)) * 120 - Math.sin(point * 0.19) * 75;
                context.lineTo(point * 40, elevation);
            }
            context.lineTo(1600, 900);
            context.fill();
        }
    });
    const skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(64, 28), new THREE.MeshBasicMaterial({ map: sky.texture, toneMapped: false }));
    skyPlane.position.set(0, 9, -25);
    scene.add(skyPlane);

    const buildingColors = ["#b4b3ac", "#c5c1b4", "#9da9ac", "#d2c7b2"];
    for (let building = 0; building < 23; building += 1) {
        const buildingHeight = 0.9 + (Math.sin(building * 7.32) + 1) * 1.5;
        const horizontal = (building - 11) * 1.27;
        const depth = -12.5 - Math.sin(building) * 1.7;
        box([0.85 + (building % 3) * 0.15, buildingHeight, 1.2], [horizontal, buildingHeight / 2 - 0.3, depth], material(buildingColors[building % 4]));
        for (let level = 1; level < Math.floor(buildingHeight * 3); level += 1) {
            box([0.7, 0.025, 0.025], [horizontal, level * 0.3 - 0.15, depth + 0.61], material("#647c8b", 0.4, 0.2));
        }
    }

    const oak = material("#a07750", 0.6);
    for (let slat = 0; slat < 22; slat += 1) box([0.11, 5.8, 0.16], [7.2 + slat * 0.12, 2.9, -3.8], oak);
    const fabric = material("#74797a", 0.98);
    box([2.5, 0.44, 1.05], [7.6, 0.63, -1.8], fabric, 0.18);
    box([2.5, 0.8, 0.32], [7.6, 1.02, -2.28], fabric, 0.16);
    box([0.28, 0.55, 1.08], [6.4, 0.9, -1.8], fabric, 0.1);
    box([0.28, 0.55, 1.08], [8.8, 0.9, -1.8], fabric, 0.1);
    box([0.65, 0.6, 0.17], [7, 1.08, -2.02], material("#c2ae95"), 0.08).rotation.z = -0.15;

    const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.34, 0.75, 24), material("#c7c2b8"));
    planter.position.set(-7.2, 0.38, -3.8);
    planter.castShadow = true;
    scene.add(planter);
    for (let leafIndex = 0; leafIndex < 15; leafIndex += 1) {
        const angle = leafIndex * 2.4;
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material(leafIndex % 2 ? "#5e7565" : "#819080"));
        leaf.scale.set(0.17, 0.85, 0.065);
        leaf.position.set(-7.2 + Math.sin(angle) * 0.42, 1.2 + (leafIndex % 4) * 0.19, -3.8 + Math.cos(angle) * 0.35);
        leaf.rotation.set(Math.cos(angle) * 0.48, angle, Math.sin(angle) * 0.42);
        leaf.castShadow = true;
        scene.add(leaf);
    }

    const graphite = material("#343b3d", 0.45, 0.3);
    box([3.7, 0.13, 1.4], [0.6, 0.8, 3.65], oak, 0.09);
    box([0.12, 0.76, 1.05], [-0.8, 0.39, 3.65], graphite, 0.03);
    box([0.12, 0.76, 1.05], [2, 0.39, 3.65], graphite, 0.03);
    box([0.7, 0.045, 0.48], [0.45, 0.9, 3.6], material("#293746"), 0.03).rotation.y = -0.18;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.085, 0.22, 24), material("#e3ddd1", 0.35));
    cup.position.set(1.65, 0.98, 3.56);
    scene.add(cup);
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.087, 24), material("#3f3028"));
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.set(1.65, 1.092, 3.56);
    scene.add(coffee);

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, 0.015, -0.5);
    scene.add(shadow);
    renderer.shadowMap.needsUpdate = true;
}

function panel(textureWidth, textureHeight, physicalWidth, position, yaw) {
    const surface = canvasTexture(textureWidth, textureHeight);
    const physicalHeight = physicalWidth * textureHeight / textureWidth;
    const group = new THREE.Group();
    group.position.set(...position);
    group.rotation.y = yaw;
    const casing = new THREE.Mesh(new RoundedBoxGeometry(physicalWidth + 0.035, physicalHeight + 0.035, 0.075, 3, 0.11), material("#718d9a", 0.32, 0.65));
    group.add(casing);
    const display = new THREE.Mesh(new THREE.PlaneGeometry(physicalWidth, physicalHeight), new THREE.MeshBasicMaterial({ map: surface.texture, transparent: true, toneMapped: false, depthWrite: false }));
    display.position.z = 0.045;
    group.add(display);
    const handle = new THREE.Mesh(new RoundedBoxGeometry(physicalWidth * 0.18, 0.025, 0.016, 2, 0.01), new THREE.MeshBasicMaterial({ color: "#e0edf1", transparent: true, opacity: 0.65 }));
    handle.position.set(0, -physicalHeight / 2 - 0.11, 0.04);
    group.add(handle);
    scene.add(group);
    return { ...surface, group, display, basePosition: position, yaw, physicalWidth, physicalHeight };
}

function panelBackground(surface) {
    const { context, canvas } = surface;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#294355");
    gradient.addColorStop(0.6, "#152b3d");
    gradient.addColorStop(1, "#122635");
    roundedRectangle(context, 0, 0, canvas.width, canvas.height, 35, gradient);
    roundedRectangle(context, 1.5, 1.5, canvas.width - 3, canvas.height - 3, 34, null, "#839ba96b");
}

function quotePrice(market, price = market.price) {
    return price.toLocaleString("en-US", { minimumFractionDigits: market.precision, maximumFractionDigits: market.precision });
}

function chartSurface(surface, market, snapshot, paused) {
    panelBackground(surface);
    const context = surface.context;
    const positive = market.change >= 0;
    const color = positive ? mint : rose;
    text(context, market.symbol, 46, 66, 36, "#f0f7fa", 600);
    text(context, market.name, 125, 64, 21, "#b3c7d1");
    roundedRectangle(context, 763, 29, 190, 48, 14, paused ? "#735d384d" : "#75cfba18", "#8bd7ce30");
    text(context, paused ? "HELD SNAPSHOT" : "SYNTHETIC", 858, 60, 17, paused ? "#f2d39d" : mint, 600, "center");
    text(context, quotePrice(market), 46, 143, 53, "#ecf6fa", 500);
    text(context, `${positive ? "+" : ""}${market.changePercent.toFixed(2)}%`, 951, 140, 26, color, 500, "right");
    text(context, "1H   /   GENERATED PRICE HISTORY", 48, 184, 16, "#8aabbc", 500);
    const bars = market.bars.slice(-60);
    const minimum = Math.min(...bars.map((bar) => bar.low));
    const maximum = Math.max(...bars.map((bar) => bar.high));
    const spread = Math.max(maximum - minimum, market.increment * 4);
    const chartTop = 216;
    const chartBottom = 411;
    const priceTop = (price) => chartBottom - (price - minimum) / spread * (chartBottom - chartTop);
    const priceLeft = (index) => 48 + index * 13.78;
    context.strokeStyle = "#9cb4c11b";
    context.lineWidth = 1;
    for (let line = 0; line <= 4; line += 1) {
        const vertical = chartTop + line * (chartBottom - chartTop) / 4;
        context.beginPath();
        context.moveTo(48, vertical);
        context.lineTo(890, vertical);
        context.stroke();
        text(context, quotePrice(market, maximum - line * spread / 4), 955, vertical + 5, 14, "#94aebd", 400, "right");
    }
    const fill = context.createLinearGradient(0, chartTop, 0, chartBottom + 30);
    fill.addColorStop(0, positive ? "#79dcc638" : "#e598ab32");
    fill.addColorStop(1, "#8de3d200");
    context.beginPath();
    context.moveTo(priceLeft(0), chartBottom + 10);
    bars.forEach((bar, index) => context.lineTo(priceLeft(index), priceTop(bar.close)));
    context.lineTo(priceLeft(59), chartBottom + 10);
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.beginPath();
    bars.forEach((bar, index) => index === 0 ? context.moveTo(priceLeft(index), priceTop(bar.close)) : context.lineTo(priceLeft(index), priceTop(bar.close)));
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.lineJoin = "round";
    context.stroke();
    context.beginPath();
    context.arc(priceLeft(59), priceTop(bars.at(-1).close), 6, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
    const maximumVolume = Math.max(...bars.map((bar) => bar.volume));
    bars.forEach((bar, index) => {
        context.fillStyle = bar.close >= bar.open ? "#82d0b84d" : "#d597a547";
        const barHeight = bar.volume / maximumVolume * 53;
        context.fillRect(priceLeft(index), 485 - barHeight, 9.5, barHeight);
    });
    text(context, "DEMO VOLUME", 48, 520, 15, "#8aabbc");
    text(context, `${new Date(snapshot.generatedAt).toISOString().slice(11, 19)} UTC / FIXTURE CLOCK`, 950, 520, 15, "#8aabbc", 400, "right");
    text(context, "Local engine only. No CME feed. No orders.", 48, 562, 17, "#b3c7d1");
    surface.texture.needsUpdate = true;
}

function dashboardSurface(mode) {
    panelBackground(mainPanel);
    const context = mainPanel.context;
    text(context, "EXISTING DASHBOARD  /  CAPTURED APP VIEW", 34, 45, 22, "#c1d7e2", 500);
    text(context, mode === "paused" ? "PAUSED SYNTHETIC SNAPSHOT" : "WINDOWS PROTOTYPE", 1565, 45, 19, mode === "paused" ? "#f2d39d" : mint, 500, "right");
    const image = dashboardImages[mode];
    const imageWidth = 1560;
    const imageHeight = image.height / image.width * imageWidth;
    const imageTop = 78 + (882 - imageHeight) / 2;
    context.save();
    context.beginPath();
    context.roundRect(20, 74, 1560, 886, 20);
    context.clip();
    context.drawImage(image, 20, imageTop, imageWidth, imageHeight);
    context.restore();
    text(context, "Independent CME-style concept. All prices and activity are synthetic.", 36, 984, 16, "#9dbbc8");
    mainPanel.texture.needsUpdate = true;
}

buildRoom();
const mainPanel = panel(1600, 1000, 6.1, [0, 2.85, -2.3], 0);
const marketPanels = [
    { symbol: "NQ", ...panel(1000, 600, 3.5, [-4.85, 2.8, -1.25], 0.38) },
    { symbol: "CL", ...panel(1000, 600, 3.5, [4.8, 2.8, -1.05], -0.38) },
    { symbol: "GC", ...panel(1000, 600, 2.9, [-3.55, 1.22, 1.35], 0.22) }
];

const depthGroup = new THREE.Group();
const platform = new THREE.Mesh(new RoundedBoxGeometry(4.5, 0.065, 2.6, 2, 0.07), material("#283e4c", 0.3, 0.4));
depthGroup.add(platform);
const depthBars = [];
const depthGeometry = new THREE.BoxGeometry(0.17, 1, 0.21);
for (const [sideIndex, side] of ["bids", "asks"].entries()) {
    const surface = material(sideIndex === 0 ? "#79cfbc" : "#d68a9d", 0.24, 0.22);
    for (let level = 0; level < 8; level += 1) {
        for (let trail = 0; trail < 6; trail += 1) {
            const bar = new THREE.Mesh(depthGeometry, surface);
            bar.position.set((sideIndex === 0 ? -1 : 1) * (0.2 + level * 0.23), 0.5, -0.94 + trail * 0.35);
            depthGroup.add(bar);
            depthBars.push({ bar, side, level, trail });
        }
    }
}
const depthCaption = canvasTexture(1200, 220, (context) => {
    roundedRectangle(context, 0, 0, 1200, 220, 26, "#152c3dec", "#8aabbc66");
    text(context, "CL DEMO / 3D MARKET DEPTH", 600, 66, 31, "#e1edf3", 600, "center");
    text(context, "BID QUANTITY", 260, 119, 24, mint, 500, "center");
    text(context, "ASK QUANTITY", 940, 119, 24, rose, 500, "center");
    text(context, "ILLUSTRATIVE VISUAL CONCEPT / NOT AN IMPLEMENTED NATIVE FEATURE", 600, 178, 20, "#a2bac7", 400, "center");
});
const captionPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.825), new THREE.MeshBasicMaterial({ map: depthCaption.texture, transparent: true, toneMapped: false }));
captionPlane.position.set(0, -0.45, 1.27);
depthGroup.add(captionPlane);
depthGroup.position.set(0, 1.55, 1.3);
scene.add(depthGroup);

const focusRing = new THREE.Mesh(new THREE.RingGeometry(0.065, 0.083, 48), new THREE.MeshBasicMaterial({ color: "#e5fff8", transparent: true, opacity: 0.9, depthTest: false }));
focusRing.renderOrder = 100;
scene.add(focusRing);

const cameraPoses = [
    { start: [1.6, 3.25, 10.5], end: [-0.35, 3.05, 8.25], target: [0, 2.65, -1.4] },
    { start: [0.3, 2.95, 6.6], end: [-0.45, 2.85, 5.8], target: [0, 2.7, -2.1] },
    { start: [-2.5, 3.25, 8.7], end: [-1.2, 3.15, 8.6], target: [0, 2.5, -0.9] },
    { start: [2.1, 3.05, 7.1], end: [2.7, 2.9, 5.9], target: [1.45, 2.55, -0.45] },
    { start: [2.0, 3.95, 7.0], end: [-0.25, 3.9, 6.7], target: [0, 1.95, 0.9] },
    { start: [0.35, 2.95, 6.6], end: [0.05, 2.9, 5.95], target: [0, 2.7, -1.8] },
    { start: [-0.9, 3.15, 8.4], end: [1.4, 3.4, 10.5], target: [0, 2.5, -0.9] }
];

function placeCamera(section, progress) {
    const pose = cameraPoses[section.index];
    const previous = cameraPoses[Math.max(0, section.index - 1)];
    const transition = smooth(progress / 0.27);
    const travel = smooth((progress - 0.27) / 0.73);
    const position = section.index > 0 && progress < 0.27 ? interpolate(previous.end, pose.start, transition) : interpolate(pose.start, pose.end, section.index === 0 ? smooth(progress) : travel);
    const lookAt = section.index > 0 ? interpolate(previous.target, pose.target, transition) : pose.target;
    camera.position.set(...position);
    target.set(...lookAt);
    camera.lookAt(target);
}

function sectionEnvelope(seconds, identifier) {
    const section = timeline.sections.find((candidate) => candidate.id === identifier);
    return smooth((seconds - section.start) / 2.1) * (1 - smooth((seconds - section.end + 0.1) / 2.1));
}

function drawHeader(state, seconds) {
    const shade = graphics.createLinearGradient(0, 0, 0, 315);
    shade.addColorStop(0, "rgba(5,16,27,0.85)");
    shade.addColorStop(0.7, "rgba(5,16,27,0.43)");
    shade.addColorStop(1, "rgba(5,16,27,0)");
    graphics.fillStyle = shade;
    graphics.fillRect(0, 0, width, 315);
    graphics.strokeStyle = mint;
    graphics.lineWidth = 1.5;
    graphics.beginPath();
    graphics.arc(70, 51, 16, 0, Math.PI * 2);
    graphics.ellipse(70, 51, 7, 16, 0, 0, Math.PI * 2);
    graphics.moveTo(54, 51);
    graphics.lineTo(86, 51);
    graphics.stroke();
    text(graphics, "CME-STYLE  /  SPATIAL MARKET CENTER", 106, 58, 18, "#d5e7ee", 500);
    text(graphics, "3D CONCEPT  /  WINDOWS RENDER", 1860, 48, 17, "#d5e7ee", 600, "right");
    text(graphics, "NOT HEADSET OR SIMULATOR FOOTAGE", 1860, 73, 13, "#b6cbd6", 400, "right");
    const titleOpacity = state.section.index === 0 ? smooth(seconds / 1.2) : smooth((seconds - state.section.start) / 0.55);
    graphics.save();
    graphics.globalAlpha = titleOpacity;
    text(graphics, `${String(state.section.index + 1).padStart(2, "0")}  /  ${state.section.label}`, 61, 121, 16, mint, 600);
    text(graphics, state.section.title, 58, 181, 47, "#f0f6f9", 400);
    text(graphics, state.section.detail, 62, 219, 20, "#c6d9e3", 400);
    graphics.restore();
}

function wrappedLines(value, maximumWidth) {
    const lines = [];
    let line = "";
    for (const word of value.split(" ")) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && graphics.measureText(candidate).width > maximumWidth) {
            lines.push(line);
            line = word;
        } else line = candidate;
    }
    if (line) lines.push(line);
    return lines;
}

function drawFooter(state, seconds) {
    const shade = graphics.createLinearGradient(0, height - 235, 0, height);
    shade.addColorStop(0, "rgba(5,16,27,0)");
    shade.addColorStop(1, "rgba(5,16,27,0.86)");
    graphics.fillStyle = shade;
    graphics.fillRect(0, height - 235, width, 235);
    if (state.cue) {
        graphics.font = '500 28px "Segoe UI", sans-serif';
        const lines = wrappedLines(state.cue.text, 1220);
        if (lines.length > 2) throw new Error("A subtitle exceeds the two-line safe area.");
        const captionWidth = Math.min(1320, Math.max(650, Math.max(...lines.map((line) => graphics.measureText(line).width)) + 74));
        const captionHeight = lines.length * 37 + 34;
        const captionTop = height - 87 - captionHeight;
        roundedRectangle(graphics, (width - captionWidth) / 2, captionTop, captionWidth, captionHeight, 17, "rgba(6,19,31,0.89)", "#a1c6d135");
        lines.forEach((line, index) => text(graphics, line, width / 2, captionTop + 42 + index * 37, 28, "#f1f7fa", 500, "center"));
    }
    text(graphics, "LOCAL SYNTHETIC DATA", 60, height - 42, 14, mint, 600);
    text(graphics, "NO CME CONNECTION  /  NO ORDERS", width - 60, height - 42, 14, "#cadde6", 500, "right");
    graphics.fillStyle = "#b2d1dc35";
    graphics.fillRect(60, height - 19, width - 120, 2);
    graphics.fillStyle = mint;
    graphics.fillRect(60, height - 19, (width - 120) * seconds / timeline.duration, 2);
}

function renderFrame(seconds) {
    const state = stateAt(timeline, seconds);
    const paused = state.section.id === "safety";
    const pauseTime = timeline.sections.find((section) => section.id === "safety").start;
    const snapshotIndex = Math.min(snapshots.length - 1, Math.floor((paused ? pauseTime : seconds) / 1.5));
    const snapshot = snapshots[snapshotIndex];
    if (snapshotIndex !== lastSnapshot || paused !== renderFrame.wasPaused) {
        for (const surface of marketPanels) chartSurface(surface, snapshot.markets.find((market) => market.symbol === surface.symbol), snapshot, paused);
        lastSnapshot = snapshotIndex;
        renderFrame.wasPaused = paused;
    }
    const dashboardMode = paused ? "paused" : ["focus", "depth"].includes(state.section.id) ? "energy" : "desk";
    if (dashboardMode !== lastDashboard) {
        dashboardSurface(dashboardMode);
        lastDashboard = dashboardMode;
    }
    placeCamera(state.section, state.progress);
    const reveal = smooth((seconds - 1.5) / 5);
    mainPanel.group.position.y = mainPanel.basePosition[1] + Math.sin(seconds * 0.45) * 0.025;
    mainPanel.group.scale.setScalar(0.94 + 0.06 * smooth(seconds / 3));
    const focus = sectionEnvelope(seconds, "focus");
    marketPanels.forEach((surface, index) => {
        const direction = surface.basePosition[0] < 0 ? -1 : 1;
        const position = [...surface.basePosition];
        position[0] += direction * (1 - reveal) * 2.6;
        position[1] += Math.sin(seconds * 0.48 + index * 1.6) * 0.035;
        if (surface.symbol === "CL") {
            const focused = interpolate(position, [2.05, 2.8, 1.35], focus);
            surface.group.position.set(...focused);
            surface.group.rotation.y = THREE.MathUtils.lerp(surface.yaw, -0.03, focus);
        } else surface.group.position.set(...position);
        surface.group.scale.setScalar(0.88 + reveal * 0.12);
    });
    const depth = sectionEnvelope(seconds, "depth");
    depthGroup.visible = depth > 0.001;
    depthGroup.scale.setScalar(0.65 + depth * 0.35);
    depthGroup.position.y = 0.1 + depth * 1.45;
    depthGroup.rotation.y = Math.sin(seconds * 0.12) * 0.12;
    const crude = snapshot.markets.find((market) => market.symbol === "CL");
    const maximumQuantity = Math.max(...[...crude.book.bids, ...crude.book.asks].map((level) => level.size));
    for (const item of depthBars) {
        const quantity = crude.book[item.side][item.level].size;
        const modulation = 0.7 + Math.sin(item.level * 0.7 + item.trail * 0.8 + snapshotIndex * 0.21) * 0.2;
        const barHeight = (0.12 + quantity / maximumQuantity * modulation * 1.25) * depth;
        item.bar.scale.y = Math.max(0.001, barHeight);
        item.bar.position.y = barHeight / 2 + 0.035;
    }
    const energy = marketPanels.find((surface) => surface.symbol === "CL");
    energy.group.updateMatrixWorld();
    focusRing.visible = state.section.id === "focus" && state.progress > 0.15 && state.progress < 0.8;
    focusRing.position.copy(energy.group.localToWorld(new THREE.Vector3(-0.64 + Math.sin(state.progress * Math.PI) * 0.45, -0.05, 0.065)));
    focusRing.quaternion.copy(energy.group.quaternion);
    focusRing.scale.setScalar(1 + Math.sin(seconds * 3.6) * 0.12);
    renderer.render(scene, camera);
    graphics.drawImage(renderer.domElement, 0, 0);
    const vignette = graphics.createRadialGradient(width / 2, height / 2, height * 0.22, width / 2, height / 2, width * 0.66);
    vignette.addColorStop(0, "rgba(3,11,20,0)");
    vignette.addColorStop(1, "rgba(3,11,20,0.28)");
    graphics.fillStyle = vignette;
    graphics.fillRect(0, 0, width, height);
    drawHeader(state, seconds);
    drawFooter(state, seconds);
    const fade = 1 - Math.min(smooth(seconds / 0.6), 1 - smooth((seconds - timeline.duration + 0.9) / 0.9));
    if (fade > 0) {
        graphics.fillStyle = `rgba(5,14,24,${fade})`;
        graphics.fillRect(0, 0, width, height);
    }
    return { section: state.section.id, subtitle: state.cue?.text ?? null, time: seconds, triangles: renderer.info.render.triangles };
}

window.spatialFilm = {
    async configure(configuration) {
        timeline = configuration.timeline;
        dashboardImages = Object.fromEntries(await Promise.all(Object.entries(configuration.dashboardImages).map(async ([name, source]) => {
            const image = new Image();
            image.src = source;
            await image.decode();
            return [name, image];
        })));
        const engine = new SyntheticMarket({ seed: filmSettings.seed, timestamp: Date.parse(filmSettings.fixtureTime) });
        snapshots = [engine.snapshot()];
        for (let tick = 1; tick <= Math.ceil(timeline.duration / 1.5); tick += 1) snapshots.push(engine.advance(Date.parse(filmSettings.fixtureTime) + tick * 1500));
        document.getElementById("loading").hidden = true;
        renderFrame(0);
        return { renderer: renderer.getContext().getParameter(renderer.getContext().RENDERER), width, height };
    },
    render: renderFrame,
    capture(seconds) {
        renderFrame(seconds);
        return film.toDataURL("image/jpeg", 0.95).split(",")[1];
    }
};
