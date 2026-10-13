# <img src="assets/icons/icon-1024.png" alt="" width="40" height="40" align="middle"> Tailscale Clean Console

[![CI](https://github.com/hirawat-ll/tailscale-clean-console/actions/workflows/ci.yml/badge.svg)](https://github.com/hirawat-ll/tailscale-clean-console/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/hirawat-ll/tailscale-clean-console?sort=semver&color=4f46e5)](https://github.com/hirawat-ll/tailscale-clean-console/releases)
[![License: MIT](https://img.shields.io/github/license/hirawat-ll/tailscale-clean-console?color=blue)](LICENSE)
[![Firefox Add-ons](https://img.shields.io/badge/Firefox%20Add--ons-install-FF7139?logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/tailscale-clean-console/)

A tiny, local-only browser extension that makes the Tailscale admin console
calmer. It hides the **"Your free trial has ended"** banner and renders your
machines as an **Online / Offline** card grid — with sorting, live counts,
copy buttons, keyboard shortcuts, and a one-click picker to hide anything else
you don't want to see.

No account, no network requests, no build step: everything stays in your
browser.

<p align="center">Live on Firefox Add-ons →<br><a href="https://addons.mozilla.org/en-US/firefox/addon/tailscale-clean-console/">addons.mozilla.org/firefox/addon/tailscale-clean-console</a></p>

| Before | After |
| --- | --- |
| ![before](assets/screenshots/before.png) | ![after](assets/screenshots/after.png) |

## Features

- **Card grid** — the full-width machine table becomes a responsive grid of
  cards grouped into **Online** and **Offline**, each with live counts.
- **No trial banner** — the plan / billing card is hidden on every admin page.
- **Hide anything** — a picker lets you click any element (a promo card, a
  warning strip, the footer…) and hide it, with one button to bring it back.
- **Search-aware** — the console's own search box drives the grid: typing
  filters the cards and updates the Online / Offline totals.
- **Sort & density** — sort by status, name or last seen; switch between
  comfortable and compact cards; collapse Offline or hide it entirely.
- **Copy from the card** — quiet **Name** / **IP** buttons on every machine.
- **Stays put** — your layout, filters and hidden items are remembered per site,
  and your scroll position is kept across grid/list toggles.
- **Keyboard-first** — full shortcuts, undo, and an accessible pill with focus
  rings and `aria` state.
- **Private by default** — no servers, no analytics, no remote code. Optional
  cross-device sync uses your browser's own storage.

## Install

- **Firefox (MV2)** — [install from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tailscale-clean-console/),
  or load `firefox/manifest.json` at `about:debugging#/runtime/this-firefox` →
  **Load Temporary Add-on…** (gone after restart; keep it with
  `npx web-ext sign --source-dir firefox --channel unlisted`).
- **Chrome / Edge (MV3)** — open `chrome://extensions`, turn on *Developer
  mode*, click **Load unpacked**, and pick the `chrome/` folder.

## Usage

A pill sits in the bottom-right of the Machines page:

| Button | Action |
| --- | --- |
| ▦ Grid / ☰ List | toggle card grid ↔ classic table |
| ⌖ Hide | hide an element, or a whole device (Esc cancels) |
| ↺ | show everything you hid |
| ⚙ | settings: hidden items, default view, export / import |
| ? | reopen the help card |

On your first visit a short welcome card explains the buttons, with an optional
10-second tour. Dismiss it with **Got it**; the `?` brings it back any time.
Hiding a device drops its card from the **Online / Offline** totals — reset
brings everything back.

Every hide and reset shows a short toast, and a hide offers **Undo** (the last
one is also on `Cmd/Ctrl+Z`). Keyboard shortcuts: `g` grid/list, `h` hide,
`r` reset, `p` show/hide the pill, `Esc` cancel.

Above the grid sits a small toolbar with a **sort** menu (status, name, last
seen), a **density** toggle (comfortable / compact) and a **Hide offline**
toggle. The console's own search box drives the grid: typing in it filters the
cards and updates the **Online / Offline** counts, and a matchless search gets a
**Clear search** action. Each card also gets quiet **Name** / **IP** copy
buttons. Tailscale's own "N machines" line follows your hidden devices, and
hiding everything brings up an "N devices hidden — Show all" action. Your scroll
position is kept when you flip between grid and list.

### Settings

The **⚙ Settings** popover lists your hidden devices by name and your hidden
elements, each with a per-item **Show** and a section **Show all** button, so you
can restore devices and elements independently. It also lets you pick the
default view and the interface **language** (English or Español today), **Hide
the pill** for a distraction-free console (bring it back with `p`), **Export** /
**Import** your settings as JSON, and optionally **Sync settings across devices**
through your browser's own sync storage (off by default; falls back to local
storage where unavailable).

## Privacy

Your layout and hidden items are saved per-site in `localStorage`
(`tsc:settings:v1`) and never leave your browser. The extension runs only on
`console.tailscale.com/admin/*` and `login.tailscale.com/admin/*`, requests no
permissions beyond `storage`, and makes no network requests of its own. See
[PRIVACY.md](PRIVACY.md) for the full detail.

## Develop

`chrome/` and `firefox/` are the two builds (Manifest V3 / V2), kept
byte-identical; `test/` holds a mock Machines page and the assertion harness;
`assets/` has the store zips, icons, screenshots and listing copy.

```sh
node test/serve.mjs           # then open http://localhost:8787/test/harness.html (?ext=chrome|firefox)
python3 test/run_harness.py   # headless run of both builds (needs: pip install playwright && playwright install chromium)
```

CI runs the harness for both builds, `web-ext lint` on Firefox, and the privacy
/ parity checks; `v*` tags publish the store zips to a GitHub release. See
[ROADMAP.md](ROADMAP.md) for planned work and [assets/README.md](assets/README.md)
for how the screenshots and store packages are built.

## License

[MIT](LICENSE) © Vishal Hirawat.

Unofficial project, not affiliated with Tailscale Inc. "Tailscale" is a
trademark of its respective owner and is used only to describe what the
extension works with.

---

<a href="https://sensescape.in/"><img src="assets/sense-ai.svg" alt="Powered by Sense AI" height="40"></a>
