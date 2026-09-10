export function createTimeline(chapters, durations) {
    if (!Array.isArray(chapters) || chapters.length === 0) throw new RangeError("Film chapters are required.");
    const cueCount = chapters.reduce((total, chapter) => total + chapter.cues.length, 0);
    if (durations.length !== cueCount || durations.some((duration) => !Number.isFinite(duration) || duration <= 0)) {
        throw new RangeError("Every narration cue needs a positive, finite duration.");
    }
    let position = 0;
    let cueIndex = 0;
    const cues = [];
    const sections = chapters.map((chapter, sectionIndex) => {
        const start = position;
        position += sectionIndex === 0 ? 1.3 : 0.65;
        for (const cue of chapter.cues) {
            const duration = durations[cueIndex];
            cues.push({ ...cue, index: cueIndex, section: chapter.id, start: position, end: position + duration });
            position += duration + 0.3;
            cueIndex += 1;
        }
        position += sectionIndex === chapters.length - 1 ? 2.4 : 0.8;
        return { ...chapter, index: sectionIndex, start, end: position };
    });
    return { duration: position, sections, cues };
}

export function stateAt(timeline, seconds) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > timeline.duration) {
        throw new RangeError("Film time is outside the timeline.");
    }
    const section = timeline.sections.find((candidate) => seconds < candidate.end) ?? timeline.sections.at(-1);
    const cue = timeline.cues.find((candidate) => seconds >= candidate.start && seconds < candidate.end) ?? null;
    return { section, cue, progress: Math.min(1, (seconds - section.start) / (section.end - section.start)) };
}

export function subtitleTime(seconds, separator = ",") {
    const totalMilliseconds = Math.round(seconds * 1000);
    const hours = Math.floor(totalMilliseconds / 3_600_000);
    const minutes = Math.floor(totalMilliseconds / 60_000) % 60;
    const wholeSeconds = Math.floor(totalMilliseconds / 1000) % 60;
    const milliseconds = totalMilliseconds % 1000;
    return `${[hours, minutes, wholeSeconds].map((value) => String(value).padStart(2, "0")).join(":")}${separator}${String(milliseconds).padStart(3, "0")}`;
}

export function createSubtitles(timeline, format = "srt") {
    if (!["srt", "vtt"].includes(format)) throw new RangeError("Only SRT and VTT subtitles are supported.");
    const separator = format === "vtt" ? "." : ",";
    return `${format === "vtt" ? "WEBVTT\n\n" : ""}${timeline.cues.map((cue, index) => `${index + 1}\n${subtitleTime(cue.start, separator)} --> ${subtitleTime(cue.end, separator)}\n${cue.text}\n`).join("\n")}\n`;
}

export function readWaveDetails(buffer) {
    if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
        throw new Error("Narration must be a RIFF WAVE file.");
    }
    let format;
    let data;
    for (let offset = 12; offset + 8 <= buffer.length;) {
        const identifier = buffer.toString("ascii", offset, offset + 4);
        const length = buffer.readUInt32LE(offset + 4);
        const start = offset + 8;
        if (start + length > buffer.length) throw new Error("Truncated narration audio.");
        if (identifier === "fmt " && length >= 16) {
            format = {
                encoding: buffer.readUInt16LE(start),
                channels: buffer.readUInt16LE(start + 2),
                sampleRate: buffer.readUInt32LE(start + 4),
                bytesPerSecond: buffer.readUInt32LE(start + 8),
                bitsPerSample: buffer.readUInt16LE(start + 14)
            };
        }
        if (identifier === "data") data = buffer.subarray(start, start + length);
        offset = start + length + length % 2;
    }
    if (!format || !data || format.encoding !== 1 || format.channels !== 1 || format.bitsPerSample !== 16 || format.sampleRate !== 24_000 || format.bytesPerSecond !== 48_000 || data.length === 0 || data.length % 2 !== 0) {
        throw new Error("Expected nonempty 24 kHz, mono, 16-bit PCM narration.");
    }
    return { ...format, duration: data.length / format.bytesPerSecond, data };
}
