# agent-device on a physical iPhone — setup guide & painpoints

How to get `agent-device` driving an Expo dev build on real hardware, and the traps to
know when building Expo/RN apps with AI agents. Everything here was hit for real in this
project; FRICTION-LOG.md has the war stories.

---

## Part 1: One-time setup for a physical iPhone

agent-device automates a phone by installing an **XCUITest runner app** on it. The runner
must be code-signed with *your* Apple team, and the shipped project hardcodes Callstack's
team/bundle IDs, which you can't sign
([agent-device#145](https://github.com/callstack/agent-device/issues/145)). That's what
most of this setup works around.

### Prerequisites

- Phone plugged in via USB, "Trust This Computer" accepted.
- **Developer Mode** on the phone: Settings → Privacy & Security → Developer Mode → on
  (requires a reboot).
- An Apple team ID. A free account works. Find yours in Xcode → Settings → Accounts, or
  in your app's build settings as `DEVELOPMENT_TEAM`.

### Steps

1. **Enable dev-tools access on the Mac** (needs a real TTY — run it yourself, agents
   can't sudo):

   ```bash
   sudo DevToolsSecurity -enable
   ```

2. **Set the signing overrides in `~/.zshrc`:**

   ```bash
   # agent-device: sign its XCUITest runner with my team instead of Callstack's.
   export AGENT_DEVICE_IOS_TEAM_ID="<your DEVELOPMENT_TEAM>"
   # Must be globally unique — the default is already claimed by another team.
   export AGENT_DEVICE_IOS_BUNDLE_ID="com.<you>.agentdevice.runner"
   ```

   Put these in `~/.zshrc`, **not** in a repo-level tool like mise. The daemon (next
   step) reads env at *its* spawn, so per-directory env is invisible to it.

3. **Restart the agent-device daemon.** This is the step everyone misses. agent-device
   runs a background daemon on the Mac that builds and installs the runner, and it only
   sees env vars that existed when *it* started. Exporting and re-running commands
   silently keeps using Callstack's IDs.

   ```bash
   pgrep -lf 'agent-device.*daemon'   # find the pid
   kill <pid>                          # `agent-device daemon stop` may refuse
   ```

   The daemon restarts automatically on the next command, now with your env.

4. **First run.** Open your app on the phone through agent-device:

   ```bash
   agent-device devices                # confirm the phone shows: booted=true
   agent-device open <your.bundle.id> --device "<Phone Name>" --foreground --session phone
   ```

   The first run builds and installs the runner on the phone (slow, minutes). It stays
   installed as `com.<you>.agentdevice.runner.uitests.xctrunner`; later runs are fast.

---

## Part 2: The daily driving loop

```bash
agent-device open <bundle.id> --device "<Phone Name>" --foreground --session phone
agent-device snapshot -i --session phone        # AX tree with @refs
agent-device press @e12 --settle --session phone
agent-device type "8.50" --session phone        # appends to the focused input
agent-device screenshot out.png --session phone
agent-device metro reload --session phone       # reload JS after an edit
agent-device close --session phone              # ends the session
```

Rules that save time:

- **Targets are `@refs`, `key=value` selectors, or raw coordinates.** A bare string like
  `press "Save"` is `INVALID_ARGS`.
- **Coordinates are points, screenshots are pixels.** On a 3x phone:
  `point = pixel ÷ 3`. Check the screenshot dimensions against the device's point size.
- **`close <bundle.id>` ends the whole session**, not just the app. Reopening without
  `--device` may silently target a simulator instead of the phone. Always pass
  `--device` when reopening.
- A quick `swipe` fling does **not** trigger pager gestures; slow drags do.

---

## Part 3: Automation gotchas (agents *and* humans hit these)

1. **Bottom-sheet content can be invisible to the accessibility tree.** gorhom
   Bottom Sheet marks its container `accessible`, collapsing all children into one
   "Bottom Sheet" node. No refs, no selectors — automation inside the sheet is
   coordinates-only, from a fresh screenshot.

2. **Coordinates go stale the moment the keyboard changes.** Switching fields swaps
   keyboard/accessory-bar height, and `keyboardBehavior="interactive"` shifts the whole
   sheet 20–40pt. In this project, two "taps on the save button" measured from an old
   screenshot landed on the backdrop — which *dismisses* the sheet. That looks identical
   to a successful save. **Re-screenshot after every focus change, and verify by data,
   never by "the dialog closed".**

3. **AX frames inside pagers can be wrong.** Refs for content inside `PagerView`
   resolved to coordinates overlapping other views. When refs act weird, fall back to
   screenshot + points.

4. **The simulator lies about Liquid Glass.** Tint, rims, and refraction render
   differently on hardware. Any glass/material UI must be checked on the phone.

---

## Part 4: Expo/RN painpoints for future AI-agent projects

### Know your rebuild tiers

| Change | Needed action |
|---|---|
| JS/TS edit | Fast refresh (automatic) |
| Babel/Metro config, env | Restart Metro (`npx expo start -c` if weird) |
| New native module, SDK upgrade, plugin change | Full native rebuild (`npx expo run:ios`) |

Builds are **per destination**: a simulator build does not update the phone. A dev
client that crashes right after downloading the bundle usually means the *binary* is
stale — it lacks a native module the JS now imports. Rebuild for that destination.

### Caches lie at three layers

1. **Metro transform cache** — version-mismatch errors after upgrades: `expo start -c`.
2. **CocoaPods vendored files** — `npm install` deletes files that pods copied in
   (expo-sqlite's vendored sqlite3). Run `npx pod-install` after installs. If a local
   pod conflicts with the lockfile, delete `ios/Pods` + `Podfile.lock` and rerun —
   `--repo-update` does not help local path pods.
3. **Shared clang ModuleCache** (`~/Library/Developer/Xcode/DerivedData/ModuleCache.noindex`)
   — can stay poisoned even after deleting the project's DerivedData. Symptom: the same
   67 linker/compile errors survive every "clean". Delete the module cache directory.

### The SwiftUI hosting doctrine (the #1 recurring bug source)

SwiftUI views hosted in RN (`@expo/ui` Host, MenuView, Chart, Picker) mis-measure and
mis-anchor inside anything that **scrolls, pages, or animates** — including bottom
sheets and keyboard avoidance. Four separate components broke this way here.

**Rule: hosted SwiftUI only as fixed, non-moving overlays** (a floating button, a static
bar). Inside scrollers/sheets/pagers, use RN equivalents or native *non-hosted* APIs:
`ActionSheetIOS`, `react-native-svg`, `@react-native-community/datetimepicker`.

### Native components keep positional state your React state doesn't know about

A `UIPageViewController` holds a page *number*. If async data (storage hydration)
prepends items to the page list, page 0 silently changes meaning and no selection event
fires. Header said "August", page showed May — and manual chevron taps masked it by
resyncing as a side effect. After any change to a native component's item list, re-sync
it imperatively (`setPageWithoutAnimation`).

### RN touch APIs have sharp edges

- `Pressable` overrides your `onStartShouldSetResponder` — non-rectangular hit areas
  need the raw responder system.
- Responder `locationX/Y` are relative to the **deepest view hit**, not your responder
  view. Child text intercepting a tap made "tap the chart" fail only in the middle.
  Wrap decorative children in `pointerEvents="none"`.

### Docs lag the SDK

The vendored type definitions are the source of truth
(`node_modules/expo-router/build/react-navigation/native-stack/types.d.ts`), not the
docs site. `scrollEdgeEffects` is undocumented; `headerLargeTitle` is silently dead
(it's `headerLargeTitleEnabled` now). When an agent claims a prop doesn't exist, grep
`node_modules` before believing it.

### Working away from home Wi-Fi

`npx expo start --tunnel` is broken: the bundled ngrok agent (2.3.x) is EOL and servers
drop it. Options: phone hotspot, Tailscale, or your own ngrok v3 pointed at port 8081.

### Working with AI agents specifically

- **Demand verification by data.** "The sheet closed" proved nothing twice in this
  project. The item existing in the list did.
- **Make the agent state how to verify its claims** — the debugging finding is only as
  good as the reproduction steps.
- Keep a friction log. Half of these painpoints were rediscovered from it.
