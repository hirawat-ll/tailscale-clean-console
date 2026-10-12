# Roadmap

Small, high-value improvements — not commitments. Everything here is meant to
stay lightweight: no accounts, no network calls, no build step for the
extension itself.

## Guiding principles

- **Zero-config** — it should work the moment it loads; anything else is opt-in.
- **Local-only** — settings stay in the browser; nothing is sent anywhere.
- **Reversible over confirmed** — prefer undo over modal dialogs.
- **Parity** — `chrome/` and `firefox/` stay identical (`diff` clean).

## Shipped

- Trial/billing banner hidden.
- Machines table as a responsive card grid, grouped Online / Offline with
  live counts.
- Hide any element, or hide a whole device (dropped from the Online / Offline
  totals), with one-click reset.
- Settings (view, hidden elements, hidden devices) auto-saved per-site in
  `localStorage` under `tsc:settings:v1`.
- CI: headless harness for both builds, `web-ext lint`, privacy/parity guards,
  and `v*` tag releases with the store zips attached.
- Store assets consolidated: both builds share a single `assets/screenshots/`
  folder (README + store shots) instead of duplicated per-store copies, and the
  Firefox listing links to the live AMO page.

## Onboarding & first-run

- [x] One-time welcome card on the first visit to Machines: one line per pill
      button, no wall of text.
- [x] Dismiss writes `onboarded: true` into `tsc:settings:v1` so it never
      shows again.
- [x] Contextual hint on the first Hide: "Click a device card to hide the
      whole device."
- [x] Tiny `?` button in the pill to reopen the help card on demand.
- [x] Optional 10-second tour that highlights Grid and the section counts.

## Settings & hidden state

- [ ] Gear button in the pill opening a small settings popover.
- [ ] List hidden devices by name with a per-item "show" action (today the only
      way back is Reset-all).
- [ ] Split Reset: "Show hidden devices" vs "Show hidden elements".
- [ ] Export / import settings as JSON (backup, move between browsers).
- [ ] Optional cross-device sync via `browser.storage.sync`, falling back to
      `localStorage` where unavailable.
- [ ] Choose the default view (grid or list) from settings.
- [ ] Add a schema/version check and prune stale `hiddenDevices` keys on load.

## Extension experience

- [ ] Undo (`Cmd/Ctrl+Z`) for the last hide, plus a toast:
      "Hidden studio-mac-mini — Undo".
- [ ] Toast confirmations so hide/reset are not silent.
- [ ] Keyboard shortcuts: `g` grid/list, `h` hide, `r` reset, `Esc` cancel.
- [ ] Accessible pill: `aria-pressed` on toggles, visible focus rings, and a
      keyboard-operable picker.
- [ ] Hide the pill itself and reopen it with a shortcut, for power users.
- [ ] Respect `prefers-reduced-motion` for the card transitions.
- [ ] i18n scaffold with at least one non-English locale.

## Grid & machines UX

- [ ] Search/filter box in the grid that also updates the Online / Offline
      counts.
- [ ] Sort menu (name, last seen, status).
- [ ] Collapse the Offline section, or hide offline devices by default.
- [ ] Keep Tailscale's own "N machines" count in sync with hidden devices.
- [ ] Compact / density toggle.
- [ ] Copy machine name or IP straight from the card.
- [ ] Empty state when everything is hidden: "3 devices hidden — Show all".
- [ ] Remember scroll position across grid/list toggles.

## Robustness & performance

- [ ] Coalesce MutationObserver churn with `requestIdleCallback` (today it is a
      100 ms debounce).
- [ ] Add selector fallbacks in case Tailscale renames `.tb` or restyles the
      status dot (`bg-green*`).
- [ ] Notice when a stored selector stops matching anything and offer a reset.
- [ ] Unit-test `deviceKey` and `selectorFor` without the DOM fixture.
- [ ] Guard against rows that gain/lose cells mid-render (virtualized lists).

## Packaging & distribution

- [x] GitHub Actions runs `test/harness.html` headless on every push for both
      builds (`.github/workflows/ci.yml` + `test/run_harness.py`, `?ext=…`).
- [x] `assets/package.sh` builds the store zips in CI and attaches them to
      `v*` tag releases (`.github/workflows/release.yml`).
- [x] `web-ext lint` runs for the Firefox build in CI (0 errors / 0 warnings).
- [x] `node test/check_privacy.mjs` keeps `PRIVACY.md` in sync with every
      stored field, and `test/check_parity.mjs` keeps the two builds identical.
- [x] `assets/build.py` regenerates screenshots and zips when the UI changes
      and uploads them as CI artifacts (`.github/workflows/assets.yml`); fonts
      fall back across platforms so it runs on Linux, and the workflow leaves
      committing to a local (macOS-rendered) run to avoid font churn.

## Maybe later

- [ ] Extend beyond Machines: Users, DNS, Access controls.
- [ ] Local-only notes/bookmarks per machine.
