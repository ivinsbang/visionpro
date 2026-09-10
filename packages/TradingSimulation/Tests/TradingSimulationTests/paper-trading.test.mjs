import assert from "node:assert/strict";
import test from "node:test";
import { PAPER_LIMITS, PaperTradingSession } from "../../Sources/TradingSimulation/paper-trading.mjs";

const START = Date.parse("2026-09-09T13:30:00Z");
const definitions = [
    { symbol: "ES", precision: 2, increment: 0.25, tickValueCents: 500, marginCents: 650_000 },
    { symbol: "6E", precision: 5, increment: 0.00005, tickValueCents: 125, marginCents: 250_000 }
];

function market({ mark = 100, bid = mark - 0.25, ask = mark + 0.25, timestamp = START, sequence = 0 } = {}) {
    return {
        mode: "synthetic", source: "Local synthetic engine", generatedAt: timestamp, sequence,
        markets: [
            { symbol: "ES", price: mark, book: { bids: [{ price: bid }], asks: [{ price: ask }] } },
            { symbol: "6E", price: 1.08640, book: { bids: [{ price: 1.08635 }], asks: [{ price: 1.08645 }] } }
        ]
    };
}

function session() {
    const result = new PaperTradingSession(definitions);
    assert.equal(result.updateMarket(market(), "streaming"), true);
    return result;
}

function fill(account, side, quantity, now = START, symbol = "ES") {
    const review = account.reviewOrder({ symbol, side, quantity }, now);
    return account.confirmOrder(review.token, now);
}

test("a paper account starts funded but flat, and review or cancellation never creates fills", () => {
    const account = session();
    const before = account.snapshot(START);
    assert.equal(before.equityCents, PAPER_LIMITS.initialBalanceCents);
    assert.equal(before.marginCents, 0);
    assert.deepEqual(before.positions, []);
    const review = account.reviewOrder({ symbol: "ES", side: "buy", quantity: "2" }, START);
    assert.equal(review.estimate.price, 100.25);
    assert.equal(review.estimate.positionQuantity, 2);
    assert.deepEqual(account.snapshot(START), before);
    account.cancelReview();
    assert.throws(() => account.confirmOrder(review.token, START), /new review/);
    assert.deepEqual(account.snapshot(START), before);
});

test("buys fill at the synthetic ask; long marks, margin, and FIFO closing use integer cents", () => {
    const account = session();
    const first = fill(account, "buy", 2);
    assert.equal(first.price, 100.25);
    let state = account.snapshot(START);
    assert.equal(state.unrealizedCents, -1000);
    assert.equal(state.balanceCents, 10_000_000);
    assert.equal(state.marginCents, 1_300_000);
    assert.equal(state.equityCents, 9_999_000);
    assert.equal(state.freeEquityCents, 8_699_000);
    account.updateMarket(market({ mark: 101, timestamp: START + 1500, sequence: 1 }), "streaming");
    fill(account, "buy", 1, START + 1500);
    state = account.snapshot(START + 1500);
    assert.equal(state.positions[0].quantity, 3);
    assert.ok(Math.abs(state.positions[0].averageEntry - (100.25 * 2 + 101.25) / 3) < 0.000001);
    account.updateMarket(market({ mark: 102, timestamp: START + 3000, sequence: 2 }), "streaming");
    const close = fill(account, "sell", 2, START + 3000);
    assert.equal(close.price, 101.75);
    assert.equal(close.realizedCents, 6000);
    state = account.snapshot(START + 3000);
    assert.equal(state.positions[0].quantity, 1);
    assert.equal(state.positions[0].averageEntry, 101.25);
    assert.equal(state.realizedCents, 6000);
    assert.equal(state.unrealizedCents, 1500);
    assert.equal(state.equityCents, 10_007_500);
});

