import { DEMO_CONTRACTS, DEFAULT_WATCHLIST, normalizeWatchlist } from "./contracts.js";
import { SyntheticMarket, feedFreshness } from "./simulator.js";
import { PriceChart, formatPrice, formatQuantity, formatTime, sparkline } from "./chart.js";

const WATCHLIST_KEY = "cme-spatial-demo.watchlist.v1";
const byId = (identifier) => document.getElementById(identifier);

function node(tag, className, text = "") {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
}

function setText(element, text) {
    if (element.textContent !== text) element.textContent = text;
}

function setTone(element, change) {
    element.classList.toggle("positive", change >= 0);
    element.classList.toggle("negative", change < 0);
}

function percentage(market) {
    const rounded = Number(market.changePercent.toFixed(2));
    return `${rounded > 0 ? "+" : ""}${rounded.toFixed(2)}%`;
}

function fullChange(market) {
    return `${market.change > 0 ? "+" : ""}${formatPrice(market, market.change)} (${percentage(market)})`;
}

export function createMarketDashboard(announce, { sessionOnly = false, onStateChange = () => {}, beforeRestart = () => true } = {}) {
    let engine = new SyntheticMarket();
    let snapshot = engine.snapshot();
    let selectedSymbol = "ES";
    let detachedSymbol = "NQ";
    let rangeMinutes = 60;
    let chartMode = "candles";
    let feedMode = "streaming";
    let session = 0;
    let restarting = false;
    let listMode = "all";
    let refreshTimer;
    let refreshing = false;
    let watchlist = [...DEFAULT_WATCHLIST];

    if (!sessionOnly) {
        try {
            const stored = localStorage.getItem(WATCHLIST_KEY);
            watchlist = stored === null ? [...DEFAULT_WATCHLIST] : normalizeWatchlist(JSON.parse(stored));
        } catch {
            watchlist = [...DEFAULT_WATCHLIST];
        }
    }

    const chart = new PriceChart(byId("market-chart"), byId("chart-readout"), "main", announce);
    const detachedChart = new PriceChart(byId("detached-chart"), byId("detached-readout"), "detached", announce);
    const marketRows = new Map();
    const quoteCards = new Map();

    function saveWatchlist() {
        if (sessionOnly) {
            setText(byId("watchlist-storage"), "Watchlist kept for this open desk only.");
            return;
        }
        try {
            localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
            setText(byId("watchlist-storage"), "Watchlist saved on this browser.");
        } catch {
            setText(byId("watchlist-storage"), "Storage unavailable. Watchlist kept for this tab only.");
        }
    }

    function renderMarketList() {
        const query = byId("market-search").value.trim().toLowerCase();
        const category = byId("asset-filter").value;
        let visibleCount = 0;
        for (const contract of DEMO_CONTRACTS) {
            const row = marketRows.get(contract.symbol);
            const saved = watchlist.includes(contract.symbol);
            row.root.hidden = !(`${contract.symbol} ${contract.name}`.toLowerCase().includes(query)
                && (category === "all" || contract.category === category)
                && (listMode === "all" || saved));
            if (!row.root.hidden) visibleCount += 1;
            row.root.classList.toggle("is-selected", contract.symbol === selectedSymbol);
            row.select.setAttribute("aria-pressed", String(contract.symbol === selectedSymbol));
            row.star.setAttribute("aria-pressed", String(saved));
            row.star.setAttribute("aria-label", `${saved ? "Remove" : "Add"} ${contract.symbol} ${saved ? "from" : "to"} watchlist`);
        }
        byId("market-empty").hidden = visibleCount > 0;
        setText(byId("market-empty-message"), listMode === "watchlist" && watchlist.length === 0 ? "Your watchlist is empty. Star a market to make it yours." : "No matching demo contracts.");
        setText(byId("watchlist-count"), `${watchlist.length} saved`);
        for (const button of document.querySelectorAll("[data-list]")) {
            const selected = button.dataset.list === listMode;
            button.classList.toggle("selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        }
    }

    function selectMarket(symbol) {
        if (!marketRows.has(symbol)) return;
        selectedSymbol = symbol;
        renderMarketList();
        renderSnapshot();
        announce(`${symbol} demo contract selected. Chart, depth, tape, and companion updated.`);
    }

    for (const contract of DEMO_CONTRACTS) {
        const root = node("div", "market-row");
        root.dataset.symbol = contract.symbol;
        const select = node("button", "contract-button");
        select.setAttribute("aria-label", `Select ${contract.symbol} demo contract`);
        const identity = node("span", "market-row-identity");
        identity.append(node("strong", "", contract.symbol), node("span", "", contract.name));
        const quote = node("span", "market-row-quote");
        const price = node("strong", "");
        const change = node("span", "");
        quote.append(price, change);
        select.append(identity, quote);
        select.addEventListener("click", () => selectMarket(contract.symbol));
        const star = node("button", "star-button");
        star.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#icon-star"/></svg>';
        star.addEventListener("click", () => {
            const wasSaved = watchlist.includes(contract.symbol);
            watchlist = wasSaved ? watchlist.filter((symbol) => symbol !== contract.symbol) : [...watchlist, contract.symbol];
            saveWatchlist();
            renderMarketList();
            if (root.hidden) {
                const next = [...marketRows.values()].find((row) => !row.root.hidden);
                (next?.star || document.querySelector('[data-list="all"]')).focus();
            }
            announce(`${contract.symbol} ${wasSaved ? "removed from" : "added to"} your demo watchlist.`);
        });
        root.append(select, star);
        byId("market-list").append(root);
        marketRows.set(contract.symbol, { root, select, star, price, change });

        const option = document.createElement("option");
        option.value = contract.symbol;
        option.textContent = `${contract.symbol} · ${contract.name}`;
        byId("detached-symbol").append(option);

        if (quoteCards.size < 4) {
            const card = node("button", "quote-card");
            card.setAttribute("aria-label", `Show ${contract.symbol} demo contract`);
            const heading = node("span", "quote-card-heading");
            heading.append(node("strong", "", contract.symbol), node("span", "", contract.category));
            const values = node("span", "quote-card-values");
            const cardPrice = node("strong", "");
            const cardChange = node("span", "");
            values.append(cardPrice, cardChange);
            const plot = node("span", "quote-sparkline");
            card.append(heading, values, plot);
            card.addEventListener("click", () => selectMarket(contract.symbol));
            byId("quote-strip").append(card);
            quoteCards.set(contract.symbol, { card, price: cardPrice, change: cardChange, plot });
        }
    }

    for (const category of new Set(DEMO_CONTRACTS.map((contract) => contract.category))) {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        byId("asset-filter").append(option);
    }
    byId("detached-symbol").value = detachedSymbol;

    const depthRows = Array.from({ length: 8 }, () => {
        const row = document.createElement("tr");
        const cells = ["book-bid-size positive", "positive", "negative", "book-ask-size negative"].map((className) => node("td", className));
        row.append(...cells);
        byId("depth-rows").append(row);
        return cells;
    });
    const tradeRows = Array.from({ length: 5 }, () => {
        const row = document.createElement("tr");
        const cells = Array.from({ length: 4 }, () => document.createElement("td"));
        row.append(...cells);
        byId("trade-rows").append(row);
        return { row, cells };
    });

    function renderSnapshot() {
        for (const market of snapshot.markets) {
            const row = marketRows.get(market.symbol);
            setText(row.price, formatPrice(market));
            setText(row.change, percentage(market));
            setTone(row.change, market.change);
            const card = quoteCards.get(market.symbol);
            if (card) {
                setText(card.price, formatPrice(market));
                setText(card.change, percentage(market));
                setTone(card.change, market.change);
                setTone(card.plot, market.change);
                card.card.classList.toggle("is-selected", market.symbol === selectedSymbol);
                card.card.setAttribute("aria-pressed", String(market.symbol === selectedSymbol));
                card.plot.innerHTML = sparkline(market.bars);
            }
            const spatialPanel = document.querySelector(`[data-spatial-symbol="${market.symbol}"]`);
            if (spatialPanel) {
                setText(spatialPanel.querySelector(".model-price"), formatPrice(market));
                spatialPanel.querySelector(".model-sparkline").innerHTML = sparkline(market.bars, 90, 44);
            }
        }
        const market = snapshot.markets.find((contract) => contract.symbol === selectedSymbol);
        for (const [identifier, text] of Object.entries({
            "selected-symbol": market.symbol,
            "selected-category": market.category,
            "selected-name": market.name,
            "selected-price": formatPrice(market),
            "selected-change": fullChange(market),
            "session-high": formatPrice(market, market.high),
            "session-low": formatPrice(market, market.low),
            "session-volume": formatQuantity(market.volume),
            "price-unit": market.unit,
            "depth-symbol": `${market.symbol} · DEMO`,
            "depth-spread": formatPrice(market, market.book.asks[0].price - market.book.bids[0].price),
            "companion-market": `${market.symbol} · ${market.name}`,
            "companion-price": formatPrice(market),
            "companion-change": fullChange(market),
            "feed-sequence": `Local sequence ${String(snapshot.sequence).padStart(5, "0")}`
        })) setText(byId(identifier), text);
        setTone(byId("selected-change"), market.change);
        setTone(byId("companion-change"), market.change);
        chart.update(market, rangeMinutes, chartMode);
        byId("companion-sparkline").innerHTML = sparkline(market.bars, 260, 65);

        const maximumSize = Math.max(...market.book.bids.map((level) => level.size), ...market.book.asks.map((level) => level.size));
        for (const [index, cells] of depthRows.entries()) {
            const bid = market.book.bids[index];
            const ask = market.book.asks[index];
            setText(cells[0], String(bid.size));
            setText(cells[1], formatPrice(market, bid.price));
            setText(cells[2], formatPrice(market, ask.price));
            setText(cells[3], String(ask.size));
            cells[0].style.setProperty("--depth-width", `${bid.size / maximumSize * 100}%`);
            cells[3].style.setProperty("--depth-width", `${ask.size / maximumSize * 100}%`);
        }
        const bids = market.book.bids.reduce((total, level) => total + level.size, 0);
        const asks = market.book.asks.reduce((total, level) => total + level.size, 0);
        setText(byId("bid-total"), `${formatQuantity(bids)} bid`);
        setText(byId("ask-total"), `${formatQuantity(asks)} ask`);
        byId("depth-balance").value = Math.round(bids / (bids + asks) * 100);
        for (const [index, { row, cells }] of tradeRows.entries()) {
            const trade = market.trades[index];
            row.hidden = !trade;
            if (!trade) continue;
            row.dataset.printId = trade.id;
            setText(cells[0], formatTime(trade.time));
            setText(cells[1], formatPrice(market, trade.price));
            setText(cells[2], String(trade.size));
            setText(cells[3], trade.side === "buy" ? "Buy print" : "Sell print");
            setTone(cells[1], trade.side === "buy" ? 1 : -1);
            setTone(cells[3], trade.side === "buy" ? 1 : -1);
        }
        const detached = snapshot.markets.find((contract) => contract.symbol === detachedSymbol);
        setText(byId("detached-price"), formatPrice(detached));
        setText(byId("detached-change"), percentage(detached));
        setTone(byId("detached-change"), detached.change);
        detachedChart.update(detached, 60, "area");
    }

    function renderStatus() {
        const freshness = feedFreshness(feedMode, snapshot.generatedAt, Date.now());
        const healthy = freshness === "Fresh synthetic data";
        const label = feedMode === "streaming" ? healthy ? "Streaming" : "Stale" : feedMode === "paused" ? "Paused" : "Interrupted";
        byId("feed-pill").dataset.state = feedMode === "streaming" && !healthy ? "stale" : feedMode;
        setText(byId("feed-state"), `Demo feed · ${label}`);
        setText(byId("toggle-feed"), feedMode === "streaming" ? "Pause feed" : feedMode === "paused" ? "Resume feed" : "Feed interrupted");
        byId("toggle-feed").disabled = feedMode === "disconnected";
        byId("simulate-outage").disabled = feedMode === "disconnected";
        byId("feed-interrupted").hidden = feedMode !== "disconnected";
        setText(byId("data-freshness"), freshness);
        const generated = `Generated ${formatTime(snapshot.generatedAt)} UTC`;
        setText(byId("header-feed-time"), `SYNTHETIC · ${formatTime(snapshot.generatedAt)} UTC`);
        byId("header-feed-time").title = new Date(snapshot.generatedAt).toISOString();
        setText(byId("market-generated-at"), generated);
        byId("market-generated-at").title = new Date(snapshot.generatedAt).toISOString();
        setText(byId("companion-feed-state"), freshness);
        setText(byId("companion-generated-at"), generated);
        setText(byId("spatial-feed-label"), `Synthetic market screens · ${freshness} · ${formatTime(snapshot.generatedAt)} UTC`);
        setText(byId("detached-feed-label"), `Last 60 minutes · ${freshness} · ${formatTime(snapshot.generatedAt)} UTC`);
        if (!refreshing) setText(byId("connection-status"), `Local synthetic feed is ${label.toLowerCase()}. No CME connection.`);
        onStateChange({ snapshot, mode: feedMode, session });
    }

    function setFeedMode(mode) {
        feedMode = mode;
        if (mode === "streaming") {
            snapshot = engine.advance(Math.max(Date.now(), snapshot.generatedAt + 1));
            renderSnapshot();
        }
        renderStatus();
        announce(mode === "disconnected" ? "Demo feed interrupted. All screens retain a stale synthetic snapshot." : `Demo feed ${mode === "paused" ? "paused" : "resumed"}. No external connection.`);
    }

    function cancelStatusRefresh() {
        clearTimeout(refreshTimer);
        refreshing = false;
        byId("refresh-status").disabled = false;
        renderStatus();
    }

    byId("market-search").addEventListener("input", renderMarketList);
    byId("asset-filter").addEventListener("change", renderMarketList);
    for (const button of document.querySelectorAll("[data-list]")) {
        button.addEventListener("click", () => {
            listMode = button.dataset.list;
            renderMarketList();
        });
    }
    byId("show-all-markets").addEventListener("click", () => {
        listMode = "all";
        byId("market-search").value = "";
        byId("asset-filter").value = "all";
        renderMarketList();
        document.querySelector('[data-list="all"]').focus();
    });
    for (const button of document.querySelectorAll("[data-range]")) {
        button.addEventListener("click", () => {
            rangeMinutes = Number(button.dataset.range);
            for (const candidate of document.querySelectorAll("[data-range]")) {
                const selected = candidate === button;
                candidate.classList.toggle("selected", selected);
                candidate.setAttribute("aria-pressed", String(selected));
            }
            renderSnapshot();
        });
    }
    for (const button of document.querySelectorAll("[data-chart-mode]")) {
        button.addEventListener("click", () => {
            chartMode = button.dataset.chartMode;
            for (const candidate of document.querySelectorAll("[data-chart-mode]")) {
                const selected = candidate === button;
                candidate.classList.toggle("selected", selected);
                candidate.setAttribute("aria-pressed", String(selected));
            }
            renderSnapshot();
        });
    }
    byId("detached-symbol").addEventListener("change", () => {
        detachedSymbol = byId("detached-symbol").value;
        renderSnapshot();
    });
    byId("toggle-feed").addEventListener("click", () => setFeedMode(feedMode === "streaming" ? "paused" : "streaming"));
    byId("simulate-outage").addEventListener("click", () => setFeedMode("disconnected"));
    byId("reconnect-feed").addEventListener("click", () => {
        setFeedMode("streaming");
        byId("toggle-feed").focus();
    });
    byId("refresh-status").addEventListener("click", () => {
        clearTimeout(refreshTimer);
        refreshing = true;
        byId("refresh-status").disabled = true;
        setText(byId("connection-status"), "Checking local workspace…");
        refreshTimer = setTimeout(() => {
            cancelStatusRefresh();
            announce("Local workspace status refreshed. No CME connection.");
        }, 350);
    });
    byId("restart-simulation").addEventListener("click", async () => {
        if (restarting) return;
        restarting = true;
        byId("restart-simulation").disabled = true;
        try {
            if (!await beforeRestart()) return;
            cancelStatusRefresh();
            engine = new SyntheticMarket();
            snapshot = engine.snapshot();
            feedMode = "streaming";
            session += 1;
            renderSnapshot();
            renderStatus();
            announce("Synthetic session and paper account restarted. Demo watchlist preserved.");
        } finally {
            restarting = false;
            byId("restart-simulation").disabled = false;
        }
    });

    renderMarketList();
    renderSnapshot();
    renderStatus();
    setInterval(() => {
        if (feedMode === "streaming") {
            snapshot = engine.advance(Math.max(Date.now(), snapshot.generatedAt + 1));
            renderSnapshot();
        }
        renderStatus();
    }, 1500);
    document.addEventListener("visibilitychange", renderStatus);

    return { cancelStatusRefresh, selectedContract: () => selectedSymbol };
}
