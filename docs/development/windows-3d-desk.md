# Interactive Windows 3D desk

The owner's requested 3D demo brings every built browser feature into one spatial
workspace. It is a working CSS 3D interface, not screenshots masquerading as an
application, and not a recording from a Vision Pro or Apple's Simulator.

## Open the demo

Start `python scripts/serve-preview.py` from the repository root if the local
server is not already running, then open [the 3D desk](http://127.0.0.1:8765/?demo=3d)
in Chrome or Edge. Alternatively, refresh the ordinary preview and choose **3D desk**.
Viewing requires no npm installation, internet service, broker, or CME account.

The actual main window, independent chart, and linked quote companion are arranged
in a curved panorama. They share the existing synthetic engine. The main window
includes markets/watchlists, chart types/ranges, depth/tape, paper orders and fills,
portfolio/risk, overview, spatial workspace, and feed/settings controls.

## Controls

- **Room view** frames the open windows. **Focus desk** makes the main window
  large enough to read and operate; use focus mode for detailed chart inspection.
- The window selector focuses the main desk, independent chart, linked quote,
  or existing three-market spatial model. It opens a closed supporting window.
- The feature selector opens any built page in the same main window. It does not
  switch to another account or market session.
- Drag a title with the pointer, or focus it and use arrows. Shift increases the
  movement step. The main window also has a title handle in 3D mode.
- **View controls** changes zoom, horizontal/vertical viewing angle, and curved
  versus flat panorama. **Recenter windows** changes positions, not financial state.
- **Feature tour** explains nine views with Previous/Next controls. It never
  places an order, changes a watchlist, or resets the account. Try those controls
  yourself if desired; no voice or raw gaze/hand tracking is implemented.
- **Exit 3D** or Escape restores the prior flat window positions and visibility.
  A paper dialog handles Escape first, cancelling review without leaving 3D.

Entering, navigating, touring, recentering, and exiting reuse the existing DOM,
event handlers, quotes, watchlist, and in-memory paper ledger. No iframe, duplicated
engine, or extra account is created. Reload still clears the fictional account,
as described in the [paper-trading guide](step-4a-verification.md).

Narrow screens initially focus the desk rather than the panorama. Controls and
tables remain scrollable; reduced-motion preferences disable camera transitions.
The native resource bundle includes this web presentation, but it remains inside
one `WKWebView`, not separate native windows or a RealityKit financial scene.

## Record the full walkthrough

The completed local export from 2026-09-09 is available as the
[all-features 3D video](http://127.0.0.1:8765/artifacts/videos/cme-spatial-market-center-all-features-3d.mp4).
The file is `artifacts/videos/cme-spatial-market-center-all-features-3d.mp4`:
198.3 seconds, 1920 x 1080, 30 fps, and 21.7 MB, with Microsoft David Desktop male
narration and English captions. Its adjacent `.srt` and `.vtt` files are optional
subtitle sidecars; subtitles are already visible in the MP4. Generated exports
are local, ignored artifacts, not part of the source bundle.

The current optional recorder captures this real browser interface, including
paper trading and portfolio/risk. It is distinct from the older Three.js concept
renderer. The output is a standard, nonstereoscopic 1920 x 1080, 30 fps H.264/AAC
MP4, with offline male narration and burned-in English subtitles. SRT and VTT
sidecars are included.

Prerequisites: Windows, Node.js 22+, installed Google Chrome, the local preview
server, **Microsoft David Desktop** enabled as a male Windows speech voice, and
FFmpeg with `libx264`, AAC, and the subtitles filter. The speech helper verifies
the selected voice and does not contact an online speech service.

From the repository root, if recording dependencies are not already installed:

```powershell
python -m pip install --target .cache/video-tools imageio-ffmpeg==0.6.0
Set-Location apps/preview-web
npm.cmd ci
npx.cmd playwright install ffmpeg
npm.cmd run record:desk -- --preview
npm.cmd run record:desk
```

If an appropriate encoder is already installed, set `FFMPEG_PATH` instead of using
the optional portable package. The server must stay running. The full recording
takes roughly its three-minute runtime plus audio preparation, encoding, and
validation. Avoid other heavy work during capture; the recorder fails rather than
silently accepting large action/narration timing drift.

The preview option synthesizes narration, rehearses the UI, and captures review
frames under ignored `artifacts/videos/desk-recording-*`, without exporting a movie.
The full run prints its final MP4 path and loopback playback link, and creates:

- A local MP4, poster, storyboard, SRT/VTT captions, and JSON verification metadata
  under `artifacts/videos`.
- A separate playback copy under `apps/preview-web/artifacts/videos`, so the server
  does not need access to the repository root.
- A disposable source recording and measured narration/caption timeline in the
  job directory. Existing exports are preserved; repeated runs use unique names.

## Recording scope and safety

The movie demonstrates markets/watchlists, chart ranges/types, depth/tape, linked
and independent windows, confirmed paper orders, positions/P/L/margin assumptions,
overview/workspace, the spatial model, and pause/outage/restart protection.

It captures only an isolated headless Chrome profile, never the owner's desktop,
open browser tabs, or saved watchlist. For illustration the recording script
reviews and confirms four fictional orders: buy 8 ES, sell 2 NQ, buy 2 CL, and buy
1 GC. It shows a closing review and cancels it, and cancels a session restart.
Those positions exist only in the disposable recording session. The interactive
tour itself never places orders.

Every price and financial parameter is synthetic. Network routes are restricted
to the loopback preview, and no credentials, private files, customer accounts,
broker services, cloud renderer, or external asset host are used. Nothing uploads.
Calendar, education workflows, voice search, and live connections remain future
scope, rather than being presented as completed demo features.

## Validation

The current automated suite contains 44 model/packaging/film unit tests, 36 browser
journeys, and 18 bundled Chrome/WebKit journeys. The 3D additions cover bounded
camera math, DOM/ledger reuse, window movement, focus and Escape, tour safety,
mobile/compact layouts, restoration under the existing CSP, and measured captions.
All **98 tests passed** on Windows for this delivery.

The recorder verifies its scripted paper state, rejects browser errors and external
requests, then fully decodes the MP4 and checks resolution, frame rate, duration,
H.264/AAC streams, and audible narration levels. Captions share the measured speech
timeline and use explicit 1080p typography.

The completed export passed full decoding, audio/format/duration checks, and actual
Chrome playback with audio and video frames decoded. Review covered desktop and
mobile 3D views, the order dialog, and the subtitled video poster/storyboard. The
recording reported zero browser errors and zero external requests; the playback
copy matches the original MP4 byte-for-byte.

Windows browser and video checks do not validate native Swift compilation, Xcode,
Apple Simulator, gaze/pinch, comfort, VoiceOver, or physical headset appearance.
Those still require the [Mac/device validation path](visionos-simulator.md).