test("short positions, partial exits, and reversals realize the correct signed FIFO profit", () => {
    const account = session();
    assert.equal(fill(account, "sell", 3).price, 99.75);
    account.updateMarket(market({ mark: 98, timestamp: START + 1500, sequence: 1 }), "streaming");
    assert.equal(account.snapshot(START + 1500).unrealizedCents, 10_500);
    assert.equal(fill(account, "buy", 1, START + 1500).realizedCents, 3000);
    assert.equal(fill(account, "buy", 4, START + 1500).realizedCents, 6000);
    const state = account.snapshot(START + 1500);
    assert.equal(state.positions[0].quantity, 2);
    assert.equal(state.positions[0].averageEntry, 98.25);
    assert.equal(state.realizedCents, 9000);
    assert.equal(state.unrealizedCents, -1000);
    assert.equal(state.equityCents, 10_008_000);
});

test("flattening removes positions and releases all fictional margin", () => {
    const account = session();
    fill(account, "buy", 1);
    fill(account, "sell", 1);
    const state = account.snapshot(START);
    assert.deepEqual(state.positions, []);
    assert.equal(state.marginCents, 0);
    assert.equal(state.unrealizedCents, 0);
    assert.equal(state.realizedCents, -1000);
    assert.equal(state.equityCents, 9_999_000);
    assert.equal(state.freeEquityCents, state.equityCents);
});

test("five-decimal FX increments produce exact USD demo-cent results", () => {
    const account = session();
    const first = fill(account, "buy", 3, START, "6E");
    assert.equal(first.price, 1.08645);
    assert.equal(account.snapshot(START).unrealizedCents, -375);
    fill(account, "sell", 3, START, "6E");
    assert.equal(account.snapshot(START).realizedCents, -750);
});

test("confirmation uses the latest fresh quote, recomputes risk, and consumes its token once", () => {
    const account = session();
    const review = account.reviewOrder({ symbol: "ES", side: "buy", quantity: 1 }, START);
    account.updateMarket(market({ mark: 102, timestamp: START + 1500, sequence: 1 }), "streaming");
    assert.equal(account.currentReview(START + 1500).estimate.price, 102.25);
    assert.equal(account.confirmOrder(review.token, START + 1500).price, 102.25);
    assert.throws(() => account.confirmOrder(review.token, START + 1500), /new review/);
    assert.equal(account.snapshot(START + 1500).fillCount, 1);
});

test("unknown symbols, invalid sides/types/quantities, and invalid configuration are rejected", () => {
    const account = session();
    for (const quantity of [0, -1, 1.5, 21, NaN, Infinity, "", "1e1", "2.5", "<script>", null, true, {}]) {
        assert.throws(() => account.reviewOrder({ symbol: "ES", side: "buy", quantity }, START), /whole number/);
    }
    assert.throws(() => account.reviewOrder({ symbol: "UNKNOWN", side: "buy", quantity: 1 }, START), /known demo/);
    assert.throws(() => account.reviewOrder({ symbol: "ES", side: "hold", quantity: 1 }, START), /Buy or Sell/);
    assert.throws(() => account.reviewOrder({ symbol: "ES", side: "buy", quantity: 1, type: "limit" }, START), /market orders/);
    assert.throws(() => new PaperTradingSession([]), /definitions/);
    assert.throws(() => new PaperTradingSession([definitions[0], definitions[0]]), /unique/);
    assert.throws(() => new PaperTradingSession([{ ...definitions[0], tickValueCents: 0 }]), /tick value/);
    assert.equal(account.snapshot(START).fillCount, 0);
});

