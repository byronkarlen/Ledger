# Friction Log

Problems hit while building Ledger (Expo SDK 57, iOS 26). Each entry: what broke,
why, and what fixed it. Kept for pattern-spotting, not for blame.

---

## Native builds & caches

### `npm install` silently breaks expo-sqlite
**Symptom:** 67 Swift errors, `cannot find 'exsqlite3_open' in scope`.
**Cause:** expo-sqlite compiles its own SQLite with `ex`-prefixed symbols. Its podspec
copies `vendor/sqlite3/sqlite3.{c,h}` into the pod during `pod install`. Any `npm install`
re-extracts the package and deletes those copies. `expo run:ios` decides whether to re-run
pod install by fingerprinting dependency *versions*, which hadn't changed — so it built
against a broken pod.
**Fix:** `npx pod-install`.
**Exact mechanism** (from `expo/node_modules/@expo/cli/build/src/utils/cocoapods.js`):
`maybePromptToSyncPodsAsync` skips pod install unless `Podfile.lock`/`Pods/` are missing
or `hasPackageJsonDependencyListChangedAsync()` returns true — and that compares a **hash
of package.json's `dependencies`/`devDependencies` maps** against a cached copy. So:
- Version strings change (`expo install --fix`) → hash differs → **pods install
  automatically**; running `pod-install` first is redundant.
- `node_modules` changes without package.json changing (plain `npm install`, `npm ci`,
  wiping node_modules) → hash identical → **pods silently skipped**. This is the gap that
  produced the 67 errors.
