import { createMarketDashboard } from "./market/dashboard.js";
import { createPaperWorkspace } from "./market/paper-trading.js";
import { createSpatialDesk } from "./spatial/desk.js";

const pageNames = new Map([
    ["markets", "Market desk"],
    ["paper", "Paper trading"],
    ["portfolio", "Portfolio & risk"],
    ["overview", "Overview"],
    ["workspace", "Spatial workspace"],
    ["settings", "Settings"]
]);
const announcements = document.querySelector("#announcements");
const floatingWindows = new Map([
    ["companion", document.querySelector("#window-companion")],
    ["spatial", document.querySelector("#window-spatial")],
    ["chart", document.querySelector("#window-chart")]
]);
const windowNames = new Map([["companion", "Companion window"], ["spatial", "Spatial preview"], ["chart", "Chart screen"]]);
const windowTriggers = new Map();
let frontmostOrder = 10;
let spatialDesk;

function announce(message) {
    announcements.textContent = message;
}

function showPage(pageName) {
    const selectedPage = pageNames.has(pageName) ? pageName : "markets";
    for (const navigationItem of document.querySelectorAll("[data-page]")) {
        const isSelected = navigationItem.dataset.page === selectedPage;
        navigationItem.classList.toggle("active", isSelected);
        if (isSelected) {
            navigationItem.setAttribute("aria-current", "page");
        } else {
            navigationItem.removeAttribute("aria-current");
        }
    }
    for (const page of document.querySelectorAll(".page")) {
        page.hidden = page.id !== `page-${selectedPage}`;
    }
    document.querySelector("#page-heading").textContent = pageNames.get(selectedPage);
    document.querySelector(".content-scroll").scrollTop = 0;
    spatialDesk?.onPageChange(selectedPage);
}

function positionWindow(floatingWindow, left, top) {
    if (spatialDesk?.isActive()) return;
    const bounds = floatingWindow.getBoundingClientRect();
    const maximumLeft = Math.max(12, window.innerWidth - bounds.width - 12);
    const maximumTop = Math.max(12, window.innerHeight - bounds.height - 12);
    floatingWindow.style.left = `${Math.max(12, Math.min(left, maximumLeft))}px`;
    floatingWindow.style.top = `${Math.max(12, Math.min(top, maximumTop))}px`;
}

function bringForward(floatingWindow) {
    floatingWindow.style.zIndex = String(++frontmostOrder);
}

function openWindow(windowName, trigger) {
    const floatingWindow = floatingWindows.get(windowName);
    if (!floatingWindow) return;
    windowTriggers.set(windowName, trigger);
    const wasHidden = floatingWindow.hidden;
    floatingWindow.hidden = false;
    if (wasHidden) {
        const initialLeft = window.innerWidth * (windowName === "companion" ? 0.7 : windowName === "chart" ? 0.32 : 0.08);
        positionWindow(floatingWindow, initialLeft, window.innerHeight * 0.24);
    }
    bringForward(floatingWindow);
    floatingWindow.querySelector(".drag-handle").focus({ preventScroll: true });
    spatialDesk?.onWindowOpen(windowName);
    announce(`${windowNames.get(windowName)} opened.`);
}

function closeWindow(windowName, restoreFocus = true) {
    const floatingWindow = floatingWindows.get(windowName);
    if (!floatingWindow || floatingWindow.hidden) return;
    floatingWindow.hidden = true;
    spatialDesk?.onWindowClose(windowName);
    const trigger = windowTriggers.get(windowName);
    if (restoreFocus && trigger && trigger.getClientRects().length > 0) {
        trigger.focus({ preventScroll: true });
    } else if (restoreFocus) {
        document.querySelector(".navigation-item.active").focus();
    }
    announce(`${windowNames.get(windowName)} closed.`);
}

for (const navigationItem of document.querySelectorAll("[data-page]")) {
    navigationItem.addEventListener("click", () => showPage(navigationItem.dataset.page));
}
document.querySelector(".preview-brand").addEventListener("click", (event) => {
    event.preventDefault();
    showPage("markets");
    document.querySelector('[data-page="markets"]').focus();
});

