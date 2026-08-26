# Expo / React Native friction

Problems from building Ledger that the framework could plausibly have prevented,
detected, or documented. Each item: what happened, and what would have made it easier.
Full reproduction details live in FRICTION-LOG.md. Ordered roughly by time lost.

---

## Silent staleness — the #1 theme

The worst debugging sessions all shared one shape: **something was stale, and nothing
said so.** Every one of these produced a "my change does nothing" mystery.

1. **Dev client keeps running a cached bundle after its Metro is replaced.** Start a
   second `expo run:ios` (new Metro takes :8081) and already-running apps silently keep
   the old bundle; `metro reload`-style messages go to the new server and reach nobody.
   *Wanted:* the dev client showing a "disconnected / bundle may be stale" indicator, or
   reconnecting to a same-port Metro.
2. **`expo run:ios` doesn't re-run prebuild.** Change the app icon, rebuild, ship the old
   icon — no warning. Asset-catalog inputs are only read at `prebuild`.
   *Wanted:* run:ios fingerprinting prebuild inputs (icon/splash/plugin config) the way
   it fingerprints dependencies.
3. **`npm install` breaks expo-sqlite's vendored sources and the pod-sync check can't
   see it.** The CLI decides "pods are in sync" by hashing package.json dependency maps,
   so wiping node_modules (`npm ci`, plain installs) silently skips the pod install that
   would restore vendored files. 67 baffling Swift errors.
   *Wanted:* fingerprint node_modules state, not just package.json — or document
   "run pod-install after any npm install" in the local-development guide (it appears
   nowhere).
4. **Native screen options don't fast-refresh** (`scrollEdgeEffects`,
   `headerLargeTitleEnabled`) — they apply on the next full restart, so a working prop
   looks dead.
   *Wanted:* a dev-mode warning that a changed native option needs a restart.
5. **Stale device binary crashes with no message.** JS from Metro requires a native
   module the installed binary predates → instant crash to home screen, no red box.
   *Wanted:* the dev client comparing the bundle's native-module expectations against
   the binary and showing "rebuild required" instead of dying.

## expo-widgets

6. **`containerBackground` adoption is broken on hardware.** The changelog removed the
   hardcoded native background "in favor of the @expo/ui modifier" — but a widget using
   that modifier renders "Please adopt containerBackground API" on a physical device.
   Three layers of leniency hide it: the simulator never enforces, the device's widget
   *gallery* never enforces, and WidgetKit archives the old error view across installs.
   Fixing it required patching the generated Swift template — where `Color(.systemBackground)`
   doesn't compile (no UIKit import) and the call needs an `#available(iOS 17)` guard
   because the extension targets 16.4.
   *Wanted:* the template applying `.containerBackground(.background, for: .widget)`
   natively by default (restoring pre-v56 behavior as a fallback).
7. **The `'widget'` directive silently drops app-module imports.** Importing a constant
   from your own theme file compiles fine and throws `ReferenceError` at widget runtime.
   *Wanted:* a build-time error listing what the extracted function may close over.
8. **Widget JS changes need a full native rebuild** (bundle embeds at Xcode build time) —
   no fast refresh, not documented. Combined with #6's masking, iteration is slow and
   blind.
9. **First render is placeholder until the app runs once** (layout + props are written to
   the app group by the app at runtime). Not documented; the redacted placeholder is easy
   to misread as a bug.

## @expo/ui (hosted SwiftUI)

10. **Hosted SwiftUI views mis-measure inside anything that scrolls, pages, or
    animates.** Four separate components shipped and were replaced: Picker (mis-anchored
    in the animating sheet), Chart (shrank under the header; desynced in a pager),
    MenuView (trigger stretched — it's a *nested* host), glass Button (sizing only
    responds to `controlSize`; `frame`/`padding` inert; modifier order silently
    matters).
    *Wanted:* documentation stating the safe envelope ("fixed, non-scrolling chrome
    only"), because each failure looks like an app bug, not a hosting limitation.
11. **Simulator does not render Liquid Glass faithfully** — `tint()` fills the material
    on hardware but only the glyph in the simulator.
    *Wanted:* a docs warning that glass work must be verified on device.
12. **UIKit context-menu previews can masquerade as Liquid Glass layout bugs.** The
    category selector's dismiss glitch was not RN layout: a red diagnostic
    `UIPreviewParameters.backgroundColor` proved it was the `UIContextMenuInteraction`
    targeted preview animating back to the trigger. A clear background is insufficient;
    the preview also needs `visiblePath = UIBezierPath(rect: .zero)` so UIKit has no
    source snapshot to draw. Patch-package fix; native rebuild required.

## expo-router / react-navigation vendoring

13. **`useHeaderHeight` isn't exported** from expo-router's public entry — the working
    import is the internal vendored path `expo-router/build/react-navigation/elements`.
14. **The docs lag the vendored types**: `scrollEdgeEffects` exists and works but appears
    on no docs page; `headerLargeTitle` is silently dead (renamed
    `headerLargeTitleEnabled` — no deprecation warning). The vendored `types.d.ts` is the
    only source of truth.
14. **The dev client swallows custom-scheme `Linking` events.** `getInitialURL()` returns
    null and the `url` event never fires in a dev build; the URL only surfaces as
    expo-router route params. Fine once you know — undocumented and different from
    production behavior.

## CLI & tooling

15. **`expo run:ios` swallows xcodebuild error details** — "2 error(s)" with no error
    text. The actual Swift diagnostics required running bare `xcodebuild | grep error:`.
16. **`expo start --tunnel` is dead** — `@expo/ngrok-bin` pins ngrok agent 2.3.41, which
    ngrok's servers refuse (EOL). The failure message points to ngrok's status page, a
    red herring. No fix by upgrading; `--tunnel` can't use a system ngrok 3.x.

## React Native core

17. **Controlled `TextInput` echoes native edits one frame before React confirms** — any
    value-derived text, prefix, or style flickers at the edges (the `$` prefix saga).
    The workable patterns (prefix always in native text; constant styles; hidden input +
    rendered Text) are all folklore.
18. **`Pressable` silently overrides user responder props** (`onStartShouldSetResponder`
    spread after yours), so non-rectangular hit areas need the raw responder system.
19. **Responder `locationX/Y` are relative to the deepest view hit**, not the responder —
    a tap on child text breaks coordinate math unless the child is
    `pointerEvents="none"`.
20. **RNGH `ReanimatedSwipeable` defaults fight native feel**: overshoot damped 8× (so a
    full-swipe threshold on the exposed translation is unreachable), `friction` scales
    finger-tracking away from 1:1, and there's no full-swipe-to-action API.
21. **Reanimated `exiting` can't scope to an unmount cause** — a delete animation also
    plays when a filter unmounts rows.

---

*Meta-lesson across everything: the simulator passed every one of these; the device
failed five of them (glass tint, menu highlight, menu order enforcement path,
containerBackground, Metro-over-LAN). Hardware verification isn't optional.*
