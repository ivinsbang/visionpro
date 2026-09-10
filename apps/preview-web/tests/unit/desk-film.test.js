import assert from "node:assert/strict";
import test from "node:test";
import { createDeskCaptions, createDeskTimeline, deskFilmSettings, deskStoryboard } from "../../scripts/desk-demo/storyboard.js";
import { createSubtitles, stateAt } from "../../scripts/spatial-film/timeline.js";

test("the desk film covers only built features and discloses its Windows synthetic provenance", () => {
    assert.equal(deskFilmSettings.voice, "Microsoft David Desktop");
    assert.deepEqual(deskStoryboard.map((section) => section.id), ["arrival", "markets", "analysis", "windows", "paper", "risk", "workspace", "safety", "closing"]);
    const narration = deskStoryboard.flatMap((section) => section.cues).map((cue) => cue.text).join(" ");
    assert.match(narration, /not footage from a Vision Pro/);
    assert.match(narration, /scripted paper orders/);
    assert.match(narration, /Calendar, voice search, and live connections remain future work/);
});

test("measured narration keeps minimum action time without overlapping chapters or subtitles", () => {
    const durations = deskStoryboard.flatMap((section) => section.cues).map((unused, index) => 3 + index / 10);
    const timeline = createDeskTimeline(durations);
    for (const [index, section] of timeline.sections.entries()) {
        assert.ok(section.end - section.start >= section.minimumSeconds - 0.0001);
        if (index > 0) assert.equal(section.start, timeline.sections[index - 1].end);
        assert.equal(stateAt(timeline, section.start + 0.1).section.id, section.id);
        const cues = timeline.cues.filter((cue) => cue.section === section.id);
        assert.ok(cues.every((cue) => cue.start >= section.start && cue.end < section.end));
    }
    for (let index = 1; index < timeline.cues.length; index += 1) assert.ok(timeline.cues[index].start > timeline.cues[index - 1].end);
    assert.equal(timeline.duration, timeline.sections.at(-1).end);
    assert.match(createSubtitles(timeline), /one hundred thousand fictional dollars/);
    assert.match(createSubtitles(timeline, "vtt"), /^WEBVTT/);
});

test("desk-film narration validation rejects missing and invalid cue durations", () => {
    const durations = deskStoryboard.flatMap((section) => section.cues).map(() => 4);
    assert.throws(() => createDeskTimeline(durations.slice(1)), /positive, finite duration/);
    durations[0] = Number.NaN;
    assert.throws(() => createDeskTimeline(durations), /positive, finite duration/);
});

test("burned-in captions use explicit 1080p sizing and the same measured narration times", () => {
    const timeline = createDeskTimeline(deskStoryboard.flatMap((section) => section.cues).map(() => 4));
    const captions = createDeskCaptions(timeline);
    assert.match(captions, /PlayResX: 1920\nPlayResY: 1080/);
    assert.match(captions, /Style: Default,Segoe UI,28,/);
    assert.match(captions, /Dialogue: 0,0:00:01.30,0:00:05.30,/);
    assert.equal(captions.split("Dialogue: ").length - 1, timeline.cues.length);
});
