export const PAPER_LIMITS = Object.freeze({
    initialBalanceCents: 10_000_000,
    maxOrderQuantity: 20,
    maxPositionQuantity: 100,
    quoteMaxAgeMs: 5000,
    reviewMaxAgeMs: 15_000,
    historyLimit: 100
});

function integer(value, name, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new RangeError(`${name} is outside the supported demo range.`);
    return value;
}

function cents(value) {
    return integer(value, "Demo currency amount", -Number.MAX_SAFE_INTEGER);
}

function contractDefinition(definition) {
    if (!definition || typeof definition.symbol !== "string" || !/^[A-Z0-9]{1,12}$/.test(definition.symbol)) throw new TypeError("A known demo symbol is required.");
    integer(definition.precision, "Price precision", 0, 8);
    integer(definition.tickValueCents, "Fictional tick value", 1, 100_000);
    integer(definition.marginCents, "Fictional margin", 1, 100_000_000);
    const scale = 10 ** definition.precision;
    const incrementUnits = Math.round(definition.increment * scale);
    if (!Number.isFinite(definition.increment) || Math.abs(definition.increment * scale - incrementUnits) > 0.00001) throw new TypeError("Invalid demo price increment.");
    integer(incrementUnits, "Demo price increment", 1);
    return Object.freeze({ ...definition, scale, incrementUnits });
}

function priceTicks(price, definition) {
    if (typeof price !== "number" || !Number.isFinite(price)) throw new TypeError("A finite synthetic price is required.");
    const units = Math.round(price * definition.scale);
    if (Math.abs(price * definition.scale - units) > 0.00001 || units % definition.incrementUnits !== 0) throw new RangeError("Synthetic price does not match its demo increment.");
    return integer(units / definition.incrementUnits, "Synthetic price", 1, 100_000_000);
}

function displayPrice(ticks, definition) {
    return ticks * definition.incrementUnits / definition.scale;
}

export class PaperTradingSession {
    #definitions;
    #quotes = new Map();
    #lots = new Map();
    #fills = [];
    #realizedCents = 0;
    #generatedAt = null;
    #sequence = -1;
    #mode = "unavailable";
    #review = null;
    #reviewSequence = 0;
    #fillCount = 0;
    #sessionNumber = 1;