**Docs gap:** `pod install` is never mentioned in
[Create a debug build locally](https://docs.expo.dev/guides/local-app-development/); it
lists rebuild triggers as "after adding a native library, or after modifying a config
plugin". The hash-based skip is only visible in CLI source.

### `pod install` fails on a transitive Expo module after an SDK upgrade
**Symptom:** after `expo install --fix`, the auto pod install fails:
```
CocoaPods could not find compatible versions for pod "ExpoFileSystem"
It seems like you've changed the version of the dependency `ExpoFileSystem` and it
differs from the version stored in `Pods/Local Podspecs`.
```
Deleting `ios/Podfile.lock` and re-running fixed it.
**Cause:** Expo modules are **development pods** — path-based
(`:path => ../node_modules/...`), so their version is read from the package's
package.json at install time and cached in `ios/Pods/Local Podspecs/*.podspec.json`.
`Podfile.lock` pins the previously resolved version. `pod install` is deliberately
reproducible: it installs exactly what the lockfile says and refuses to silently re-pin a
local pod whose version moved. Upgrading `expo` bumped **expo-file-system (57.0.5)**,
which is *not* a direct dependency — nothing in package.json mentions it — so the version
moved underneath while the lockfile still pinned the old one.
**Why Expo's own retry didn't help:** it falls back to `pod install --repo-update`, but
`--repo-update` refreshes *remote* spec repos (the CDN), not local path pods.
**Fixes, narrowest first:**
- `pod update ExpoFileSystem --no-repo-update` — re-pins just that pod (CocoaPods'
  own suggestion).
- Delete `ios/Podfile.lock` → full re-resolution. Cheap here because **`/ios` is
  gitignored** (continuous native generation), so the lockfile is a disposable build
  artifact. In a bare project with `ios/` committed, deleting it discards reproducibility
  and is a bigger call.
**Lesson:** `expo install --fix` rewrites *direct* dependency versions in package.json,
but transitive native modules move silently. The lockfile notices; the error names a
package you never installed yourself.

### Poisoned clang module cache
**Symptom:** identical 67 errors *after* the fix above, and after deleting the project's
DerivedData.
**Cause:** `~/Library/Developer/Xcode/DerivedData/ModuleCache.noindex/` is shared across
all projects and is not cleared by a project clean. It held an ExpoSQLite module compiled
while the header was missing, so it had baked in the *system* `sqlite3.h`. Clang validates
a cached module against the files it recorded as inputs; the restored file was never an
input, so the stale module validated as fresh forever.
**Fix:** `strings -a <pcm> | grep exsqlite3_open` across cached `.pcm` files found the one
bad copy; deleting it fixed the build.
**Lesson:** when an error survives a real fix, ask which cache's validation can't see it.

### Metro cache vs Babel plugin version
**Symptom:** after `expo install --fix`, red screen: "Mismatch between JavaScript code
version and Worklets Babel plugin version (0.10.1 vs 0.10.0)".
**Cause:** Metro's transform cache keys on file content, not on plugin version, so it
served transforms produced by the old worklets plugin.
**Fix:** `npx expo start -c`.

### `expo start --tunnel` is broken — bundled ngrok agent is end-of-life
**Symptom:** `CommandError: failed to start tunnel`, alternating `session closed` and
`remote gone away`. The error points at ngrok's status page, which is a red herring.
**Cause:** Expo's tunnel uses `@expo/ngrok`, which pins `@expo/ngrok-bin@2.3.42` →
**ngrok agent 2.3.41**. ngrok's version policy cuts off agents older than 3.1, so the
server accepts TCP/TLS then drops the session mid-handshake.
**Not fixable by upgrading:** `@expo/ngrok@latest` is 4.1.3 and still pins the 2.3.42
binary; `@expo/ngrok-bin` has no newer release. `--tunnel` uses the bundled agent
regardless of any system ngrok.
**Ruled out first:** ngrok status API said "All Systems Operational"; DNS resolved and
TLS to `connect.ngrok-agent.com:443` returned `CONNECTED` — so neither an outage nor a
blocked network.
**Verify:**
```bash
$(find /opt/homebrew/lib/node_modules/@expo/ngrok -name ngrok -type f | head -1) version
# -> ngrok version 2.3.41
```
**Workarounds** (needed on public/coworking Wi-Fi, where client isolation blocks
phone → laptop LAN):
- Phone's personal hotspot, Mac joins it — zero setup, both ends on one network.
- Tailscale on both devices, point the dev client at the Mac's tailnet IP — private, no
  public exposure, survives network changes.
- Own ngrok 3.x (`ngrok http 8081`), then enter the URL manually in the dev client
  launcher. `--tunnel` cannot be made to use it.

### Dev client crashes after downloading the bundle (stale native binary)
**Symptom:** on a physical device the dev client shows "Downloading 22%…", finishes, then
the app dies straight to the home screen. No red box — the crash happens as the bundle is
evaluated, before RN's error UI exists.
**Cause:** the JS bundle is served fresh from Metro, but the **app binary on the device is
whatever was last built for it**. Adding a native module (here `react-native-svg` for the
donut chart) makes the new JS `require` a native module the old binary doesn't contain →
hard crash, not a JS error.
**Evidence that pins it:**
```
Debug-iphoneos/Ledger.app    built 2026-08-12 06:54   <- the phone
Debug-iphonesimulator/...    built 2026-08-13 07:11
node_modules/react-native-svg installed 2026-08-13 07:08
RNSVG in Debug-iphoneos build products: 0
```
The device build predates the dependency; only the simulator was rebuilt.
**Fix:** rebuild for the device (`npx expo run:ios --device`). Metro serving a newer
bundle never implies the device binary can run it.
**Lesson:** "needs a rebuild" is **per destination**. Rebuilding the simulator does
nothing for the phone, and the failure mode is a silent crash rather than a useful error.

### Fast refresh doesn't apply native screen options
Header config (`headerLargeTitleEnabled`, `scrollEdgeEffects`) only takes effect after a
full app restart. Several minutes lost concluding a prop "did nothing" when it hadn't
been applied yet.

---

## @expo/ui SwiftUI hosting — the recurring theme

Four separate bugs, one root cause: a SwiftUI view hosted inside React Native does not
behave like an RN view during layout, animation, or scrolling.

### 1. Picker mis-anchors during animation
**Symptom:** category picker floated ~14pt above its row.
**Cause:** the `Host` lays out while an ancestor is animating (sheet sliding up, keyboard
sliding in) and anchors its content high. `frame()` / `alignment` modifiers don't move it.
**Workaround:** mount only after the sheet settles. Held for the open animation, then broke
again when the keyboard animated.
**Real fix:** replaced the SwiftUI `Picker` with `@expo/ui/community/menu` — native menu,
plain RN anchor. Nothing hosted, nothing to mis-anchor.

### 2. Chart shrinks when scrolled under the header
**Symptom:** donut shrank 300pt → 230pt as it scrolled up; the RN text overlaid on it
stayed put, so the total drifted out of the ring.
**Cause:** SwiftUI reflows the chart to whatever is still visible.
**Attempted fix:** pinning with a `frame()` modifier. Stopped the resize, not the drift.

### 3. Chart desyncs inside a pager
**Symptom:** with swipe-paging added, the donut scrolled *slower* than the rows and
overlapped them.
**Cause:** the hosted view doesn't translate with the scroll content.
**Tried:** horizontal `FlatList`, then Expo's native `PagerView` (a real
`UIPageViewController`). Both broke it identically. A/B with the pager removed proved it
was the pager, not the chart config.
**Real fix:** replaced the SwiftUI chart with an SVG donut (`react-native-svg`). Ordinary
RN views scroll in lockstep by construction.

