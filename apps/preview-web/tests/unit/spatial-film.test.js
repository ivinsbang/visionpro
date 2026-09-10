import assert from "node:assert/strict";
import test from "node:test";
import { storyboard, filmSettings } from "../../scripts/spatial-film/storyboard.js";
import { createSubtitles, createTimeline, readWaveDetails, stateAt, subtitleTime } from "../../scripts/spatial-film/timeline.js";

test("film narration is timed from measured speech without overlapping subtitles", () => {
    const durations = storyboard.flatMap((section) => section.cues.map(() => 4));
    const timeline = createTimeline(storyboard, durations);
    assert.equal(timeline.sections.length, 7);
    assert.equal(timeline.cues.length, durations.length);
    assert.equal(timeline.sections[0].start, 0);
    assert.equal(timeline.sections.at(-1).end, timeline.duration);
    timeline.cues.forEach((cue, index) => {
        assert.ok(Math.abs(cue.end - cue.start - 4) < 0.000001);
        assert.ok(cue.start < cue.end);
        if (index > 0) assert.ok(timeline.cues[index - 1].end < cue.start);
        assert.equal(stateAt(timeline, (cue.start + cue.end) / 2).cue.text, cue.text);
    });
    assert.equal(stateAt(timeline, 0).cue, null);
    assert.equal(stateAt(timeline, timeline.duration).section.id, "closing");
    assert.throws(() => stateAt(timeline, -1), RangeError);
    assert.throws(() => stateAt(timeline, NaN), RangeError);
    assert.throws(() => stateAt(timeline, timeline.duration + 1), RangeError);
    assert.throws(() => createTimeline(storyboard, [1]), RangeError);
    assert.throws(() => createTimeline(storyboard, durations.map(() => NaN)), RangeError);
});

test("subtitle sidecars have portable timestamps and the spoken provenance disclosure", () => {
    const timeline = createTimeline(storyboard, storyboard.flatMap((section) => section.cues.map(() => 3.5)));
    assert.equal(subtitleTime(3661.012), "01:01:01,012");
    assert.equal(subtitleTime(59.9997, "."), "00:01:00.000");
    assert.match(createSubtitles(timeline), /^1\n00:00:01,300 --> 00:00:04,800/);
    assert.match(createSubtitles(timeline, "vtt"), /^WEBVTT\n\n1\n00:00:01\.300/);
    assert.match(createSubtitles(timeline), /not a recording from a Vision Pro/);
    assert.match(createSubtitles(timeline), /scripted focus cue/);
    assert.match(createSubtitles(timeline), /illustrative concept/);
    assert.throws(() => createSubtitles(timeline, "ass"), RangeError);
    assert.equal(filmSettings.voice, "Microsoft David Desktop");
});

test("narration WAV parsing validates the audio format and exact PCM duration", () => {
    const audio = Buffer.alloc(44 + 48_000);
    audio.write("RIFF", 0);
    audio.writeUInt32LE(audio.length - 8, 4);
    audio.write("WAVEfmt ", 8);
    audio.writeUInt32LE(16, 16);
    audio.writeUInt16LE(1, 20);
    audio.writeUInt16LE(1, 22);
    audio.writeUInt32LE(24_000, 24);
    audio.writeUInt32LE(48_000, 28);
    audio.writeUInt16LE(2, 32);
    audio.writeUInt16LE(16, 34);
    audio.write("data", 36);
    audio.writeUInt32LE(48_000, 40);
    assert.equal(readWaveDetails(audio).duration, 1);
    assert.equal(readWaveDetails(audio).data.length, 48_000);
    assert.throws(() => readWaveDetails(audio.subarray(0, 100)), /Truncated/);
    const stereo = Buffer.from(audio);
    stereo.writeUInt16LE(2, 22);
    assert.throws(() => readWaveDetails(stereo), /mono/);
    assert.throws(() => readWaveDetails(Buffer.from("not a wave")), /RIFF/);
});
