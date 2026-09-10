export const filmSettings = Object.freeze({
    width: 1920,
    height: 1080,
    frameRate: 30,
    voice: "Microsoft David Desktop",
    seed: 20260909,
    fixtureTime: "2026-09-09T13:30:00.000Z"
});

export const storyboard = [
    {
        id: "arrival",
        label: "ENTER THE WORKSPACE",
        title: "Markets, without boundaries.",
        detail: "A spatial market center concept",
        cues: [
            { text: "Welcome to the Spatial Market Center, a CME-style prototype.", spoken: "Welcome to the Spatial Market Center, a C M E style prototype." },
            { text: "This is a 3D concept rendered on Windows, not a recording from a Vision Pro.", spoken: "This is a three dimensional concept rendered on Windows, not a recording from a Vision Pro." }
        ]
    },
    {
        id: "dashboard",
        label: "YOUR EXISTING PROTOTYPE",
        title: "One desk. A wider perspective.",
        detail: "Captured dashboard, presented in a rendered room",
        cues: [
            { text: "The dashboard already built for this project becomes the center of a virtual trading desk." },
            { text: "Charts, a watchlist, and market depth sit together in one calm workspace." }
        ]
    },
    {
        id: "screens",
        label: "MULTIPLE MARKET SCREENS",
        title: "Make room for the bigger picture.",
        detail: "Local synthetic equity, energy, and metals markets",
        cues: [
            { text: "Give each market its own screen." },
            { text: "Compare equity indexes, crude oil, and gold without losing sight of the wider picture." }
        ]
    },
    {
        id: "focus",
        label: "SCRIPTED SPATIAL NAVIGATION",
        title: "Bring a market into focus.",
        detail: "Illustrated camera and focus motion, not headset tracking",
        cues: [
            { text: "A scripted focus cue brings the energy chart closer." },
            { text: "Camera movement shows how floating panels could be arranged around you." }
        ]
    },
    {
        id: "depth",
        label: "3D DEPTH / VISUAL CONCEPT",
        title: "See another dimension of depth.",
        detail: "Illustrative bid and ask quantities, not executable liquidity",
        cues: [
            { text: "This scene explores a three-dimensional view of market depth." },
            { text: "The bars are an illustrative concept, driven only by generated bids and asks." }
        ]
    },
    {
        id: "safety",
        label: "OFFLINE BY DESIGN",
        title: "Explore with confidence.",
        detail: "Held synthetic snapshots. No order execution.",
        cues: [
            { text: "Pause the local feed and inspect a held snapshot." },
            { text: "There are no exchange connections, customer accounts, or real orders." }
        ]
    },
    {
        id: "closing",
        label: "READY FOR YOUR REVIEW",
        title: "A different perspective on markets.",
        detail: "Vision Pro-inspired. Independently created. Entirely synthetic.",
        cues: [
            { text: "A wider perspective on markets, designed for exploration." },
            { text: "Synthetic data. A Windows-rendered concept. Ready for your review." }
        ]
    }
];