### 4. Glass button sizing is mostly inert
`frame()` and `padding()` do nothing to an icon-only glass button; only `controlSize`
moves it, and its five values collapse into three:

| value | rendered |
|---|---|
| mini / small | 30px |
| regular | 34px |
| large / extraLarge | 51px |

Measured by pixel-diffing screenshots. Also: **modifier order matters** — `frame()` after
`buttonStyle()` leaves a small circle inside a large box; the label must be sized before
the glass wraps it.

**Takeaway:** `@expo/ui` is fine for static, non-scrolling chrome. Anything inside a
scroller, pager, sheet, or animated container should be RN. Three of four SwiftUI
components in this app were ultimately replaced (picker, chart, menu); only the fixed
glass + button survived.

### Two Liquid Glass APIs that don't match
**Symptom:** the + button had a crisp thin rim; the dots capsule beside it had none.
Same design language, visibly different controls.
**Cause:** they were different APIs. `GlassView` (`expo-glass-effect`) is a raw glass
**material** with no border. SwiftUI's `.buttonStyle(.glass)` (`@expo/ui`) is a glass
**control**, which draws its own rim as a pressable affordance. Neither is wrong; they
just aren't the same component.
**Fix:** build both from `@expo/ui`'s `glassEffect()` modifier inside a
`GlassEffectContainer`. One API → identical rims, and it unlocks Apple's glass
**blending** (nearby glass surfaces merge/separate), which separate `GlassView`s can't do
at all — that's the effect Weather uses.
**Note:** normally a SwiftUI host is a liability here (see the section below), but this
bar is a fixed overlay that never scrolls, pages, or animates — the one context where
hosted SwiftUI is safe.
**Also confirmed:** `tint()` on a *non-prominent* glass button colors the glyph, not the
fill. On `.glassProminent` it fills the background instead.

### `tint()` colors the glass material on device, only the glyph on simulator
**Symptom:** the + button rendered as a clear glass circle in the simulator, but a
**pale blue filled** circle on the phone. Same build, same JS.
**Cause:** `tint(Accent)` alongside `glassEffect()` tints the glass *material*. The
simulator's glass approximation doesn't render that tint; real hardware does.
**Fix:** use `foregroundColor(Accent)` for the glyph and leave the material untinted.
**Lesson:** the simulator does not render Liquid Glass faithfully — tint, rims, and
refraction all differ. Glass work has to be checked on hardware.

### `MenuView` trigger stretches, so iOS highlights the whole row
**Symptom:** on device, the category filter showed a grey rounded band running off the
right edge; the simulator showed none.
**Cause:** `MenuView` takes a `style` prop for its trigger. Left unset, the trigger fills
the available width in a flex row, and iOS paints the menu's press highlight across all of
it. Not a device/simulator difference in rendering — just a difference in whether the
screenshot caught the highlight.
**Fix:** pass `style` to `MenuView` (not to the inner anchor view) and size it to content
(`alignSelf: 'flex-start'`).
**Update — the fix only held outside the sheet.** Inside the bottom sheet on device, both
`alignSelf` and explicit `width`/`height` failed: the band stayed and the label vanished.
`MenuView` is a `Host matchContents` wrapping a SwiftUI `Menu` wrapping an
`RNHostView matchContents` — a *nested* host, measured twice, inside an animated
container. Same root cause as cases 1–3.
**Real fix:** replaced `MenuView` with `ActionSheetIOS` and a plain RN `Pressable`
trigger. Still a fully native picker UI, nothing hosted.
**Epilogue:** the anchored-menu look came back later via `@react-native-menu/menu`,
which attaches a `UIMenu` to a plain UIKit view — no SwiftUI hosting. Verified clean on
device in the same sheet where the hosted version broke. The doctrine holds: the problem
was never "menus", it was *hosted SwiftUI* triggers.
**Epilogue 2 — upward menus display reversed.** A menu that opens upward (anchored near
the keyboard) shows its items bottom-up, so "Other" landed on top. iOS 16's fix is
`preferredMenuElementOrder = .fixed` — but setting it on the `UIButton` did nothing,
because the library overrides `contextMenuInteraction(_:configurationForMenuAtLocation:)`
and presents its own `UIContextMenuConfiguration`, which bypasses the button property.
The property has to be set on the *configuration* in that override. Patched via
patch-package (`patches/@react-native-menu+menu+2.0.0.patch`, applied on `postinstall`);
needs a native rebuild per destination.

