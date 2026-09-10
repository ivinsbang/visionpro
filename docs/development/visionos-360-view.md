# Native 360° market desk

The owner's simulator report identified a presentation gap: the bundled dashboard
and its web **3D desk** were drawn inside one flat window. The requested correction
adds a native SwiftUI `ImmersiveSpace` with RealityKit attachments around the viewer.
This extends the existing Step 4a presentation; later financial features remain deferred.

## Open the room on the Mac

1. Copy the updated repository, including the generated `MarketDashboard` resources,
   to the Mac. Rebuild and run `CMESpatialMarketCenter` with Xcode 26.3 and the
   visionOS 26.2 simulator runtime. Reloading the old app does not install this change.
2. Wait for **Ready · No CME connection**, then select **Enter 360° view** in the
   native toolbar above the dashboard. The launch window closes after the room opens.
3. Right-click and drag in Simulator to turn the camera. Turn left, right, and all
   the way around to see the screens behind you. This changes the simulated viewing
   direction; dragging the dashboard itself operates its controls. Apple demonstrates
   this camera interaction in [its simulator walkthrough](https://developer.apple.com/videos/play/wwdc2024/10066/?time=375).
4. Use **Bring interactive desk here** on any surrounding screen to bring the
   actual working desk to that screen's position. Use **Reset room arrangement**
   on the desk to restore the starting arrangement.
5. Choose **Return to window** on the desk or any surrounding screen. The app
   reopens its main window and moves the same dashboard back into it. The session,
   paused feed, watchlist, paper balance, positions, and fills are retained.

The starting arrangement is a six-screen ring with 60° spacing and a 2.8 m radius.
Screens face inward and remain at fixed positions in the room while you look around.

| Direction from the starting view | Screen |
| --- | --- |
| Front, 0° | Existing interactive dashboard, including paper tickets and all built web pages |
| Right, 60° | Selected market, last 60 synthetic closes, and generated prints |
| Right/rear, 120° | Selected market's eight-level synthetic depth |
| Behind, 180° | Paper equity, P/L, and open positions |
| Left/rear, 240° | Illustrative margin, exposure, and latest paper fills |
| Left, 300° | Saved watchlist, including contracts hidden by a search on the desk |

The five surrounding summaries are read-only. Orders, review/confirmation,
watchlist edits, feed changes, and resets use the existing interactive dashboard.
The native toolbar's **Native volume** is still the small neutral model. The web
header's **3D desk** still controls its CSS presentation within the dashboard.

## Session and data behavior

`DashboardSession` retains one `WKWebView` at app scope. The window and the immersive
attachment use separate UIKit containers, reparenting that same web view without
navigation or a new engine. Old container teardown cannot stop or remove the view
from its new host. Reloading or quitting the app resets its memory-only state;
entering, arranging, and leaving the room do not reload it.

`hosts/visionos-surround.js` supplies a versioned, read-only projection of values
already displayed by the dashboard, plus the existing selected market's close
series. It contains no ledger, market generator, financial calculations, or commands.
Only the native bundle exposes `readNativeDeskSnapshot`. While the room is open,
the native session reads that function about once per second through WebKit.
There is no script-message handler or native order bridge. The full account and
order rules remain in `packages/TradingSimulation`.

Every surrounding screen shows synthetic provenance and the original generated
UTC timestamp. Paused or interrupted data retains its timestamp. Failed or delayed
display updates show a held-values label. Native decoding rejects unsupported
versions, incomplete panels, invalid timestamps, and malformed table dimensions.
The existing file-only navigation policy, nonpersistent data store, and network
restrictions remain in effect.
The snapshot reader also checks quote age with the existing shared freshness rule,
so a successful native read cannot label an old quote fresh while WebKit's timer is
suspended.

The scene uses the attachment-builder APIs available at the visionOS 2.0 deployment
target, following Apple's [immersive scene lifecycle](https://developer.apple.com/documentation/visionos/presenting-windows-and-spaces)
and [SwiftUI/UIKit attachment example](https://developer.apple.com/documentation/realitykit/combining-2d-and-3d-views-in-an-immersive-app).
Reload confirmation appears inside the dashboard surface because modal SwiftUI
presentations from attachments were added in [visionOS 26](https://developer.apple.com/documentation/visionos-release-notes/visionos-26-release-notes).

## Validation

Windows verification on 2026-09-10:

| Check | Result |
| --- | --- |
| Model, ledger, packaging, and film unit tests | 44 passed |
| Existing browser journeys | 36 passed |
| Generated offline dashboard in Chrome and WebKit | 32 passed, including four surround scenarios in each browser |
| Native project object graph, source membership, scene manifest, UTF-8 | Passed for 18 app sources, 3 app-test sources, and 1 UI-test source |
| Native validation script | Correctly refused this Windows host; Apple-silicon Mac and Xcode required |

`npm run build:visionos` regenerated the resource bundle; its deterministic check
passed. The full browser run required stopping its own lingering Python test server
after the tests finished; the runner then exited successfully. A final unit and
offline-bundle run passed after adding the suspended-timer freshness check.

Windows checks exercise the shared snapshot projection, offline bundle, and existing
browser workflows. They cannot compile SwiftUI/RealityKit or establish that the
native room renders or accepts input correctly. Native tests are included for
scene cancellation/dismissal, inward-facing room geometry, retained view ownership,
snapshot decoding, and a paused-feed entry/exit UI journey; they must run on a Mac.

On the supported Mac, run `bash scripts/validate-native.sh test` and record the result.
In addition to the [existing smoke test](visionos-simulator.md#simulator-smoke-test):

- Inspect all six screens by turning the simulator camera through a complete circle.
  Confirm their scale, readable orientation, spacing, and vertical placement.
- Select CL, add ZC to the watchlist, and confirm the side screens agree with the desk.
- Review and confirm one paper order, then inspect the position behind you and its
  corresponding fill and illustrative margin on the next screen. Enter/exit twice
  and verify the account and watchlist remain intact.
- Pause and simulate an outage; surrounding timestamps must stay held and clearly
  labeled. Resume and confirm updates return. Inspect scrolling, contract selectors,
  keyboard input, and the paper confirmation dialog within the live attachment.
- Cancel opening if the system offers that option; ensure the window stays usable.
  Test **Return to window**, system dismissal, reopening, and **Bring interactive desk here**
  from a rear screen. Each return must expose a usable desk without another account.
- Check reload cancellation/confirmation and renderer recovery. A deliberate reload
  resets the session; a scene transition must not.

Apple Vision Pro checks for gaze/pinch, VoiceOver, comfort, memory, and performance
remain separate from both Windows tests and Simulator testing.