test("paused, interrupted, stale, future, and unavailable quotes block review and confirmation", () => {
    for (const mode of ["paused", "disconnected"]) {
        const account = session();
        const review = account.reviewOrder({ symbol: "ES", side: "buy", quantity: 1 }, START);
        account.updateMarket(market(), mode);
        assert.throws(() => account.confirmOrder(review.token, START));
        assert.throws(() => account.reviewOrder({ symbol: "ES", side: "buy", quantity: 1 }, START));
        assert.equal(account.snapshot(START).fillCount, 0);
    }
    const account = session();
    assert.equal(account.feedStatus(START + 5000).fresh, true);
    for (const now of [START + 5001, START - 1, NaN, Infinity]) {
        assert.throws(() => account.reviewOrder({ symbol: "ES", side: "buy", quantity: 1 }, now));
    }
    const empty = new PaperTradingSession(definitions);
    assert.equal(empty.feedStatus(START).fresh, false);
    assert.throws(() => empty.reviewOrder({ symbol: "ES", side: "buy", quantity: 1 }, START));
});

test("expired, replaced, cancelled, and pre-reset review tokens cannot fill an order", () => {
    const account = session();
    const request = { symbol: "ES", side: "buy", quantity: 1 };
    const first = account.reviewOrder(request, START);
    const replacement = account.reviewOrder(request, START);
    assert.throws(() => account.confirmOrder(first.token, START), /new review/);
    account.updateMarket(market({ timestamp: START + 15_000, sequence: 1 }), "streaming");
    assert.match(account.currentReview(START + 15_000).error, /expired/);
    assert.throws(() => account.confirmOrder(replacement.token, START + 15_000), /expired/);
    const beforeReset = account.reviewOrder(request, START + 15_000);
    account.reset();
    assert.throws(() => account.confirmOrder(beforeReset.token, START + 15_000), /new review/);
    assert.equal(account.snapshot(START + 15_000).fillCount, 0);
});

test("insufficient illustrative margin prevents added exposure but permits risk-reducing closes", () => {
    const account = session();
    assert.throws(() => fill(account, "buy", 16), /Insufficient demo equity/);
    fill(account, "buy", 14);
    const additional = account.reviewOrder({ symbol: "ES", side: "buy", quantity: 1 }, START);
    account.updateMarket(market({ mark: 50, timestamp: START + 1500, sequence: 1 }), "streaming");
    assert.ok(account.snapshot(START + 1500).freeEquityCents < 0);
    assert.throws(() => account.confirmOrder(additional.token, START + 1500), /Insufficient demo equity/);
    assert.throws(() => fill(account, "buy", 1, START + 1500), /Insufficient demo equity/);
    assert.equal(fill(account, "sell", 1, START + 1500).quantity, 1);
    assert.equal(account.snapshot(START + 1500).positions[0].quantity, 13);
});

test("even a negative-equity account can flatten, but cannot reverse into a new position", () => {
    const account = session();
    fill(account, "sell", 15);
    account.updateMarket(market({ mark: 1000, timestamp: START + 1500, sequence: 1 }), "streaming");
    assert.ok(account.snapshot(START + 1500).equityCents < 0);
    assert.throws(() => fill(account, "buy", 16, START + 1500), /Insufficient demo equity/);
    fill(account, "buy", 1, START + 1500);
    assert.ok(account.snapshot(START + 1500).freeEquityCents < 0);
    fill(account, "buy", 14, START + 1500);
    assert.equal(account.snapshot(START + 1500).positions.length, 0);
    assert.ok(account.snapshot(START + 1500).balanceCents < 0);
});

test("invalid or non-synthetic snapshots never replace held marks or allow a paper fill", () => {
    const variants = [
        { ...market(), mode: "live" },
        { ...market(), source: "external" },
        { ...market(), generatedAt: NaN },
        { ...market(), sequence: -1 },
        { ...market(), markets: [] },
        { ...market(), markets: [market().markets[0], market().markets[0]] },
        market({ bid: 101, ask: 100 }),
        market({ mark: 100.01 }),
        market({ mark: Infinity })
    ];
    for (const snapshot of variants) {
        const account = session();
        fill(account, "buy", 1);
        assert.equal(account.updateMarket(snapshot, "streaming"), false);
        const state = account.snapshot(START);
        assert.equal(state.feed.fresh, false);
        assert.equal(state.positions[0].mark, 100);
        assert.equal(state.fillCount, 1);
        assert.throws(() => fill(account, "buy", 1));
    }
});

