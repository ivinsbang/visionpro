import { createTimeline } from "../spatial-film/timeline.js";

export const deskFilmSettings = Object.freeze({ width: 1920, height: 1080, frameRate: 30, voice: "Microsoft David Desktop" });

export const deskStoryboard = [
    {
        id: "arrival", title: "Your working prototype, in three dimensions.", minimumSeconds: 14,
        cues: [
            { text: "This is your Spatial Market Center, running in a three-dimensional Windows browser workspace." },
            { text: "It is not footage from a Vision Pro. Everything you see uses local synthetic data." }
        ]
    },
    {
        id: "markets", title: "Seven markets. A watchlist of your own.", minimumSeconds: 18,
        cues: [
            { text: "Focus the main window to search contracts, filter asset classes, and build a watchlist." },
            { text: "Quotes update locally. The linked companion follows your selected market, with a visible source and timestamp." }
        ]
    },
    {
        id: "analysis", title: "Price, depth, and activity together.", minimumSeconds: 19,
        cues: [
            { text: "Compare candle and area charts across three time ranges, and inspect the generated history." },
            { text: "Eight levels of synthetic market depth and a trade tape complete the analysis view. This is not executable liquidity." }
        ]
    },
    {
        id: "windows", title: "Arrange a wider perspective.", minimumSeconds: 19,
        cues: [
            { text: "The independent chart can show another contract while the main desk keeps its own selection." },
            { text: "Move a window by its title, focus it for detail, or return to the curved room view. Mouse and keyboard controls work." }
        ]
    },
    {
        id: "paper", title: "Paper orders. Deliberate confirmation.", minimumSeconds: 33,
        cues: [
            { text: "Paper trading begins with one hundred thousand fictional dollars, not a connected customer account." },
            { text: "Choose a side and quantity, review the estimate, then explicitly confirm. Only fresh synthetic bids and asks can create a paper fill." },
            { text: "For this recording, scripted paper orders create a small example portfolio. No real order is sent." }
        ]
    },
    {
        id: "risk", title: "Every paper position, in perspective.", minimumSeconds: 26,
        cues: [
            { text: "The portfolio shows long and short positions, profit and loss, exposure, and margin allocation by asset class." },
            { text: "Tick values, margin amounts, and warnings are invented demonstration rules, not CME requirements.", spoken: "Tick values, margin amounts, and warnings are invented demonstration rules, not C M E requirements." },
            { text: "Closing a position opens another reviewed ticket. The calculation assumptions stay available for inspection." }
        ]
    },
    {
        id: "workspace", title: "The original workspace, still connected.", minimumSeconds: 19,
        cues: [
            { text: "Overview and Spatial workspace retain the original window controls, with the same running market session." },
            { text: "Rotate the existing three-market model. This is browser three-dimensional presentation, not native gaze or hand tracking." }
        ]
    },
    {
        id: "safety", title: "Held data. Protected paper actions.", minimumSeconds: 28,
        cues: [
            { text: "Simulate an outage to hold market timestamps and block paper orders. The portfolio clearly marks its held data." },
            { text: "Reconnect or pause the local generator without changing the paper account." },
            { text: "Restart asks before clearing paper activity. Cancel keeps the session. Nothing contacts an exchange or broker." }
        ]
    },
    {
        id: "closing", title: "All built features. One synthetic workspace.", minimumSeconds: 16,
        cues: [
            { text: "The interactive feature tour is ready in your local three-dimensional desk." },
            { text: "Calendar, voice search, and live connections remain future work. This is the Windows prototype, ready for your review." }
        ]
    }
];

export function createDeskTimeline(durations) {
    const initial = createTimeline(deskStoryboard, durations);
    let additionalTime = 0;
    const sections = initial.sections.map((section) => {
        const start = section.start + additionalTime;
        const extra = Math.max(0, section.minimumSeconds - (section.end - section.start));
        additionalTime += extra;
        return { ...section, start, end: section.end + additionalTime };
    });
    const shifts = new Map(sections.map((section, index) => [section.id, section.start - initial.sections[index].start]));
    const cues = initial.cues.map((cue) => ({ ...cue, start: cue.start + shifts.get(cue.section), end: cue.end + shifts.get(cue.section) }));
    return { duration: initial.duration + additionalTime, sections, cues };
}

export function createDeskCaptions(timeline) {
    function timestamp(seconds) {
        const centiseconds = Math.round(seconds * 100);
        const hours = Math.floor(centiseconds / 360_000);
        const minutes = Math.floor(centiseconds / 6000) % 60;
        const wholeSeconds = Math.floor(centiseconds / 100) % 60;
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
    }
    const header = [
        "[Script Info]", "ScriptType: v4.00+", "PlayResX: 1920", "PlayResY: 1080", "WrapStyle: 0", "ScaledBorderAndShadow: yes", "",
        "[V4+ Styles]", "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        "Style: Default,Segoe UI,28,&H00F5F5F5,&H00F5F5F5,&H0020150E,&H0020150E,0,0,0,0,100,100,0,0,1,1.4,0,2,175,175,32,1", "",
        "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
    ];
    const events = timeline.cues.map((cue) => `Dialogue: 0,${timestamp(cue.start)},${timestamp(cue.end)},Default,,0,0,0,,${cue.text.replace(/[\r\n]/g, " ")}`);
    return `${[...header, ...events].join("\n")}\n`;
}