    constructor(definitions) {
        if (!Array.isArray(definitions) || definitions.length === 0 || definitions.length > 20) throw new TypeError("Demo contract definitions are required.");
        this.#definitions = new Map(definitions.map((definition) => [definition.symbol, contractDefinition(definition)]));
        if (this.#definitions.size !== definitions.length) throw new TypeError("Demo symbols must be unique.");
    }

    updateMarket(snapshot, mode) {
        try {
            if (!snapshot || snapshot.mode !== "synthetic" || snapshot.source !== "Local synthetic engine" || !["streaming", "paused", "disconnected"].includes(mode)) throw new Error("Only local synthetic data is supported.");
            integer(snapshot.generatedAt, "Synthetic timestamp", 1);
            integer(snapshot.sequence, "Synthetic sequence");
            if (this.#generatedAt !== null && (snapshot.generatedAt < this.#generatedAt || snapshot.sequence < this.#sequence)) throw new Error("An older synthetic event cannot replace the current snapshot.");
            if (!Array.isArray(snapshot.markets) || snapshot.markets.length !== this.#definitions.size) throw new Error("All demo marks are required.");
            const quotes = new Map();
            for (const market of snapshot.markets) {
                const definition = this.#definitions.get(market.symbol);
                if (!definition || quotes.has(market.symbol)) throw new Error("Unknown or duplicate demo symbol.");
                const markTicks = priceTicks(market.price, definition);
                const bidTicks = priceTicks(market.book?.bids?.[0]?.price, definition);
                const askTicks = priceTicks(market.book?.asks?.[0]?.price, definition);
                if (bidTicks >= askTicks) throw new Error("Synthetic bid and ask prices must not cross.");
                quotes.set(market.symbol, { markTicks, bidTicks, askTicks });
            }
            this.#quotes = quotes;
            this.#generatedAt = snapshot.generatedAt;
            this.#sequence = snapshot.sequence;
            this.#mode = mode;
            return true;
        } catch {
            this.#mode = "unavailable";
            return false;
        }
    }

    feedStatus(now) {
        if (!Number.isFinite(now) || this.#generatedAt === null || now < this.#generatedAt || this.#mode === "unavailable") return { fresh: false, label: "Quotes unavailable", reason: "Fresh local synthetic quotes are required before placing a paper order." };
        if (this.#mode === "paused") return { fresh: false, label: "Paused snapshot", reason: "The demo feed is paused. Resume it on the market desk before trading." };
        if (this.#mode === "disconnected") return { fresh: false, label: "Interrupted snapshot", reason: "The demo feed is interrupted. Reconnect the local feed before trading." };
        if (now - this.#generatedAt > PAPER_LIMITS.quoteMaxAgeMs) return { fresh: false, label: "Stale snapshot", reason: "The synthetic quote is stale. Wait for a fresh local update." };
        return { fresh: true, label: "Fresh synthetic quotes", reason: "Paper orders use the current generated bid or ask. No exchange connection." };
    }

    #request(input) {
        if (!input || !this.#definitions.has(input.symbol)) throw new Error("Choose a known demo contract.");
        if (!["buy", "sell"].includes(input.side)) throw new Error("Choose Buy or Sell for this paper order.");
        if (input.type !== undefined && input.type !== "market") throw new Error("Only simulated market orders are supported in this step.");
        if (typeof input.quantity === "string" && !/^\d+$/.test(input.quantity.trim())) throw new Error("Quantity must be a whole number from 1 to 20.");
        const quantity = typeof input.quantity === "string" ? Number(input.quantity.trim()) : input.quantity;
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > PAPER_LIMITS.maxOrderQuantity) throw new Error("Quantity must be a whole number from 1 to 20.");
        return { symbol: input.symbol, side: input.side, quantity, type: "market" };
    }

    #account(lots = this.#lots, realizedCents = this.#realizedCents) {
        const positions = [];
        for (const [symbol, definition] of this.#definitions) {
            const entries = lots.get(symbol) ?? [];
            if (entries.length === 0) continue;
            const quantity = entries.reduce((total, entry) => total + entry.quantity, 0);
            const averageTicks = entries.reduce((total, entry) => total + Math.abs(entry.quantity) * entry.entryTicks, 0) / Math.abs(quantity);
            const quote = this.#quotes.get(symbol);
            const unrealizedCents = quote ? cents(entries.reduce((total, entry) => total + (quote.markTicks - entry.entryTicks) * entry.quantity * definition.tickValueCents, 0)) : null;
            positions.push({
                symbol, quantity, averageEntry: displayPrice(averageTicks, definition),
                mark: quote ? displayPrice(quote.markTicks, definition) : null,
                unrealizedCents,
                marginCents: cents(Math.abs(quantity) * definition.marginCents),
                exposureCents: quote ? cents(Math.abs(quantity) * quote.markTicks * definition.tickValueCents) : null
            });
        }
        const marksAvailable = positions.every((position) => position.unrealizedCents !== null);
        const balanceCents = cents(PAPER_LIMITS.initialBalanceCents + realizedCents);
        const unrealizedCents = marksAvailable ? cents(positions.reduce((total, position) => total + position.unrealizedCents, 0)) : null;
        const equityCents = marksAvailable ? cents(balanceCents + unrealizedCents) : null;
        const marginCents = cents(positions.reduce((total, position) => total + position.marginCents, 0));
        return {
            initialBalanceCents: PAPER_LIMITS.initialBalanceCents,
            balanceCents, realizedCents, unrealizedCents, equityCents, marginCents,
            freeEquityCents: equityCents === null ? null : cents(equityCents - marginCents),
            exposureCents: marksAvailable ? cents(positions.reduce((total, position) => total + position.exposureCents, 0)) : null,
            utilization: equityCents > 0 ? marginCents / equityCents : marginCents === 0 ? 0 : null,
            positions
        };
    }

    #project(request, now) {
        const status = this.feedStatus(now);
        if (!status.fresh) throw new Error(status.reason);
        const definition = this.#definitions.get(request.symbol);
        const quote = this.#quotes.get(request.symbol);
        const fillTicks = request.side === "buy" ? quote.askTicks : quote.bidTicks;
        const direction = request.side === "buy" ? 1 : -1;
        const lots = new Map([...this.#lots].map(([symbol, entries]) => [symbol, entries.map((entry) => ({ ...entry }))]));
        const entries = lots.get(request.symbol) ?? [];
        let remaining = request.quantity;
        let realizedChangeCents = 0;
        while (remaining > 0 && entries.length > 0 && Math.sign(entries[0].quantity) !== direction) {
            const entry = entries[0];
            const closeQuantity = Math.min(remaining, Math.abs(entry.quantity));
            const heldDirection = Math.sign(entry.quantity);
            realizedChangeCents = cents(realizedChangeCents + (fillTicks - entry.entryTicks) * heldDirection * closeQuantity * definition.tickValueCents);
            entry.quantity -= heldDirection * closeQuantity;
            remaining -= closeQuantity;
            if (entry.quantity === 0) entries.shift();
        }
        if (remaining > 0) entries.push({ quantity: remaining * direction, entryTicks: fillTicks });
        const positionQuantity = entries.reduce((total, entry) => total + entry.quantity, 0);
        if (Math.abs(positionQuantity) > PAPER_LIMITS.maxPositionQuantity) throw new Error("A demo position cannot exceed 100 contracts.");
        if (entries.length > 0) lots.set(request.symbol, entries);
        else lots.delete(request.symbol);
        const account = this.#account(lots, cents(this.#realizedCents + realizedChangeCents));
        if (account.equityCents === null) throw new Error("All open positions need a synthetic mark before placing a paper order.");
        if (remaining > 0 && account.marginCents > Math.max(0, account.equityCents)) throw new Error("Insufficient demo equity for the illustrative margin. Reduce quantity or close existing exposure.");
        return {
            lots,
            estimate: {
                ...request, price: displayPrice(fillTicks, definition), positionQuantity,
                realizedChangeCents, equityCents: account.equityCents,
                marginCents: account.marginCents, freeEquityCents: account.freeEquityCents,
                quoteTime: this.#generatedAt, sequence: this.#sequence
            }
        };
    }

    reviewOrder(input, now) {
        const request = this.#request(input);
        const projection = this.#project(request, now);
        const token = `review-${++this.#reviewSequence}`;
        this.#review = { token, request, createdAt: now, expiresAt: now + PAPER_LIMITS.reviewMaxAgeMs };
        return { token, expiresAt: this.#review.expiresAt, estimate: { ...projection.estimate } };
    }

    currentReview(now) {
        if (!this.#review) return null;
        const { token, createdAt, expiresAt, request } = this.#review;
        try {
            if (!Number.isFinite(now) || now >= expiresAt) throw new Error("Review expired. Refresh this review before confirming.");
            if (now < createdAt) throw new Error("The local clock moved backwards. Refresh this review before confirming.");
            const { estimate } = this.#project(request, now);
            return { token, expiresAt, request: { ...request }, estimate, error: null };
        } catch (error) {
            return { token, expiresAt, request: { ...request }, estimate: null, error: error.message };
        }
    }

    confirmOrder(token, now) {
        if (!this.#review || token !== this.#review.token) throw new Error("This paper order needs a new review. It may already have been confirmed or cancelled.");
        if (now < this.#review.createdAt) {
            this.#review = null;
            throw new Error("The local clock moved backwards. Review the paper order again.");
        }
        if (!Number.isFinite(now) || now >= this.#review.expiresAt) {
            this.#review = null;
            throw new Error("Review expired. Review the paper order again.");
        }
        const { lots, estimate } = this.#project(this.#review.request, now);
        const realizedCents = cents(this.#realizedCents + estimate.realizedChangeCents);
        const fill = {
            id: `PAPER-${this.#sessionNumber}-${String(this.#fillCount + 1).padStart(4, "0")}`,
            symbol: estimate.symbol, side: estimate.side, quantity: estimate.quantity,
            price: estimate.price, realizedCents: estimate.realizedChangeCents,
            filledAt: now, quoteTime: estimate.quoteTime, sequence: estimate.sequence,
            source: "Local synthetic engine", mode: "paper"
        };
        this.#review = null;
        this.#lots = lots;
        this.#realizedCents = realizedCents;
        this.#fillCount += 1;
        this.#fills.unshift(fill);
        this.#fills.length = Math.min(this.#fills.length, PAPER_LIMITS.historyLimit);
        return { ...fill };
    }

    cancelReview() {
        this.#review = null;
    }

    reset({ clearMarket = false } = {}) {
        this.#lots.clear();
        this.#fills = [];
        this.#realizedCents = 0;
        this.#fillCount = 0;
        this.#review = null;
        this.#sessionNumber += 1;
        if (clearMarket) {
            this.#quotes.clear();
            this.#generatedAt = null;
            this.#sequence = -1;
            this.#mode = "unavailable";
        }
    }

    snapshot(now) {
        return {
            ...this.#account(),
            feed: this.feedStatus(now), generatedAt: this.#generatedAt,
            sessionNumber: this.#sessionNumber, fillCount: this.#fillCount,
            fills: this.#fills.map((fill) => ({ ...fill })),
            quotes: [...this.#quotes].map(([symbol, quote]) => ({
                symbol,
                bid: displayPrice(quote.bidTicks, this.#definitions.get(symbol)),
                ask: displayPrice(quote.askTicks, this.#definitions.get(symbol)),
                mark: displayPrice(quote.markTicks, this.#definitions.get(symbol))
            }))
        };
    }
}