test("source snapshots, returned reviews, account snapshots, and fills cannot mutate the ledger", () => {
    const account = session();
    const source = market();
    account.updateMarket(source, "streaming");
    source.markets[0].book.asks[0].price = 500;
    const input = { symbol: "ES", side: "buy", quantity: 1 };
    const review = account.reviewOrder(input, START);
    input.quantity = 20;
    review.estimate.quantity = 20;
    const order = account.confirmOrder(review.token, START);
    order.quantity = 20;
    const state = account.snapshot(START);
    state.fills[0].price = 0;
    state.positions[0].quantity = 20;
    assert.equal(account.snapshot(START).positions[0].quantity, 1);
    assert.equal(account.snapshot(START).fills[0].price, 100.25);
});

test("history stays bounded without losing cumulative balance and reset preserves only market marks", () => {
    const account = session();
    for (let index = 0; index < 110; index += 1) fill(account, index % 2 === 0 ? "buy" : "sell", 1);
    const state = account.snapshot(START);
    assert.equal(state.fills.length, PAPER_LIMITS.historyLimit);
    assert.equal(state.fillCount, 110);
    assert.equal(state.realizedCents, -55_000);
    assert.equal(state.balanceCents, 9_945_000);
    assert.equal(new Set(state.fills.map((order) => order.id)).size, 100);
    account.reset();
    assert.equal(account.snapshot(START).fillCount, 0);
    assert.equal(account.snapshot(START).balanceCents, 10_000_000);
    assert.equal(account.feedStatus(START).fresh, true);
    assert.equal(fill(account, "buy", 1).id, "PAPER-2-0001");
    account.reset({ clearMarket: true });
    assert.equal(account.feedStatus(START).fresh, false);
});

test("the 100-contract position cap applies across orders and does not block a reduction", () => {
    const account = new PaperTradingSession(definitions.map((definition) => ({ ...definition, marginCents: 100 })));
    account.updateMarket(market(), "streaming");
    for (let index = 0; index < 5; index += 1) fill(account, "buy", 20);
    assert.equal(account.snapshot(START).positions[0].quantity, 100);
    assert.throws(() => fill(account, "buy", 1), /100 contracts/);
    fill(account, "sell", 20);
    assert.equal(account.snapshot(START).positions[0].quantity, 80);
});

test("portfolio totals combine long and short markets without margin or gross-exposure offsets", () => {
    const account = session();
    fill(account, "buy", 2);
    fill(account, "sell", 3, START, "6E");
    const state = account.snapshot(START);
    assert.equal(state.marginCents, 2 * 650_000 + 3 * 250_000);
    assert.equal(state.unrealizedCents, -1000 - 375);
    assert.equal(state.exposureCents, 400 * 500 * 2 + 21_728 * 125 * 3);
    assert.equal(state.freeEquityCents, state.equityCents - state.marginCents);
    assert.ok(Number.isSafeInteger(state.exposureCents));
});

test("older events and backwards review clocks cannot create retrospective fills", () => {
    const account = session();
    const review = account.reviewOrder({ symbol: "ES", side: "buy", quantity: 1 }, START + 4000);
    assert.match(account.currentReview(START + 2000).error, /clock moved backwards/);
    assert.throws(() => account.confirmOrder(review.token, START + 2000), /clock moved backwards/);
    account.updateMarket(market({ timestamp: START + 4500, sequence: 3 }), "streaming");
    assert.equal(account.updateMarket(market(), "streaming"), false);
    assert.equal(account.snapshot(START + 4500).generatedAt, START + 4500);
    assert.equal(account.snapshot(START + 4500).fillCount, 0);
    assert.equal(account.feedStatus(START + 4500).fresh, false);
});
