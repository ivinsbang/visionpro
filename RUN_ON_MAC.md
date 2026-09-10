# Run the Vision Pro prototype on your Mac

Follow this checklist on your Mac to build and run CME Spatial Market Center in
Apple's visionOS Simulator. You do not need a physical Vision Pro for these steps.

The Windows preflight passed, but the project has not yet been compiled or run in
Apple's Simulator. Your first Mac build is still required to confirm native behavior.
All market data and paper orders are synthetic; the app does not connect to CME.

## 1. Check your Mac

- [ ] Open **Apple menu > About This Mac**.
- [ ] Confirm the chip is **Apple silicon: M1 or newer**, not Intel.
- [ ] Confirm macOS supports **Xcode 26.3**: Sequoia 15.6 through supported Tahoe
  26.x versions. See [Apple's requirements](https://developer.apple.com/xcode/system-requirements).

An Intel Mac cannot run the visionOS Simulator required by this project.

## 2. Install Xcode 26.3

- [ ] Open [Apple's Xcode downloads page](https://developer.apple.com/xcode/resources/).
- [ ] Under **Additional tools**, choose **View downloads**.
- [ ] Sign in with your Apple Account and find **Xcode 26.3**.
- [ ] Download its `.xip` file and double-click it to extract the application.
- [ ] Rename the extracted application to **Xcode_26.3.app**.
- [ ] Move it into **Applications**. Keep any existing Xcode installation separate.
- [ ] Open **Xcode_26.3**, accept the license, and let initial component installation finish.

The commands in this guide assume that Xcode is installed at:

```text
/Applications/Xcode_26.3.app
```

Use version 26.3 for this first run because the repository pins that version, not
because it is the latest Xcode. A paid developer membership is not required to
download Xcode; a free Apple Account is sufficient.

## 3. Install the visionOS Simulator

- [ ] In Xcode, open **Xcode > Settings > Components**.
- [ ] Install **visionOS platform support**.
- [ ] Install the **visionOS 26.2 Simulator runtime**.
- [ ] If 26.2 is not displayed, use **Other Installed Platforms > Add Platforms**,
  select visionOS 26.2, and choose **Download & Install**.
- [ ] Wait for installation to finish before building the app.

See [Apple's component installation guide](https://developer.apple.com/documentation/xcode/downloading-and-installing-additional-xcode-components).

The app's deployment target remains visionOS 2.0. That is different from the 26.2
Simulator runtime; you do not need to change the deployment target.

## 4. Copy the project from Windows

- [ ] Copy the complete `Vision_Pro` source folder onto your Mac's **Desktop**.
- [ ] Preserve the directory structure, including `apps`, `packages`, `scripts`,
  and the root configuration files such as `.xcode-version`.
- [ ] Keep this generated dashboard directory and all its contents:

```text
Vision_Pro/apps/visionos/CMESpatialMarketCenter/Resources/MarketDashboard
```

Do not copy only the `.xcodeproj` folder. The project references local packages
elsewhere in the repository.

You can omit generated `node_modules`, `.cache`, `artifacts`, `.build`,
`DerivedData`, and `xcuserdata` directories. Do not reuse Windows Node dependencies
on macOS if you later work on the web source.

**Node.js, Python, Docker, a Windows server, and CME credentials are not needed to
build and run the included native dashboard.** Internet access is needed to
download Xcode and its components, not by the running dashboard.

## 5. Open the project in Xcode

- [ ] Open **Terminal** on the Mac.
- [ ] Run these commands:

```bash
cd "$HOME/Desktop/Vision_Pro"
export DEVELOPER_DIR="/Applications/Xcode_26.3.app/Contents/Developer"
xcodebuild -version
```

- [ ] Confirm the output starts with **Xcode 26.3**.
- [ ] Open the project using that specific Xcode installation:

```bash
open -a "/Applications/Xcode_26.3.app" \
  "apps/visionos/CMESpatialMarketCenter.xcodeproj"
```

- [ ] Wait for Xcode to finish loading and indexing the project.

If you put `Vision_Pro` somewhere other than Desktop, adjust the `cd` command to
match that location. All commands here are Mac Terminal commands, not PowerShell.

## 6. Build and run

In Xcode's top toolbar:

- [ ] Select scheme **CMESpatialMarketCenter**.
- [ ] Select destination **Apple Vision Pro - visionOS 26.2 Simulator**.
- [ ] Do not select **My Mac**, a physical headset, or a generic build-only destination.
- [ ] Choose **Product > Run**, or press **Command-R**.
- [ ] Wait for the build and the Simulator's first startup to finish.

If the build succeeds, Simulator should open and the app should display:

```text
Offline synthetic desk
Ready · No CME connection
```

The native main window should then contain the CME-style mock dashboard. See
[Apple's run instructions](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices).

## 7. Explore the demo

Use your mouse or trackpad to select controls.

- [ ] Confirm **SYNTHETIC DATA** and **Not a CME feed** are visible.
- [ ] Select different markets and try the charts and watchlist.
- [ ] Open **3D desk > Feature tour**.
- [ ] Try **Paper trading**: review an order before explicitly confirming it.
- [ ] Inspect the resulting fictional position in **Portfolio & risk**.
- [ ] Open **Native workspace** for the companion-window controls.
- [ ] Open **Native volume** for the separate three-panel RealityKit preview.

The financial 3D dashboard remains inside one app window. The native volume is a
neutral model, not a price-driven chart. Actual headset input and comfort still
need separate Vision Pro testing.

Paper balances, positions, and fills are session-only. Reloading the desk resets
them after confirmation; no real orders are placed.

## 8. Run the native tests

After trying the app, run these commands in Mac Terminal:

```bash
cd "$HOME/Desktop/Vision_Pro"
export DEVELOPER_DIR="/Applications/Xcode_26.3.app/Contents/Developer"
bash scripts/validate-native.sh test
```

This runs the package checks and native app/UI tests using the visionOS Simulator.
Simulator validation disables signing and does not require a signing team.
Test results are written under `artifacts` as `NativeTests-*.xcresult` bundles.

To run package checks and build the app/test bundles without launching Simulator:

```bash
bash scripts/validate-native.sh build
```

## If something fails

| Problem | What to do |
| --- | --- |
| Terminal cannot find the project directory | Check where you copied `Vision_Pro` and adjust the `cd` command. |
| Xcode is not version 26.3 | Check the installed application name and the `DEVELOPER_DIR` path. |
| No Apple Vision Pro destination | Confirm Apple silicon hardware and install visionOS platform support plus the 26.2 runtime. |
| Xcode asks for a signing team | Confirm the destination is a Simulator, not a physical or generic device. |
| A local package is missing | Copy the complete source tree and preserve its relative paths. |
| Dashboard resources are missing | Recopy the complete generated `Resources/MarketDashboard` folder from the Windows project. |
| The build fails | Press **Command-5** in Xcode, open the first red error, and copy its full message and file/line. |
| The app builds but the dashboard fails to load | Capture the on-screen message and relevant Xcode console error. |

When requesting help, include the first error, your Mac chip, macOS version,
Xcode version, and selected Simulator runtime. Do not send credentials or signing keys.

## Further details

- [Full Simulator guide and smoke test](docs/development/visionos-simulator.md)
- [Windows preflight record](docs/development/visionos-simulator.md#windows-transfer-preflight-2026-09-09)

The completed Windows checks are not a substitute for the Mac build and Simulator
test results. This guide does not claim that native execution has already passed.