---

## Navigation & header

### `contentInsetAdjustmentBehavior="automatic"` is fragile
iOS applies the nav-bar inset only to the screen's *primary* scroll view. Broke twice:
- **Transactions:** filter row and first section header hid behind the header. Fixed by
  moving the filter into the list and adding the prop.
- **Spending:** wrapping pages in a pager pushed the ScrollView a level deeper, so the app
  opened looking already-scrolled. Fixed with an explicit `paddingTop` from
  `useHeaderHeight()`.

`useHeaderHeight` is **not exported from expo-router's public entry** — it has to be
imported from the vendored copy at `expo-router/build/react-navigation/elements`, an
internal path that could move on upgrade.

### Undocumented / renamed header options
- `scrollEdgeEffects` (iOS 26 soft-fade under the header) appears in no Expo docs page.
  Found by grepping `expo-router/build/react-navigation/native-stack/types.d.ts`.
- `headerLargeTitle` is **deprecated and silently does nothing**; the working prop is
  `headerLargeTitleEnabled`. No warning, no error — it just has no effect.
- Docs note that `headerBlurEffect` + `scrollEdgeEffects` conflict on iOS 26.
- `scrollEdgeEffects` only produces a visible fade when the header is transparent.

**Lesson:** the vendored `types.d.ts` is the only source of truth for what this SDK
version actually accepts. Expo's docs are a curated subset and lag the SDK.

### Pager positions silently remap when async data prepends pages
**Symptom:** cold launch showed "August 2026" in the header but **May's data** in the
page. Chevrons and swiping looked fine, which hid the bug for days.
**Cause:** storage hydration is async, so the pager first mounts with one page (the
current month) at `initialPage=0`. When earlier months load they are *prepended*, and
`UIPageViewController` keeps its numeric position — page 0 now means the earliest month.
No `onPageSelected` fires, so state and pager disagree. The chevrons masked it because
they call `setPage()` and resync as a side effect.
**Fix:** an effect keyed on `months.length` that calls `setPageWithoutAnimation(index)`.
Keyed on length only — keying on the month would cancel the chevrons' slide animation.

---

## Bottom sheet

- **Modal vs plain sheet APIs differ:** `present()`/`dismiss()` vs `expand()`/`close()`,
  `onDismiss` vs `onClose`. `containerComponent` exists only on the modal.
- **Backdrop couldn't dim the header** — the native stack header sits above screen
  content. `FullWindowOverlay` covers it, but **SwiftUI views don't render inside a
  FullWindowOverlay** (the category picker vanished). Settled on a transparent RN `Modal`,
  which also unmounts content on close, so form reset and keyboard dismissal came free.
- **Gestures don't cross into a modal's view hierarchy** — the sheet needs its own
  `GestureHandlerRootView`.
- **Sheet occasionally reports "closed" mid-mount**, tearing itself down; needed a guard
  that retries opening if it never opened.

---

## Forms & input

- **Controlled `TextInput` flickers.** Any width that depends on the value lags the native
  text by a frame. Fixed permanently with a fixed-width field — no layout change, nothing
  to flicker. A rejected character still paints for one frame before the sanitizer removes
  it; that's inherent to JS-side validation.
