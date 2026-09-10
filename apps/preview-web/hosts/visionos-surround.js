// Read-only presentation for the native room. Read the already-rendered desk;
// never create a market engine, paper account, timer, or order command here.
export function readSurroundSnapshot(document, chartValues) {
    if (document.documentElement.dataset.dashboardReady !== "true") return null;
    const text = (selector, root = document) => root.querySelector(selector)?.textContent.trim() ?? "";
    const metric = (label, selector) => ({ label, value: text(selector) });
    const rows = (selector, columns, limit = 8) => [...document.querySelectorAll(`${selector} tr`)]
        .filter((row) => !row.hidden)
        .slice(0, limit)
        .map((row) => [...row.cells].slice(0, columns).map((cell) =>
            // Preserve the separation between contract/category and fill ID/time.
            [...cell.childNodes].map((child) => child.textContent.trim()).filter(Boolean).join(" ")
        ));
    const panel = (id, title, values) => ({
        id, title, subtitle: "", metrics: [], tableTitle: "", columns: [], rows: [],
        emptyMessage: "", note: "", chartValues: [], ...values
    });
    const symbol = text("#selected-symbol");
    const generatedAt = document.querySelector("#market-generated-at").title;
    const displayedMode = document.querySelector("#feed-pill").dataset.state;
    // A native read can succeed while WebKit's interval is suspended. Recheck
    // quote age with the shared freshness rule without advancing either engine.
    const freshness = feedFreshness(displayedMode === "stale" ? "streaming" : displayedMode, Date.parse(generatedAt), Date.now());
    return {
        version: 1,
        source: "Local synthetic engine · No CME connection",
        generatedAt,
        freshness,
        sequence: text("#feed-sequence"),
        panels: [
            panel("chart", `${symbol} · Selected market`, {
                subtitle: `${text("#selected-name")} · ${text("#price-unit")}`,
                metrics: [metric("Synthetic last", "#selected-price"), metric("Change vs demo reference", "#selected-change")],
                chartValues,
                tableTitle: "Simulated prints · UTC",
                columns: ["Time", "Price", "Qty", "Side"],
                rows: rows("#trade-rows", 4, 5),
                emptyMessage: "No generated prints yet.",
                note: "Chart: last 60 one-minute synthetic closes. Generated history, not exchange trades."
            }),
            panel("depth", `${symbol} · Market depth`, {
                subtitle: "Eight levels of generated liquidity",
                metrics: [metric("Illustrative spread", "#depth-spread"), metric("Displayed bids", "#bid-total"), metric("Displayed asks", "#ask-total")],
                tableTitle: "Synthetic order book",
                columns: ["Bid qty", "Bid", "Ask", "Ask qty"],
                rows: rows("#depth-rows", 4),
                note: "Generated liquidity. Not executable. The selected contract follows the interactive desk."
            }),
            panel("portfolio", "Paper portfolio", {
                subtitle: "The same fictional USD account as your interactive desk",
                metrics: [metric("Paper equity", "#portfolio-equity"), metric("Unrealized P/L", "#portfolio-unrealized"), metric("Realized P/L", "#portfolio-realized")],
                tableTitle: "Open paper positions",
                columns: ["Contract", "Position", "Avg entry", "Demo mark", "Open P/L", "Margin"],
                rows: rows("#portfolio-position-rows", 6),
                emptyMessage: "No open paper positions. Review and confirm a practice order on the interactive desk.",
                note: freshness !== "Fresh synthetic data"
                    ? `${freshness}. P/L and margin use held synthetic marks, not fresh market data.`
                    : "Session only · FIFO · Fictional parameters. Entering or leaving the room keeps this account."
            }),
            panel("risk", "Illustrative risk & fills", {
                subtitle: text("#portfolio-risk-badge"),
                metrics: [metric("Margin utilization", "#portfolio-utilization"), metric("Demo margin", "#portfolio-margin"), metric("Free demo equity", "#portfolio-free-equity"), metric("Gross demo exposure", "#portfolio-exposure")],
                tableTitle: `Latest paper fills · ${text("#paper-fill-count")}`,
                columns: ["Paper ID / UTC", "Contract", "Side", "Qty", "Price", "Realized P/L"],
                rows: rows("#paper-fill-rows", 6, 6),
                emptyMessage: "No confirmed paper fills in this session.",
                note: text("#portfolio-risk-message")
            }),
            panel("watchlist", "Your watchlist", {
                subtitle: "Saved for this open desk · Synthetic contracts",
                tableTitle: "Watched markets",
                columns: ["Contract", "Name", "Synthetic last", "Change"],
                // Include saved markets even when the desk has a search/category filter.
                rows: [...document.querySelectorAll(".market-row")]
                    .filter((row) => row.querySelector(".star-button").getAttribute("aria-pressed") === "true")
                    .map((row) => [row.dataset.symbol, text(".market-row-identity > span", row), text(".market-row-quote > strong", row), text(".market-row-quote > span", row)]),
                emptyMessage: "Your watchlist is empty. Star a market on the interactive desk.",
                note: "Edit your watchlist on the interactive desk. All surrounding screens read this same session."
            })
        ]
    };
}
import { feedFreshness } from "../market/simulator.js";
