import { arrangeWindows, clampNumber, FEATURE_TOUR, frameCamera, moveWindow, windowDimensions, WINDOW_NAMES } from "./desk-layout.js";

export function createSpatialDesk({ announce, showPage, openWindow, floatingWindows }) {
    const room = document.querySelector("#spatial-desk");
    const viewport = document.querySelector("#spatial-viewport");
    const world = document.querySelector("#spatial-world");
    const deskFrame = document.querySelector("#spatial-main-frame");
    const appWindow = document.querySelector(".app-window");
    const enterButton = document.querySelector("#enter-spatial-desk");
    const featureSelect = document.querySelector("#spatial-feature");
    const focusSelect = document.querySelector("#spatial-focus");
    const zoomControl = document.querySelector("#spatial-zoom");
    const orbitControl = document.querySelector("#spatial-orbit");
    const tiltControl = document.querySelector("#spatial-tilt");
    const tourPanel = document.querySelector("#spatial-tour-panel");
    const windows = new Map([["desk", deskFrame], ...floatingWindows]);
    const origins = new Map();
    const savedWindows = new Map();
    let enabled = false;
    let arranging = false;
    let dimensions;
    let positions;
    let camera;
    let view = "overview";
    let selectedPage = "markets";
    let tourIndex = -1;
    let highlighted;
    let returnFocus;

    function visibleWindows() {
        return [...windows].filter(([, element]) => !element.hidden).map(([key]) => key);
    }

    function draw({ retainCamera = false } = {}) {
        if (!enabled) return;
        if (!retainCamera || !camera) camera = frameCamera({
            view, positions, dimensions, visible: visibleWindows(),
            width: viewport.clientWidth, height: viewport.clientHeight,
            zoom: zoomControl.value, orbit: orbitControl.value, tilt: tiltControl.value
        });
        world.style.setProperty("--camera-scale", camera.scale);
        world.style.setProperty("--camera-yaw", `${camera.yaw}deg`);
        world.style.setProperty("--camera-pitch", `${camera.pitch}deg`);
        world.style.setProperty("--camera-horizontal", `${-camera.horizontal}px`);
        world.style.setProperty("--camera-vertical", `${-camera.vertical}px`);
        world.style.setProperty("--camera-depth", `${-camera.depth}px`);
        for (const [key, element] of windows) {
            const position = positions[key];
            element.style.setProperty("--panel-width", `${dimensions[key].width}px`);
            element.style.setProperty("--panel-height", `${dimensions[key].height}px`);
            element.style.setProperty("--panel-horizontal", `${position.horizontal}px`);
            element.style.setProperty("--panel-vertical", `${position.vertical}px`);
            element.style.setProperty("--panel-depth", `${position.depth}px`);
            element.style.setProperty("--panel-rotation", `${position.rotation}deg`);
            element.classList.toggle("spatial-focused", view === key);
        }
        focusSelect.value = view;
        room.dataset.view = view;
        document.querySelector("#spatial-view-label").textContent = view === "overview" ? "Room view · Focus a window for full-size controls" : `${WINDOW_NAMES[view]} · Working app window`;
        document.querySelector("#spatial-zoom-value").textContent = `${zoomControl.value}%`;
    }

    function focusWindow(key, { resetCamera = true, speak = true } = {}) {
        if (!enabled || (key !== "overview" && !windows.has(key))) return;
        if (key !== "overview" && key !== "desk" && windows.get(key).hidden) {
            arranging = true;
            openWindow(key, focusSelect);
            arranging = false;
        }
        view = key;
        if (resetCamera) {
            zoomControl.value = "100";
            orbitControl.value = key === "overview" ? "-6" : "0";
            tiltControl.value = key === "overview" ? "4" : "0";
        }
        draw();
        if (speak) announce(key === "overview" ? "3D room overview. Focus a window to use its controls." : `${WINDOW_NAMES[key]} brought into focus.`);
    }

    function clearHighlight() {
        highlighted?.classList.remove("spatial-tour-highlight");
        highlighted = undefined;
    }

    function stopTour() {
        clearHighlight();
        tourIndex = -1;
        tourPanel.hidden = true;
        document.querySelector("#spatial-start-tour").textContent = "Feature tour";
        resize();
    }

    function showTourStep(index) {
        tourIndex = Math.round(clampNumber(index, 0, FEATURE_TOUR.length - 1));
        const step = FEATURE_TOUR[tourIndex];
        clearHighlight();
        tourPanel.hidden = false;
        document.querySelector("#spatial-tour-title").textContent = step.title;
        document.querySelector("#spatial-tour-detail").textContent = step.detail;
        document.querySelector("#spatial-tour-count").textContent = `${tourIndex + 1} / ${FEATURE_TOUR.length}`;
        document.querySelector("#spatial-tour-previous").disabled = tourIndex === 0;
        document.querySelector("#spatial-tour-next").textContent = tourIndex === FEATURE_TOUR.length - 1 ? "Finish tour" : "Next feature";
        document.querySelector("#spatial-start-tour").textContent = "Restart tour";
        if (step.page) showPage(step.page);
        resize();
        focusWindow(step.view, { speak: false });
        if (step.target) {
            highlighted = document.querySelector(step.target);
            highlighted?.classList.add("spatial-tour-highlight");
            const scroller = document.querySelector(".content-scroll");
            if (highlighted && scroller.contains(highlighted)) {
                let offset = highlighted.offsetTop;
                let parent = highlighted.offsetParent;
                while (parent && parent !== scroller && scroller.contains(parent)) {
                    offset += parent.offsetTop;
                    parent = parent.offsetParent;
                }
                scroller.scrollTop = Math.max(0, offset - 24);
            }
        }
        announce(`Feature ${tourIndex + 1} of ${FEATURE_TOUR.length}. ${step.title} ${step.detail}`);
    }

    function resize() {
        if (!enabled) return;
        dimensions = windowDimensions(viewport.clientWidth, viewport.clientHeight);
        positions ??= arrangeWindows(dimensions);
        draw();
    }

    function enter() {
        if (enabled || document.querySelector("dialog[open]")) return;
        returnFocus = document.activeElement;
        origins.set("desk", document.createTextNode(""));
        appWindow.before(origins.get("desk"));
        deskFrame.append(appWindow);
        for (const [key, element] of floatingWindows) {
            const origin = document.createTextNode("");
            element.before(origin);
            origins.set(key, origin);
            savedWindows.set(key, { hidden: element.hidden, style: element.getAttribute("style") });
            world.append(element);
        }
        enabled = true;
        room.hidden = false;
        document.body.classList.add("spatial-desk-active");
        enterButton.setAttribute("aria-expanded", "true");
        dimensions = windowDimensions(viewport.clientWidth, viewport.clientHeight);
        positions = arrangeWindows(dimensions, document.querySelector("#spatial-arrangement").value);
        arranging = true;
        openWindow("chart", focusSelect);
        openWindow("companion", focusSelect);
        arranging = false;
        featureSelect.value = selectedPage;
        focusWindow(viewport.clientWidth < 760 ? "desk" : "overview");
        document.querySelector("#spatial-focus-desk").focus({ preventScroll: true });
    }

    function exit({ restoreFocus = true } = {}) {
        if (!enabled || document.querySelector("dialog[open]")) return;
        clearHighlight();
        enabled = false;
        tourIndex = -1;
        tourPanel.hidden = true;
        document.querySelector("#spatial-start-tour").textContent = "Feature tour";
        origins.get("desk").replaceWith(appWindow);
        for (const [key, element] of floatingWindows) {
            origins.get(key).replaceWith(element);
            const saved = savedWindows.get(key);
            element.hidden = saved.hidden;
            if (saved.style === null) element.removeAttribute("style");
            else element.style.cssText = saved.style;
            element.classList.remove("spatial-focused");
        }
        origins.clear();
        savedWindows.clear();
        room.hidden = true;
        document.body.classList.remove("spatial-desk-active");
        enterButton.setAttribute("aria-expanded", "false");
        if (restoreFocus) {
            const destination = returnFocus?.isConnected && returnFocus !== document.body && returnFocus !== document.documentElement && returnFocus.getClientRects().length ? returnFocus : enterButton;
            destination.focus({ preventScroll: true });
        }
        announce("Returned to the flat desk. Your market session, watchlist, and paper account are unchanged.");
    }

    for (const [key, element] of windows) {
        const handle = element.querySelector(".drag-handle");
        let drag;
        handle.addEventListener("pointerdown", (event) => {
            if (!enabled || event.button !== 0) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            arranging = true;
            handle.focus({ preventScroll: true });
            arranging = false;
            drag = { pointerId: event.pointerId, horizontal: event.clientX, vertical: event.clientY, position: { ...positions[key] }, scale: camera.scale };
            room.classList.add("spatial-dragging");
            handle.setPointerCapture(event.pointerId);
        }, true);
        handle.addEventListener("pointermove", (event) => {
            if (!enabled || !drag || event.pointerId !== drag.pointerId) return;
            event.stopImmediatePropagation();
            positions[key] = moveWindow(drag.position, (event.clientX - drag.horizontal) / drag.scale, (event.clientY - drag.vertical) / drag.scale);
            draw({ retainCamera: true });
        }, true);
        for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
            handle.addEventListener(eventName, () => {
                drag = undefined;
                room.classList.remove("spatial-dragging");
            });
        }
        handle.addEventListener("keydown", (event) => {
            if (!enabled) return;
            const direction = new Map([["ArrowLeft", [-1, 0]], ["ArrowRight", [1, 0]], ["ArrowUp", [0, -1]], ["ArrowDown", [0, 1]]]).get(event.key);
            if (!direction) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const distance = event.shiftKey ? 80 : 20;
            positions[key] = moveWindow(positions[key], direction[0] * distance, direction[1] * distance);
            draw({ retainCamera: true });
        }, true);
        element.addEventListener("focusin", () => {
            if (enabled && !arranging && view !== key) focusWindow(key, { speak: false });
        });
    }

    enterButton.addEventListener("click", enter);
    document.querySelector("#exit-spatial-desk").addEventListener("click", () => exit());
    document.querySelector("#spatial-focus-desk").addEventListener("click", () => focusWindow("desk"));
    document.querySelector("#spatial-room-view").addEventListener("click", () => focusWindow("overview"));
    focusSelect.addEventListener("change", () => focusWindow(focusSelect.value));
    featureSelect.addEventListener("change", () => {
        stopTour();
        showPage(featureSelect.value);
        focusWindow("desk");
    });
    document.querySelector("#spatial-arrangement").addEventListener("change", () => {
        positions = arrangeWindows(dimensions, document.querySelector("#spatial-arrangement").value);
        focusWindow("overview");
    });
    document.querySelector("#spatial-recenter").addEventListener("click", () => {
        positions = arrangeWindows(dimensions, document.querySelector("#spatial-arrangement").value);
        focusWindow(view);
        announce("3D window positions recentered. Market and paper state are unchanged.");
    });
    for (const control of [zoomControl, orbitControl, tiltControl]) control.addEventListener("input", draw);
    document.querySelector("#spatial-start-tour").addEventListener("click", () => showTourStep(0));
    document.querySelector("#spatial-tour-previous").addEventListener("click", () => showTourStep(tourIndex - 1));
    document.querySelector("#spatial-tour-next").addEventListener("click", () => {
        if (tourIndex === FEATURE_TOUR.length - 1) stopTour();
        else showTourStep(tourIndex + 1);
    });
    document.querySelector("#spatial-tour-close").addEventListener("click", stopTour);
    document.querySelector("#spatial-view-controls").addEventListener("toggle", resize);
    window.addEventListener("resize", resize);

    return {
        isActive: () => enabled,
        enter,
        exit,
        onPageChange(page) {
            selectedPage = page;
            featureSelect.value = page;
            if (enabled && !arranging) focusWindow("desk", { speak: false });
        },
        onWindowOpen(key) {
            if (enabled && !arranging) focusWindow(key, { speak: false });
        },
        onWindowClose(key) {
            if (!enabled) return;
            if (view === key) focusWindow("desk", { speak: false });
            else draw();
        }
    };
}