- **`decimal-pad` has no return key on iPhone** (iPad's does). Needed an
  `InputAccessoryView` bar for "Next" to move to the title field.
- **`Pressable` can't do non-rectangular hit testing.** It spreads its own Pressability
  handlers *after* your props (`Pressable.js:336`), so `onStartShouldSetResponder` is
  overridden. Circular tap target on the donut required dropping to the responder system.
- **Responder `locationX/Y` are relative to the deepest view hit, not the responder.**
  Taps on the "Total spend" text inside the donut's circular tap area were measured in the
  *text's* frame, failed the circle check, and were declined — so tapping the middle of
  the chart did nothing while the ring worked. Fix: wrap the labels in a
  `pointerEvents="none"` view so the tap area is always the touch target.
- **`GlassView` with `isInteractive` swallows touches** natively, so a wrapping
  `Pressable`'s `onPress` never fires.
- **Opacity pressed-feedback breaks swipe actions.** A row inside a Swipeable that dims
  via `opacity` goes translucent on the swipe's touch-down, letting the red delete layer
  bleed through as a pink flash. Pressed feedback on swipeable rows must stay opaque —
  swap the background color instead. (Also: `friction={2}` halves the row's tracking
  speed and feels sluggish; the system swipe actions track the finger 1:1.)
- **`ReanimatedSwipeable` damps overshoot 8× by default.** The `translation` passed to
  `renderRightActions` is post-friction: past the open snap it crawls, so a
  full-swipe-to-delete threshold at half the screen is unreachable. `overshootFriction={1}`
  makes translation track the finger — which is also how Reminders feels.
- **Never commit a swipe-delete mid-drag.** Deleting while the finger is still down lets
  the touch fall through to the row that slides up underneath — it opened that row's edit
  sheet. Arm a flag on the UI thread when the drag passes the threshold; commit in the
  release callback (`onSwipeableWillOpen`). Pair the removal with reanimated's
  `SlideOutLeft` exiting (row flies off) + `LayoutAnimation.configureNext` (siblings
  close the gap).

---

## Tooling notes

- **agent-device on a physical iPhone — works, but needs three things.** Its XCUITest
  runner must be code-signed for your device, and the runner project ships Callstack's
  team and bundle IDs, which nobody else can sign
  ([issue #145](https://github.com/callstack/agent-device/issues/145)). Recipe:
  1. `sudo DevToolsSecurity -enable` — needs a real TTY, so run it in your own terminal.
  2. Set both env vars (team ID from your app's `DEVELOPMENT_TEAM`, bundle ID unique to
     you — the generic default is already claimed by another team):
     ```bash
     export AGENT_DEVICE_IOS_TEAM_ID=<YOUR_TEAM_ID>
     export AGENT_DEVICE_IOS_BUNDLE_ID=com.<you>.agentdevice.runner
     ```
  3. **Restart the daemon.** This is the non-obvious part: agent-device runs a background
     daemon that builds the runner, and it only sees env vars present when *it* started.
     Exporting per-command silently does nothing — the build kept using Callstack's IDs.
     `agent-device daemon stop` refused ("PID identity could not be verified"), so
     `kill <pid>` from `pgrep -f agent-device.*daemon`; it restarts on the next command.
  Persisted in `~/.zshrc`, because the daemon reads env at *its* spawn, not per `cd` —
  repo-level `mise.toml` values would be invisible to a daemon started elsewhere. First
  run after this builds and installs the runner, so it's slow; later ones are fast. The
  runner then lives on the phone as `com.<you>.agentdevice.runner.uitests.xctrunner`.

- `agent-device`'s quick swipe fling doesn't trigger paging gestures; real drags work.
  Cost real time chasing a "bug" that wasn't one.
- **`press "some label"` isn't a thing** — a bare string is `INVALID_ARGS`. Targets are
  `@refs` from `snapshot -i`, `key=value` selectors, or raw point coordinates
  (physical px ÷ scale).
- **gorhom Bottom Sheet content is invisible to the accessibility tree** — the sheet
  container is marked `accessible`, so its children collapse into one "Bottom Sheet" node.
  No refs, no selectors; automation inside the sheet is coordinates-only.
- **Sheet coordinates go stale when the keyboard changes.** Switching fields swaps the
  keyboard/accessory bar height, and `keyboardBehavior="interactive"` shifts the whole
  sheet ~20–40pt. Two "taps on ✓" measured from an old screenshot landed on the backdrop —
  which *dismisses* the sheet, indistinguishable from a successful save until the data is
  checked. Re-screenshot after every focus change; verify by data, not by "the sheet
  closed".
- **AX frames for pager content are unreliable** — refs inside `PagerView` pages resolved
  to coordinates overlapping the chart and taps landed wrong. Screenshot + points worked.
- Pixel-measuring screenshots (a small PNG reader script) settled several
  "does this actually change anything?" questions that eyeballing couldn't.
