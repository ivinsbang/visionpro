import { aggregateBars } from "./simulator.js";

const priceFormatters = new Map();
const quantityFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const clockFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

export function formatPrice(market, value = market.price) {
    if (!priceFormatters.has(market.precision)) {
        priceFormatters.set(market.precision, new Intl.NumberFormat("en-US", { minimumFractionDigits: market.precision, maximumFractionDigits: market.precision }));
    }
    return priceFormatters.get(market.precision).format(value);
}

export function formatQuantity(value) {
    return quantityFormatter.format(value);
}

export function formatTime(timestamp, seconds = true) {
    const formatted = clockFormatter.format(new Date(timestamp));
    return seconds ? formatted : formatted.slice(0, 5);
}

export function sparkline(bars, width = 110, height = 35) {
    const prices = bars.slice(-40).map((bar) => bar.close);
    const minimum = Math.min(...prices);
    const span = Math.max(...prices) - minimum || 1;
    const points = prices.map((price, index) => `${(index / Math.max(1, prices.length - 1) * width).toFixed(1)},${(height - 4 - (price - minimum) / span * (height - 8)).toFixed(1)}`).join(" ");
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
}

export class PriceChart {
    constructor(root, readout, identifier, announce) {
        this.root = root;
        this.readout = readout;
        this.identifier = identifier;
        this.announce = announce;
        this.selectionTime = null;
        this.bars = [];
        this.root.addEventListener("pointermove", (event) => {
            if (this.bars.length === 0) return;
            const position = event.clientX - this.root.getBoundingClientRect().left;
            const nearest = this.bars.reduce((best, bar) => Math.abs(this.horizontalPosition(bar.time) - position) < Math.abs(this.horizontalPosition(best.time) - position) ? bar : best);
            if (this.selectionTime === nearest.time) return;
            this.selectionTime = nearest.time;
            this.draw();
        });
        this.root.addEventListener("pointerleave", () => {
            if (document.activeElement !== this.root) {
                this.selectionTime = null;
                this.draw();
            }
        });
        this.root.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && this.selectionTime !== null) {
                event.stopPropagation();
                this.selectionTime = null;
                this.draw();
                return;
            }
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || this.bars.length === 0) return;
            event.preventDefault();
            let index = this.bars.findIndex((bar) => bar.time === this.selectionTime);
            if (index < 0) index = this.bars.length - 1;
            if (event.key === "ArrowLeft") index = Math.max(0, index - 1);
            if (event.key === "ArrowRight") index = Math.min(this.bars.length - 1, index + 1);
            if (event.key === "Home") index = 0;
            if (event.key === "End") index = this.bars.length - 1;
            this.selectionTime = this.bars[index].time;
            this.draw();
            this.announce(this.readout.textContent);
        });
        this.observer = new ResizeObserver(() => this.draw());
        this.observer.observe(root);
    }

    update(market, rangeMinutes = 60, mode = "candles") {
        if (this.market?.symbol !== market.symbol || this.rangeMinutes !== rangeMinutes) this.selectionTime = null;
        this.market = market;
        this.rangeMinutes = rangeMinutes;
        this.mode = mode;
        this.bars = aggregateBars(market.bars, rangeMinutes);
        if (!this.bars.some((bar) => bar.time === this.selectionTime)) this.selectionTime = null;
        this.root.setAttribute("aria-label", `${market.symbol} synthetic ${mode === "candles" ? "candlestick" : "area"} chart, last ${rangeMinutes} minutes`);
        this.draw();
    }

    draw() {
        if (!this.market || this.bars.length === 0) return;
        const width = Math.max(280, this.root.clientWidth || 560);
        const height = this.root.clientHeight || 250;
        const right = width - (this.market.precision > 3 ? 76 : 64);
        const priceBottom = height - 63;
        const priceTop = 14;
        const lowest = Math.min(...this.bars.map((bar) => bar.low));
        const highest = Math.max(...this.bars.map((bar) => bar.high));
        const padding = Math.max((highest - lowest) * 0.12, this.market.increment * 3);
        const minimum = lowest - padding;
        const maximum = highest + padding;
        const pricePosition = (price) => priceBottom - (price - minimum) / (maximum - minimum) * (priceBottom - priceTop);
        const lastTime = this.bars.at(-1).time;
        const firstTime = Math.min(this.bars[0].time, lastTime - (this.rangeMinutes - 1) * 60_000);
        const interval = (this.rangeMinutes === 240 ? 4 : 1) * 60_000;
        this.horizontalPosition = (time) => 8 + (time - firstTime + interval / 2) / (lastTime - firstTime + interval) * (right - 12);
        const candleWidth = Math.max(1.5, Math.min(12, (right - 12) * interval / (lastTime - firstTime + interval) * 0.65));
        const maximumVolume = Math.max(...this.bars.map((bar) => bar.volume), 1);
        const grid = Array.from({ length: 5 }, (unused, index) => {
            const price = maximum - index / 4 * (maximum - minimum);
            const vertical = pricePosition(price);
            return `<line x1="4" x2="${right}" y1="${vertical}" y2="${vertical}" class="chart-grid-line"/><text x="${right + 8}" y="${vertical + 3}" class="chart-axis">${formatPrice(this.market, price)}</text>`;
        }).join("");
        const candles = this.bars.map((bar) => {
            const horizontal = this.horizontalPosition(bar.time);
            const positive = bar.close >= bar.open;
            const tone = positive ? "chart-up" : "chart-down";
            const bodyTop = pricePosition(Math.max(bar.open, bar.close));
            const bodyHeight = Math.max(1.5, Math.abs(pricePosition(bar.open) - pricePosition(bar.close)));
            return `<line x1="${horizontal}" x2="${horizontal}" y1="${pricePosition(bar.high)}" y2="${pricePosition(bar.low)}" class="${tone} candle-wick"/><rect x="${horizontal - candleWidth / 2}" y="${bodyTop}" width="${candleWidth}" height="${bodyHeight}" rx="0.6" class="${tone} candle-body"/>`;
        }).join("");
        const line = this.bars.map((bar, index) => `${index === 0 ? "M" : "L"}${this.horizontalPosition(bar.time)},${pricePosition(bar.close)}`).join(" ");
        const area = `${line} L${this.horizontalPosition(lastTime)},${priceBottom} L${this.horizontalPosition(this.bars[0].time)},${priceBottom} Z`;
        const volumes = this.bars.map((bar) => {
            const barHeight = Math.max(1, bar.volume / maximumVolume * 28);
            return `<rect x="${this.horizontalPosition(bar.time) - candleWidth / 2}" y="${height - 22 - barHeight}" width="${candleWidth}" height="${barHeight}" class="${bar.close >= bar.open ? "chart-up" : "chart-down"} volume-bar"/>`;
        }).join("");
        const labels = [0, 0.5, 1].map((fraction) => {
            const timestamp = firstTime + fraction * (lastTime - firstTime);
            return `<text x="${this.horizontalPosition(timestamp)}" y="${height - 5}" text-anchor="${fraction === 0 ? "start" : fraction === 1 ? "end" : "middle"}" class="chart-axis">${formatTime(timestamp, false)}</text>`;
        }).join("");
        const lastPricePosition = pricePosition(this.market.price);
        const selected = this.bars.find((bar) => bar.time === this.selectionTime);
        const inspection = selected ? `<line x1="${this.horizontalPosition(selected.time)}" x2="${this.horizontalPosition(selected.time)}" y1="${priceTop}" y2="${height - 20}" class="chart-crosshair"/><circle cx="${this.horizontalPosition(selected.time)}" cy="${pricePosition(selected.close)}" r="3.5" class="chart-marker"/>` : "";
        this.root.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${this.market.symbol} generated price history and synthetic volume"><defs><linearGradient id="fill-${this.identifier}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#79ddd0" stop-opacity="0.24"/><stop offset="100%" stop-color="#79ddd0" stop-opacity="0"/></linearGradient></defs>${grid}<text x="${right / 2}" y="${priceBottom / 2}" text-anchor="middle" class="chart-watermark">${this.market.symbol} · DEMO</text>${this.mode === "candles" ? candles : `<path d="${area}" fill="url(#fill-${this.identifier})"/><path d="${line}" class="price-area-line"/>`}<line x1="4" x2="${right}" y1="${lastPricePosition}" y2="${lastPricePosition}" class="last-price-line"/><rect x="${right + 2}" y="${lastPricePosition - 9}" width="${width - right - 3}" height="18" rx="3" class="last-price-label"/><text x="${right + 7}" y="${lastPricePosition + 3}" class="last-price-text">${formatPrice(this.market)}</text>${volumes}${labels}${inspection}</svg>`;
        const inspectedBar = selected || this.bars.at(-1);
        this.readout.textContent = `${formatTime(inspectedBar.time, false)} UTC   O ${formatPrice(this.market, inspectedBar.open)}   H ${formatPrice(this.market, inspectedBar.high)}   L ${formatPrice(this.market, inspectedBar.low)}   C ${formatPrice(this.market, inspectedBar.close)}`;
        this.root.dataset.inspectedTime = selected ? String(selected.time) : "";
    }
}
