import { DEMO_CONTRACTS, DEMO_SOURCE } from "./contracts.js";

const MINUTE = 60_000;
const HISTORY_LIMIT = 240;
const DEPTH_LEVELS = 8;

function randomGenerator(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = Math.imul(state ^ (state >>> 15), 1 | state);
        value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function priceFromTicks(contract, ticks) {
    return Number((ticks * contract.increment).toFixed(contract.precision));
}

function buildBook(state, random) {
    const spread = random() > 0.6 ? 2 : 1;
    const bestBid = Math.max(1, state.lastTicks - 1);
    const makeSide = (direction, firstPrice) => Array.from({ length: DEPTH_LEVELS }, (unused, level) => ({
        ticks: firstPrice + direction * level,
        size: 12 + Math.floor(random() * 260) + level * 18
    }));
    return { bids: makeSide(-1, bestBid), asks: makeSide(1, bestBid + spread) };
}

function initialState(contract, timestamp, random) {
    const initialTicks = Math.round(contract.initialPrice / contract.increment);
    let previousTicks = initialTicks;
    const currentMinute = Math.floor(timestamp / MINUTE) * MINUTE;
    const bars = Array.from({ length: HISTORY_LIMIT }, (unused, index) => {
        const open = previousTicks;
        const close = open + Math.round((random() - 0.49) * contract.movement);
        const upperWick = 1 + Math.floor(random() * contract.movement / 2);
        const lowerWick = 1 + Math.floor(random() * contract.movement / 2);
        previousTicks = close;
        return {
            time: currentMinute - (HISTORY_LIMIT - index - 1) * MINUTE,
            open, close,
            high: Math.max(open, close) + upperWick,
            low: Math.min(open, close) - lowerWick,
            volume: Math.round(contract.barVolume * (0.4 + random() * 1.4))
        };
    });
    const correction = initialTicks - bars.at(-1).close;
    for (const bar of bars) {
        for (const field of ["open", "high", "low", "close"]) bar[field] += correction;
    }
    const state = {
        contract,
        lastTicks: initialTicks,
        highTicks: Math.max(...bars.map((bar) => bar.high)),
        lowTicks: Math.min(...bars.map((bar) => bar.low)),
        volume: bars.reduce((total, bar) => total + bar.volume, 0),
        bars,
        trades: bars.slice(-8).reverse().map((bar, index) => ({
            id: `${contract.symbol}-seed-${index}`,
            time: index === 0 ? timestamp : bar.time + MINUTE - 1,
            ticks: bar.close,
            size: 1 + Math.floor(random() * 42),
            side: bar.close >= bar.open ? "buy" : "sell"
        }))
    };
    state.book = buildBook(state, random);
    return state;
}

export class SyntheticMarket {
    constructor({ seed = 20260909, timestamp = Date.now() } = {}) {
        if (!Number.isInteger(seed) || !Number.isFinite(timestamp) || timestamp < HISTORY_LIMIT * MINUTE) {
            throw new RangeError("A valid seed and timestamp are required.");
        }
        this.random = randomGenerator(seed);
        this.timestamp = timestamp;
        this.sequence = 0;
        this.states = DEMO_CONTRACTS.map((contract) => initialState(contract, timestamp, this.random));
    }

    advance(timestamp) {
        if (!Number.isFinite(timestamp) || timestamp <= this.timestamp) {
            throw new RangeError("Synthetic event time must advance.");
        }
        this.timestamp = timestamp;
        this.sequence += 1;
        for (const state of this.states) {
            const change = Math.round((this.random() - 0.48) * Math.max(2, state.contract.movement / 2));
            const previousTicks = state.lastTicks;
            state.lastTicks = Math.max(DEPTH_LEVELS + 2, previousTicks + change);
            const size = 1 + Math.floor(this.random() * 70);
            const minute = Math.floor(timestamp / MINUTE) * MINUTE;
            let currentBar = state.bars.at(-1);
            if (minute > currentBar.time) {
                currentBar = { time: minute, open: previousTicks, high: previousTicks, low: previousTicks, close: previousTicks, volume: 0 };
                state.bars.push(currentBar);
                if (state.bars.length > HISTORY_LIMIT) state.bars.shift();
            }
            currentBar.close = state.lastTicks;
            currentBar.high = Math.max(currentBar.high, state.lastTicks);
            currentBar.low = Math.min(currentBar.low, state.lastTicks);
            currentBar.volume += size;
            state.highTicks = Math.max(state.highTicks, state.lastTicks);
            state.lowTicks = Math.min(state.lowTicks, state.lastTicks);
            state.volume += size;
            state.trades.unshift({
                id: `${state.contract.symbol}-${this.sequence}`,
                time: timestamp,
                ticks: state.lastTicks,
                size,
                side: change > 0 ? "buy" : change < 0 ? "sell" : this.random() > 0.5 ? "buy" : "sell"
            });
            state.trades.length = Math.min(12, state.trades.length);
            state.book = buildBook(state, this.random);
        }
        return this.snapshot();
    }

    snapshot() {
        return {
            source: DEMO_SOURCE,
            mode: "synthetic",
            generatedAt: this.timestamp,
            sequence: this.sequence,
            markets: this.states.map((state) => {
                const convert = (ticks) => priceFromTicks(state.contract, ticks);
                const price = convert(state.lastTicks);
                return {
                    ...state.contract,
                    price,
                    change: Number((price - state.contract.referencePrice).toFixed(state.contract.precision)),
                    changePercent: (price / state.contract.referencePrice - 1) * 100,
                    high: convert(state.highTicks),
                    low: convert(state.lowTicks),
                    volume: state.volume,
                    bars: state.bars.map((bar) => ({ time: bar.time, open: convert(bar.open), high: convert(bar.high), low: convert(bar.low), close: convert(bar.close), volume: bar.volume })),
                    book: Object.fromEntries(Object.entries(state.book).map(([side, levels]) => [side, levels.map((level) => ({ price: convert(level.ticks), size: level.size }))])),
                    trades: state.trades.map((trade) => ({ id: trade.id, time: trade.time, price: convert(trade.ticks), size: trade.size, side: trade.side }))
                };
            })
        };
    }
}

export function aggregateBars(bars, rangeMinutes) {
    if (![15, 60, 240].includes(rangeMinutes)) throw new RangeError("Unsupported chart range.");
    if (bars.length === 0) return [];
    const cutoff = bars.at(-1).time - (rangeMinutes - 1) * MINUTE;
    const interval = (rangeMinutes === 240 ? 4 : 1) * MINUTE;
    const result = [];
    for (const bar of bars.filter((candidate) => candidate.time >= cutoff)) {
        const bucket = Math.floor(bar.time / interval) * interval;
        const previous = result.at(-1);
        if (previous && previous.time === bucket) {
            previous.high = Math.max(previous.high, bar.high);
            previous.low = Math.min(previous.low, bar.low);
            previous.close = bar.close;
            previous.volume += bar.volume;
        } else {
            result.push({ ...bar, time: bucket });
        }
    }
    return result;
}

export function feedFreshness(mode, generatedAt, now) {
    if (!Number.isFinite(generatedAt) || !Number.isFinite(now) || generatedAt > now) return "Unavailable";
    if (mode === "disconnected") return "Stale snapshot";
    if (mode === "paused") return "Paused snapshot";
    if (mode !== "streaming") return "Unavailable";
    return now - generatedAt > 5000 ? "Stale snapshot" : "Fresh synthetic data";
}
