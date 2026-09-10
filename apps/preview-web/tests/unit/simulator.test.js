import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_CONTRACTS, DEFAULT_WATCHLIST, normalizeWatchlist } from "../../market/contracts.js";
import { SyntheticMarket, aggregateBars, feedFreshness } from "../../market/simulator.js";

const START = Date.parse("2026-09-09T13:30:20.000Z");

test("the same seed and clock produce identical synthetic histories and events", () => {
    const first = new SyntheticMarket({ timestamp: START, seed: 18 });
    const second = new SyntheticMarket({ timestamp: START, seed: 18 });
    assert.deepEqual(first.snapshot(), second.snapshot());
    assert.deepEqual(first.advance(START + 1500), second.advance(START + 1500));
    assert.notDeepEqual(first.snapshot(), new SyntheticMarket({ timestamp: START, seed: 19 }).snapshot());
    assert.equal(first.snapshot().mode, "synthetic");
    assert.equal(first.snapshot().markets.length, DEMO_CONTRACTS.length);
});

test("prices, OHLC bars, book ordering, volume, and event times stay coherent", () => {
    const engine = new SyntheticMarket({ timestamp: START });
    let previous = engine.snapshot();
    for (let iteration = 1; iteration <= 500; iteration += 1) {
        const snapshot = engine.advance(START + iteration * 1500);
        for (const [index, market] of snapshot.markets.entries()) {
            assert.ok(market.price > 0);
            assert.ok(Math.abs(market.price / market.increment - Math.round(market.price / market.increment)) < 0.000001);
            assert.ok(market.volume > previous.markets[index].volume);
            assert.equal(market.price, market.bars.at(-1).close);
            assert.equal(market.price, market.trades[0].price);
            assert.equal(market.trades[0].time, snapshot.generatedAt);
            assert.ok(market.book.bids[0].price < market.book.asks[0].price);
            assert.ok(market.low <= market.price && market.high >= market.price);
            assert.equal(market.book.bids.length, 8);
            assert.ok(market.trades.length <= 12);
            for (const [side, levels] of Object.entries(market.book)) {
                for (const [levelIndex, level] of levels.entries()) {
                    assert.ok(level.price > 0 && Number.isInteger(level.size) && level.size > 0);
                    if (levelIndex > 0) assert.ok(side === "bids" ? level.price < levels[levelIndex - 1].price : level.price > levels[levelIndex - 1].price);
                }
            }
            for (const [barIndex, bar] of market.bars.entries()) {
                assert.ok(bar.low <= Math.min(bar.open, bar.close));
                assert.ok(bar.high >= Math.max(bar.open, bar.close));
                assert.ok(bar.time <= snapshot.generatedAt);
                if (barIndex > 0) assert.ok(bar.time > market.bars[barIndex - 1].time);
            }
        }
        previous = snapshot;
    }
});

test("a snapshot cannot mutate engine state", () => {
    const engine = new SyntheticMarket({ timestamp: START });
    const original = engine.snapshot();
    const changed = engine.snapshot();
    changed.markets[0].bars[0].close = 0;
    changed.markets[0].book.bids[0].size = 0;
    changed.markets[0].trades[0].price = 0;
    changed.markets.pop();
    assert.deepEqual(engine.snapshot(), original);
});

test("a reconnect after a gap does not fabricate events during the interruption", () => {
    const engine = new SyntheticMarket({ timestamp: START });
    const before = engine.snapshot();
    const after = engine.advance(START + 30 * 60_000);
    assert.equal(after.sequence, 1);
    assert.equal(after.markets[0].bars.length, 240);
    assert.equal(after.markets[0].bars.at(-1).time - after.markets[0].bars.at(-2).time, 30 * 60_000);
    assert.equal(after.markets[0].bars.at(-1).open, before.markets[0].price);
    assert.equal(after.markets[0].volume - before.markets[0].volume, after.markets[0].trades[0].size);
});

test("invalid seeds and non-advancing timestamps are rejected", () => {
    assert.throws(() => new SyntheticMarket({ timestamp: NaN }), RangeError);
    assert.throws(() => new SyntheticMarket({ timestamp: START, seed: 1.5 }), RangeError);
    const engine = new SyntheticMarket({ timestamp: START });
    for (const timestamp of [START, START - 1, Infinity, NaN]) assert.throws(() => engine.advance(timestamp), RangeError);
});

test("chart aggregation preserves open, high, low, close, and total volume", () => {
    const bars = new SyntheticMarket({ timestamp: START }).snapshot().markets[0].bars;
    const result = aggregateBars(bars, 240);
    assert.ok(result.length >= 60 && result.length <= 61);
    assert.equal(result[0].open, bars[0].open);
    assert.equal(result.at(-1).close, bars.at(-1).close);
    assert.equal(Math.max(...result.map((bar) => bar.high)), Math.max(...bars.map((bar) => bar.high)));
    assert.equal(Math.min(...result.map((bar) => bar.low)), Math.min(...bars.map((bar) => bar.low)));
    assert.equal(result.reduce((total, bar) => total + bar.volume, 0), bars.reduce((total, bar) => total + bar.volume, 0));
    assert.equal(aggregateBars(bars, 15).length, 15);
    assert.equal(aggregateBars(bars, 60).length, 60);
    assert.deepEqual(aggregateBars([], 15), []);
    assert.throws(() => aggregateBars(bars, 30), RangeError);
});

test("freshness distinguishes streaming, paused, missing, future, and interrupted data", () => {
    assert.equal(feedFreshness("streaming", START, START + 2000), "Fresh synthetic data");
    assert.equal(feedFreshness("streaming", START, START + 6000), "Stale snapshot");
    assert.equal(feedFreshness("paused", START, START + 2000), "Paused snapshot");
    assert.equal(feedFreshness("disconnected", START, START), "Stale snapshot");
    assert.equal(feedFreshness("streaming", START + 1, START), "Unavailable");
    assert.equal(feedFreshness("streaming", NaN, START), "Unavailable");
    assert.equal(feedFreshness("invalid", START, START), "Unavailable");
});

test("watchlist preferences accept only known, unique demo symbols", () => {
    assert.deepEqual(normalizeWatchlist(["ES", "CL", "ES", "UNKNOWN", {}, null]), ["ES", "CL"]);
    assert.deepEqual(normalizeWatchlist([]), []);
    assert.deepEqual(normalizeWatchlist({ symbols: ["ES"] }), [...DEFAULT_WATCHLIST]);
    assert.deepEqual(normalizeWatchlist(null), [...DEFAULT_WATCHLIST]);
});
