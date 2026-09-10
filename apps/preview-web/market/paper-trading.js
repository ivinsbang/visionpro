import { PAPER_LIMITS, PaperTradingSession } from "./paper-trading-model.js";
import { PAPER_CONTRACTS } from "./paper-trading-fixtures.js";
import { formatPrice } from "./chart.js";

const byId = (identifier) => document.getElementById(identifier);
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money = (value) => value === null ? "Unavailable" : currency.format(value / 100);
const time = (timestamp) => timestamp === null ? "Unavailable" : new Date(timestamp).toISOString().slice(11, 19);

function setText(element, value) {
    if (element.textContent !== value) element.textContent = value;
}

function element(tag, className, value) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (value !== undefined) result.textContent = value;
    return result;
}

function tone(target, value) {
    target.classList.toggle("positive", value !== null && value > 0);
    target.classList.toggle("negative", value !== null && value < 0);
}

function positionLabel(quantity) {
    return quantity === 0 ? "Flat" : `${quantity > 0 ? "Long" : "Short"} ${Math.abs(quantity)}`;
}

export function createPaperWorkspace({ announce, showPage }) {
    const account = new PaperTradingSession(PAPER_CONTRACTS);
    const definitions = new Map(PAPER_CONTRACTS.map((contract) => [contract.symbol, contract]));
    const reviewDialog = byId("paper-review-dialog");
    const resetDialog = byId("paper-reset-dialog");
    const positionRows = new Map();
    const allocationRows = new Map();
    let side = "buy";
    let lastMarketSession;
    let lastFillKey = "";
    let reviewToken;
    let reviewInput;
    let restartResolver;
    let resetKind = "paper";

    function selectedDefinition() {
        return definitions.get(byId("paper-contract").value) ?? PAPER_CONTRACTS[0];
    }

    function setSide(value) {
        side = value;
        for (const button of document.querySelectorAll("[data-paper-side]")) {
            const selected = button.dataset.paperSide === side;
            button.classList.toggle("selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        }
    }

    function openOrder(symbol, direction = "buy", quantity = 1, explanation = "") {
        if (!definitions.has(symbol)) return;
        showPage("paper");
        byId("paper-contract").value = symbol;
        byId("paper-quantity").value = String(quantity);
        byId("paper-quantity").removeAttribute("aria-invalid");
        setSide(direction);
        byId("paper-ticket-error").hidden = true;
        byId("paper-ticket-context").hidden = !explanation;
        setText(byId("paper-ticket-context"), explanation);
        byId("paper-success").hidden = true;
        render();
        byId("paper-quantity").focus();
        announce(`${symbol} ${direction} paper ticket opened. Review and confirmation are required.`);
    }

    for (const definition of PAPER_CONTRACTS) {
        const option = element("option", "", `${definition.symbol} · ${definition.name} · DEMO`);
        option.value = definition.symbol;
        byId("paper-contract").append(option);
        const row = element("tr");
        row.dataset.symbol = definition.symbol;
        row.hidden = true;
        const cells = Array.from({ length: 7 }, () => element("td"));
        cells[0].append(element("strong", "", definition.symbol), element("small", "", definition.category));
        const close = element("button", "quiet-button", "Close");
        close.type = "button";
        close.addEventListener("click", () => {
            const position = account.snapshot(Date.now()).positions.find((candidate) => candidate.symbol === definition.symbol);
            if (!position) return;
            const quantity = Math.min(PAPER_LIMITS.maxOrderQuantity, Math.abs(position.quantity));
            openOrder(definition.symbol, position.quantity > 0 ? "sell" : "buy", quantity, `This ticket ${quantity === Math.abs(position.quantity) ? "closes" : "reduces"} ${quantity} of your ${Math.abs(position.quantity)} ${definition.symbol} paper contracts. Review before confirming.`);
        });
        cells[6].append(close);
        row.append(...cells);
        byId("portfolio-position-rows").append(row);
        positionRows.set(definition.symbol, { row, cells, close });
        const assumptions = element("tr");
        for (const value of [definition.symbol, formatPrice(definition, definition.increment), money(definition.tickValueCents), money(definition.marginCents)]) assumptions.append(element("td", "", value));
        byId("paper-assumption-rows").append(assumptions);
    }

    const allocationColors = ["#83cfc9", "#d6bc89", "#9ebfe0", "#b8a7d8", "#9dccad", "#d0b998"];
    for (const [index, category] of [...new Set(PAPER_CONTRACTS.map((definition) => definition.category))].entries()) {
        const row = element("div", "paper-allocation-row");
        const heading = element("div");
        const amount = element("strong", "", money(0));
        heading.append(element("span", "", category), amount);
        const track = element("div", "paper-allocation-track");
        const fill = element("span", "paper-allocation-fill");
        fill.style.backgroundColor = allocationColors[index % allocationColors.length];
        track.append(fill);
        row.append(heading, track);
        byId("portfolio-allocation").append(row);
        allocationRows.set(category, { amount, fill });
    }

    function renderHistory(state) {
        const key = `${state.sessionNumber}-${state.fillCount}`;
        if (key === lastFillKey) return;
        lastFillKey = key;
        byId("paper-history-empty").hidden = state.fillCount > 0;
        byId("paper-history-table").hidden = state.fillCount === 0;
        setText(byId("paper-fill-count"), `${state.fillCount} ${state.fillCount === 1 ? "fill" : "fills"}`);
        const rows = state.fills.map((fill) => {
            const row = element("tr");
            row.dataset.fillId = fill.id;
            const identity = element("td");
            identity.append(element("strong", "", fill.id), element("small", "", `${time(fill.filledAt)} UTC`));
            identity.title = `Paper fill: ${new Date(fill.filledAt).toISOString()}; synthetic quote: ${new Date(fill.quoteTime).toISOString()}`;
            const direction = element("td", fill.side === "buy" ? "positive" : "negative", fill.side === "buy" ? "Buy" : "Sell");
            const realized = element("td", "", money(fill.realizedCents));
            tone(realized, fill.realizedCents);
            row.append(identity, element("td", "", fill.symbol), direction, element("td", "", String(fill.quantity)), element("td", "", formatPrice(definitions.get(fill.symbol), fill.price)), realized);
            return row;
        });
        byId("paper-fill-rows").replaceChildren(...rows);
    }

    function renderPortfolio(state) {
        for (const [identifier, value] of Object.entries({
            "paper-equity": state.equityCents,
            "paper-free-equity": state.freeEquityCents,
            "portfolio-equity": state.equityCents,
            "portfolio-unrealized": state.unrealizedCents,
            "portfolio-realized": state.realizedCents,
            "portfolio-margin": state.marginCents,
            "portfolio-free-equity": state.freeEquityCents,
            "portfolio-exposure": state.exposureCents
        })) setText(byId(identifier), money(value));
        tone(byId("portfolio-unrealized"), state.unrealizedCents);
        tone(byId("portfolio-realized"), state.realizedCents);
        tone(byId("paper-free-equity"), state.freeEquityCents < 0 ? state.freeEquityCents : 0);
        setText(byId("portfolio-balance"), `Cash ledger: ${money(state.balanceCents)}`);
        setText(byId("portfolio-position-count"), String(state.positions.length));
        setText(byId("portfolio-utilization"), state.utilization === null ? "Over limit" : `${(state.utilization * 100).toFixed(1)}%`);
        byId("portfolio-margin-meter").value = state.utilization === null ? 100 : Math.min(100, state.utilization * 100);
        byId("portfolio-margin-meter").setAttribute("aria-valuetext", `${state.utilization === null ? "Over limit" : (state.utilization * 100).toFixed(1) + "%"} illustrative margin utilization`);
        const critical = state.freeEquityCents !== null && (state.freeEquityCents <= 0 || state.equityCents <= 0);
        const warning = state.utilization !== null && state.utilization >= 0.7;
        const badge = byId("portfolio-risk-badge");
        badge.dataset.severity = critical ? "critical" : warning ? "warning" : "normal";
        setText(badge, critical ? "Demo equity exhausted" : warning ? "Elevated demo usage" : state.positions.length === 0 ? "No open positions" : "Below demo threshold");
        setText(byId("portfolio-risk-message"), critical ? "Illustrative margin meets or exceeds demo equity. Added exposure is blocked; reviewed risk-reducing orders remain possible with fresh quotes." : warning ? "At least 70% of paper equity is used by fictional margin. This is a local demonstration warning, not an official margin call." : state.positions.length === 0 ? "No margin is reserved while the paper account is flat." : "Illustrative margin is below the local 70% warning threshold. This is not a real-world risk assessment.");
        byId("portfolio-held-notice").hidden = state.feed.fresh;
        setText(byId("portfolio-held-notice"), `${state.feed.label}. P/L and margin use held synthetic marks, not fresh market data. ${state.feed.reason}`);
        byId("portfolio-empty").hidden = state.positions.length > 0;
        byId("portfolio-positions-table").hidden = state.positions.length === 0;
        for (const [symbol, row] of positionRows) {
            const position = state.positions.find((candidate) => candidate.symbol === symbol);
            row.row.hidden = !position;
            if (!position) continue;
            const definition = definitions.get(symbol);
            setText(row.cells[1], positionLabel(position.quantity));
            tone(row.cells[1], position.quantity);
            setText(row.cells[2], formatPrice(definition, position.averageEntry));
            setText(row.cells[3], position.mark === null ? "Unavailable" : formatPrice(definition, position.mark));
            setText(row.cells[4], money(position.unrealizedCents));
            tone(row.cells[4], position.unrealizedCents);
            setText(row.cells[5], money(position.marginCents));
            const action = Math.abs(position.quantity) > PAPER_LIMITS.maxOrderQuantity ? "Reduce" : "Close";
            setText(row.close, action);
            row.close.setAttribute("aria-label", `Prepare ${action.toLowerCase()} ${symbol} paper position`);
            row.close.disabled = !state.feed.fresh;
        }
        for (const [category, row] of allocationRows) {
            const margin = state.positions.filter((position) => definitions.get(position.symbol).category === category).reduce((total, position) => total + position.marginCents, 0);
            setText(row.amount, money(margin));
            row.fill.style.width = `${state.marginCents > 0 ? margin / state.marginCents * 100 : 0}%`;
        }
    }

    function renderReview() {
        if (!reviewDialog.open) return;
        const review = account.currentReview(Date.now());
        if (!review) {
            byId("paper-confirm-order").disabled = true;
            setText(byId("paper-review-error"), "This review is no longer active. Refresh it before confirming.");
            byId("paper-review-error").hidden = false;
            return;
        }
        const definition = definitions.get(review.request.symbol);
        setText(byId("paper-review-description"), `${review.request.side === "buy" ? "Buy" : "Sell"} ${review.request.quantity} ${definition.symbol} demo ${review.request.quantity === 1 ? "contract" : "contracts"} · simulated market order`);
        const values = review.estimate;
        for (const [identifier, value] of Object.entries({
            "paper-review-price": values ? formatPrice(definition, values.price) : "Unavailable",
            "paper-review-position": values ? positionLabel(values.positionQuantity) : "Unavailable",
            "paper-review-equity": values ? money(values.equityCents) : "Unavailable",
            "paper-review-margin": values ? money(values.marginCents) : "Unavailable",
            "paper-review-free": values ? money(values.freeEquityCents) : "Unavailable"
        })) setText(byId(identifier), value);
        setText(byId("paper-review-timing"), review.error ? "Confirmation disabled. Refresh the review when fresh quotes are available." : `Review expires in ${Math.max(0, Math.ceil((review.expiresAt - Date.now()) / 1000))}s · synthetic quote ${time(values.quoteTime)} UTC`);
        byId("paper-review-error").hidden = !review.error;
        if (review.error) setText(byId("paper-review-error"), review.error);
        byId("paper-confirm-order").disabled = Boolean(review.error);
    }

    function render() {
        const state = account.snapshot(Date.now());
        const definition = selectedDefinition();
        const quote = state.quotes.find((candidate) => candidate.symbol === definition.symbol);
        const position = state.positions.find((candidate) => candidate.symbol === definition.symbol);
        setText(byId("paper-bid"), quote ? formatPrice(definition, quote.bid) : "—");
        setText(byId("paper-ask"), quote ? formatPrice(definition, quote.ask) : "—");
        setText(byId("paper-current-position"), positionLabel(position?.quantity ?? 0));
        setText(byId("paper-tick-value"), money(definition.tickValueCents));
        setText(byId("paper-margin-unit"), money(definition.marginCents));
        setText(byId("paper-feed-message"), state.feed.reason);
        byId("paper-feed-notice").dataset.held = String(!state.feed.fresh);
        byId("paper-review-order").disabled = !state.feed.fresh;
        for (const identifier of ["paper-feed-status", "portfolio-feed-status"]) setText(byId(identifier), state.feed.label);
        for (const identifier of ["paper-mark-time", "portfolio-mark-time"]) {
            setText(byId(identifier), state.generatedAt === null ? "No synthetic timestamp" : `Synthetic mark ${time(state.generatedAt)} UTC`);
            byId(identifier).title = state.generatedAt === null ? "" : new Date(state.generatedAt).toISOString();
        }
        renderPortfolio(state);
        renderHistory(state);
        renderReview();
    }

    function clearNotices() {
        byId("paper-success").hidden = true;
        byId("paper-ticket-error").hidden = true;
        byId("paper-ticket-context").hidden = true;
        byId("paper-quantity").removeAttribute("aria-invalid");
    }

    function showReset(kind) {
        resetKind = kind;
        setText(byId("paper-reset-title"), kind === "market" ? "Restart the synthetic session?" : "Reset paper account?");
        setText(byId("paper-reset-description"), kind === "market" ? "This restarts generated prices and restores $100,000 fictional USD, clearing every paper position and fill. Your watchlist is preserved. There are no real orders or funds." : "This restores $100,000 fictional USD and clears every paper position and fill in this open desk. Synthetic quotes and your watchlist are unchanged. This cannot be undone.");
        setText(byId("paper-reset-confirm"), kind === "market" ? "Confirm session restart" : "Confirm paper reset");
        resetDialog.showModal();
        byId("paper-reset-cancel").focus();
    }

    for (const button of document.querySelectorAll("[data-paper-side]")) button.addEventListener("click", () => {
        setSide(button.dataset.paperSide);
        byId("paper-ticket-context").hidden = true;
    });
    for (const button of document.querySelectorAll("[data-paper-page]")) button.addEventListener("click", () => showPage(button.dataset.paperPage));
    byId("paper-contract").addEventListener("change", () => {
        clearNotices();
        render();
    });
    byId("paper-quantity").addEventListener("input", () => {
        byId("paper-ticket-error").hidden = true;
        byId("paper-quantity").removeAttribute("aria-invalid");
    });
    byId("paper-ticket").addEventListener("submit", (event) => {
        event.preventDefault();
        if (reviewDialog.open || resetDialog.open) return;
        byId("paper-ticket-error").hidden = true;
        try {
            const input = { symbol: byId("paper-contract").value, side, quantity: byId("paper-quantity").value };
            const review = account.reviewOrder(input, Date.now());
            reviewInput = { ...input };
            reviewToken = review.token;
            reviewDialog.showModal();
            renderReview();
            byId("paper-review-back").focus();
        } catch (error) {
            setText(byId("paper-ticket-error"), error.message);
            byId("paper-ticket-error").hidden = false;
            if (/Quantity/.test(error.message)) {
                byId("paper-quantity").setAttribute("aria-invalid", "true");
                byId("paper-quantity").focus();
            }
        }
    });
    byId("paper-review-back").addEventListener("click", () => reviewDialog.close());
    reviewDialog.addEventListener("close", () => {
        if (reviewDialog.open) return;
        account.cancelReview();
        reviewToken = undefined;
        reviewInput = undefined;
        byId("paper-review-order").focus();
    });
    byId("paper-review-refresh").addEventListener("click", () => {
        if (!reviewInput) return;
        try {
            reviewToken = account.reviewOrder(reviewInput, Date.now()).token;
            renderReview();
        } catch (error) {
            setText(byId("paper-review-error"), error.message);
            byId("paper-review-error").hidden = false;
            byId("paper-confirm-order").disabled = true;
        }
    });
    byId("paper-confirm-order").addEventListener("click", () => {
        byId("paper-confirm-order").disabled = true;
        try {
            const fill = account.confirmOrder(reviewToken, Date.now());
            reviewDialog.close();
            setText(byId("paper-success"), `${fill.id}: paper ${fill.side} filled for ${fill.quantity} ${fill.symbol} at ${formatPrice(definitions.get(fill.symbol), fill.price)} using local synthetic quotes. No real order was placed.`);
            byId("paper-success").hidden = false;
            byId("paper-ticket-context").hidden = true;
            render();
        } catch (error) {
            setText(byId("paper-review-error"), error.message);
            byId("paper-review-error").hidden = false;
        }
    });
    byId("paper-reset-account").addEventListener("click", () => showReset("paper"));
    byId("paper-reset-cancel").addEventListener("click", () => resetDialog.close());
    resetDialog.addEventListener("close", () => {
        if (resetDialog.open) return;
        const complete = restartResolver;
        restartResolver = undefined;
        if (complete) complete(false);
    });
    byId("paper-reset-confirm").addEventListener("click", () => {
        const complete = restartResolver;
        restartResolver = undefined;
        resetDialog.close();
        if (resetKind === "market") {
            if (complete) complete(true);
        } else {
            account.reset();
            clearNotices();
            render();
            announce("Paper account reset to 100,000 fictional dollars. Positions and fills cleared; watchlist preserved.");
        }
    });
    setInterval(render, 1000);
    render();

    return {
        openOrder,
        updateMarket({ snapshot, mode, session }) {
            if (lastMarketSession !== undefined && lastMarketSession !== session) {
                account.reset({ clearMarket: true });
                clearNotices();
            }
            lastMarketSession = session;
            account.updateMarket(snapshot, mode);
            render();
        },
        requestMarketRestart() {
            if (reviewDialog.open || resetDialog.open) return Promise.resolve(false);
            if (account.snapshot(Date.now()).fillCount === 0) return Promise.resolve(true);
            return new Promise((complete) => {
                restartResolver = complete;
                showReset("market");
            });
        }
    };
}