for (const trigger of document.querySelectorAll("[data-open]")) {
    trigger.addEventListener("click", () => openWindow(trigger.dataset.open, trigger));
}
for (const closeButton of document.querySelectorAll("[data-close]")) {
    closeButton.addEventListener("click", () => closeWindow(closeButton.dataset.close));
}

for (const floatingWindow of floatingWindows.values()) {
    const handle = floatingWindow.querySelector(".drag-handle");
    let dragState;

    floatingWindow.addEventListener("pointerdown", () => bringForward(floatingWindow));
    handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const bounds = floatingWindow.getBoundingClientRect();
        dragState = { pointerId: event.pointerId, offsetLeft: event.clientX - bounds.left, offsetTop: event.clientY - bounds.top };
        handle.setPointerCapture(event.pointerId);
        handle.focus({ preventScroll: true });
    });
    handle.addEventListener("pointermove", (event) => {
        if (!dragState || event.pointerId !== dragState.pointerId) return;
        positionWindow(floatingWindow, event.clientX - dragState.offsetLeft, event.clientY - dragState.offsetTop);
    });
    handle.addEventListener("lostpointercapture", () => { dragState = undefined; });
    handle.addEventListener("pointerup", () => { dragState = undefined; });
    handle.addEventListener("pointercancel", () => { dragState = undefined; });
    handle.addEventListener("keydown", (event) => {
        const movement = new Map([["ArrowLeft", [-1, 0]], ["ArrowRight", [1, 0]], ["ArrowUp", [0, -1]], ["ArrowDown", [0, 1]]]).get(event.key);
        if (!movement) return;
        event.preventDefault();
        const distance = event.shiftKey ? 40 : 10;
        const bounds = floatingWindow.getBoundingClientRect();
        positionWindow(floatingWindow, bounds.left + movement[0] * distance, bounds.top + movement[1] * distance);
    });
}

document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (document.querySelector("dialog[open]")) return;
    if (spatialDesk?.isActive()) {
        event.preventDefault();
        spatialDesk.exit();
        return;
    }
    const visibleWindows = [...floatingWindows.entries()].filter(([, floatingWindow]) => !floatingWindow.hidden);
    visibleWindows.sort((first, second) => Number(second[1].style.zIndex) - Number(first[1].style.zIndex));
    if (visibleWindows.length > 0) closeWindow(visibleWindows[0][0]);
});

window.addEventListener("resize", () => {
    if (spatialDesk?.isActive()) return;
    for (const floatingWindow of floatingWindows.values()) {
        if (floatingWindow.hidden) continue;
        const bounds = floatingWindow.getBoundingClientRect();
        positionWindow(floatingWindow, bounds.left, bounds.top);
    }
});

const viewingAngle = document.querySelector("#viewing-angle");
viewingAngle.addEventListener("input", () => {
    document.querySelector(".model-layout").style.setProperty("--model-angle", `${viewingAngle.value}deg`);
    document.querySelector("#angle-value").textContent = `${viewingAngle.value}°`;
});

const paperWorkspace = createPaperWorkspace({ announce, showPage });
const marketDashboard = createMarketDashboard(announce, {
    sessionOnly: document.documentElement.dataset.host === "visionos",
    onStateChange: paperWorkspace.updateMarket,
    beforeRestart: paperWorkspace.requestMarketRestart
});
document.querySelector("#paper-trade-selected").addEventListener("click", () => paperWorkspace.openOrder(marketDashboard.selectedContract()));

spatialDesk = createSpatialDesk({ announce, showPage, openWindow, floatingWindows });

document.querySelector("#reset-layout").addEventListener("click", () => {
    spatialDesk.exit({ restoreFocus: false });
    marketDashboard.cancelStatusRefresh();
    for (const windowName of floatingWindows.keys()) closeWindow(windowName, false);
    viewingAngle.value = "-24";
    viewingAngle.dispatchEvent(new Event("input"));
    showPage("markets");
    announce("Workspace layout reset.");
});

document.documentElement.dataset.dashboardReady = "true";
if (new URL(window.location.href).searchParams.get("demo") === "3d") spatialDesk.enter();
