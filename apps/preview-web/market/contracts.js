export const DEMO_SOURCE = "Local synthetic engine";
export const DEFAULT_WATCHLIST = Object.freeze(["ES", "NQ", "CL", "GC"]);

export const DEMO_CONTRACTS = Object.freeze([
    { symbol: "ES", name: "E-mini S&P 500", category: "Equity indexes", unit: "Index points", initialPrice: 5868.25, referencePrice: 5845.50, increment: 0.25, precision: 2, movement: 12, barVolume: 5200 },
    { symbol: "NQ", name: "E-mini Nasdaq-100", category: "Equity indexes", unit: "Index points", initialPrice: 20842.75, referencePrice: 20924.50, increment: 0.25, precision: 2, movement: 30, barVolume: 2100 },
    { symbol: "CL", name: "WTI Crude Oil", category: "Energy", unit: "USD / barrel", initialPrice: 72.36, referencePrice: 73.08, increment: 0.01, precision: 2, movement: 6, barVolume: 1800 },
    { symbol: "GC", name: "Gold", category: "Metals", unit: "USD / troy ounce", initialPrice: 2658.20, referencePrice: 2641.80, increment: 0.10, precision: 2, movement: 8, barVolume: 1200 },
    { symbol: "6E", name: "Euro FX", category: "FX", unit: "USD / EUR", initialPrice: 1.08640, referencePrice: 1.08410, increment: 0.00005, precision: 5, movement: 4, barVolume: 620 },
    { symbol: "SR3", name: "Short-term rates", category: "Interest rates", unit: "Demo price index", initialPrice: 96.235, referencePrice: 96.205, increment: 0.005, precision: 3, movement: 2, barVolume: 900 },
    { symbol: "ZC", name: "Corn", category: "Agriculture", unit: "US cents / bushel", initialPrice: 432.75, referencePrice: 429.25, increment: 0.25, precision: 2, movement: 6, barVolume: 780 }
].map((contract) => Object.freeze({ ...contract, id: `${contract.symbol}-DEMO` })));

export function normalizeWatchlist(value) {
    if (!Array.isArray(value)) return [...DEFAULT_WATCHLIST];
    const symbols = new Set(DEMO_CONTRACTS.map((contract) => contract.symbol));
    return [...new Set(value.filter((symbol) => typeof symbol === "string" && symbols.has(symbol)))];
}
