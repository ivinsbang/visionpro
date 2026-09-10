import { DEMO_CONTRACTS } from "./contracts.js";

const valuations = {
    ES: { tickValueCents: 500, marginCents: 650_000 },
    NQ: { tickValueCents: 200, marginCents: 750_000 },
    CL: { tickValueCents: 100, marginCents: 400_000 },
    GC: { tickValueCents: 250, marginCents: 450_000 },
    "6E": { tickValueCents: 125, marginCents: 250_000 },
    SR3: { tickValueCents: 100, marginCents: 100_000 },
    ZC: { tickValueCents: 150, marginCents: 200_000 }
};

export const PAPER_CONTRACTS = Object.freeze(DEMO_CONTRACTS.map((contract) => Object.freeze({
    ...contract,
    ...valuations[contract.symbol]
})));
