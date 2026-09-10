# Windows-rendered 3D concept film

For the newer recording of the actual working 3D interface, including paper
trading and portfolio/risk, see the [all-features 3D desk guide](windows-3d-desk.md).
The cinematic renderer described here remains a separate, earlier concept film.

This optional presentation demonstrates the spatial market center idea without
requiring a Mac or headset. It uses the existing local dashboard as a captured
texture inside a rendered 3D room, with additional synthetic chart panels,
scripted camera/focus movement, and an illustrative market-depth model.

The result is a monoscopic 1920x1080, 30 fps H.264 MP4 with AAC male narration and
burned-in English subtitles. SRT and WebVTT subtitle files are also exported.
It is a video of a 3D scene, not stereoscopic or 180/360-degree spatial video.

## What the film does and does not represent

- Persistent labels and narration identify it as a Windows-rendered concept.
- It is not footage from a physical Vision Pro or Apple's visionOS Simulator.
- The main panel displays screenshots captured from the actual Windows app.
  Those screenshots are held captures, not a live native dashboard surface.
- Side charts use the existing seeded synthetic engine with a fixed demo clock.
  They are presentation graphics rather than separate native app windows.
- The focus ring and camera are scripted, not gaze or pinch tracking.
- The 3D depth bars are an illustrative visual concept, not an implemented
  native feature. The depth scene identifies this explicitly.
- Quotes, quantities, and timestamps are synthetic, not official CME data or
  contract specifications. No real orders, accounts, or exchange connections exist.
- This presentation does not validate SwiftUI, RealityKit, visionOS, or comfort
  inside a headset, and does not change the approved application milestone.

## Prerequisites

- Windows with Node.js 22+, Python 3, and installed Google Chrome.
- The project's pinned development dependencies, including Three.js 0.180.0.
- The installed **Microsoft David Desktop** English male voice, exposed through
  Windows `System.Speech`. The script fails rather than silently changing gender.
- FFmpeg with the `libx264` and `aac` encoders. Set `FFMPEG_PATH`, use an installed
  encoder on `PATH`, or install the optional portable tool in the ignored cache:

```powershell
python -m pip install --target .cache/video-tools imageio-ffmpeg==0.6.0
```

The renderer bundles Three.js locally using esbuild. There are no CDN assets or
online text-to-speech calls. Dependency installation may access package registries;
capture, speech generation, and rendering use only local resources. The PowerShell
speech subprocess uses a process-local execution-policy override; it does not
change the user's machine or profile execution policy.

## Render

From the repository root, start the existing loopback server if it is not running:

```powershell
python scripts/serve-preview.py
```

Then, in another terminal:

```powershell
Set-Location apps/preview-web
npm.cmd ci
npm.cmd run record:spatial
```

To generate narration and review one full-resolution frame per chapter without
encoding the entire movie:

```powershell
npm.cmd run record:spatial -- --preview
```

The seven chapters cover the room, the existing dashboard, multiple screens,
scripted focus, the depth concept, paused/offline safety, and the closing overview.
Speech is synthesized per caption. Measured PCM durations determine narration
placement, chapter boundaries, and both burned-in and sidecar subtitle timing.
The total runtime depends on the installed voice; the current narration is about
91 seconds. Rendering takes several minutes depending on the laptop.

Every animation frame is evaluated at its exact film timestamp and streamed to
FFmpeg, rather than relying on a real-time screen recorder to keep up. Rendering
slowly does not change the exported frame rate or subtitle/audio synchronization.
The recorder captures only its own isolated browser profile, not the desktop or
the owner's existing tabs and saved watchlist. Non-loopback browser requests are
blocked and recorded as failures. No application code is uploaded anywhere.

## Outputs

Default files in the repository's ignored `artifacts/videos` directory:

```text
cme-spatial-market-center-3d-narrated.mp4
cme-spatial-market-center-3d-narrated.srt
cme-spatial-market-center-3d-narrated.vtt
cme-spatial-market-center-3d-narrated.png
cme-spatial-market-center-3d-narrated-storyboard.jpg
cme-spatial-market-center-3d-narrated.json
```

Repeated exports preserve earlier files by adding a timestamp. Each run also
keeps an ignored `spatial-render-*` directory with dashboard captures, per-cue
WAV files, assembled narration, timeline JSON, and seven review frames.
No intermediate movie-frame sequence is written to disk.

Open the MP4 directly in a Windows video player for normal playback and seeking.
An additional ignored copy is served at the loopback playback URL printed by the
recorder. The simple development server does not support HTTP byte ranges, so
browser seeking through that URL may be limited. Use the local MP4 instead.

## Checks

`npm.cmd run test:unit` includes three film tests covering measured cue timing,
subtitle formatting and provenance, and WAV format/duration validation. Existing
dashboard and bundled-resource tests remain separate from this video renderer.

The recorder checks each narration cue for audible PCM, renders all seven review
frames, rejects browser errors and external requests, and fully decodes the final
MP4. It verifies 1080p H.264, 30 fps, an AAC audio track, expected runtime, and an
audible output level. The exported JSON records those results and explicitly
marks headset footage, Simulator footage, and stereoscopic video as false.

Visual review is still important: inspect the poster and storyboard for framing,
label legibility, and subtitle placement. Listen to the MP4 for pronunciation and
voice quality. Audio loudness checks do not substitute for listening.

Native validation still requires the [Mac simulator workflow](visionos-simulator.md).
