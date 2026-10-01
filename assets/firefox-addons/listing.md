# Firefox Add-ons (AMO) — listing copy

Paste these into the AMO developer hub. Asset files live in `screenshots/`
(paths relative to this folder).

## Listing

**Name**

```
Tailscale Clean Console
```

**Summary** (max 250)

```
A calmer Tailscale admin console: the machine list becomes a card grid grouped
into Online and Offline, the trial banner is hidden, and a picker lets you hide
any other element on the page.
```

**Categories:** Other (or Productivity)

**Tags:** tailscale, admin, theme, cleanup

**License:** MIT

**Privacy policy**

```
https://github.com/hirawat-ll/tailscale-clean-console/blob/main/PRIVACY.md
```

**Description**

```
Tailscale Clean Console tidies up the Tailscale admin console so the Machines
page is easy to scan.

What it does
• Card grid — the machine list is rendered as a responsive grid of cards
  instead of full-width table rows.
• Online / Offline — machines are grouped automatically with live counts,
  using the connection status already shown on the page.
• No trial banner — the "Your free trial has ended" plan card is hidden on
  every admin page.
• Hide anything — a picker lets you click any element (a promo card, a warning
  strip, the "Add devices" footer…) and hide it. One button brings it back.
• Remembers your layout and hidden elements.

Usage
A small pill sits in the bottom-right corner of the admin page:
• ▦ Grid / ☰ List — switch between the card grid and the classic table
• ⌖ Hide — click the element you want to hide (Esc cancels)
• ↺ — show everything you hid again

Privacy
Runs only on console.tailscale.com and login.tailscale.com admin pages.
No network requests, no analytics, no data collection. Settings are stored in
your browser's local storage for the Tailscale site.

This is an unofficial community project and is not affiliated with Tailscale
Inc.
```

**Version notes (1.0.0)**

```
First release: card grid for the Machines page, Online/Offline grouping,
trial-banner hiding, and an element picker to hide anything.
```

## Data collection (AMO form)

Select **This add-on does not collect or transmit any data** and mark all data
categories as not collected/transmitted.

## Permissions requested

- Access to `console.tailscale.com/admin/*` and `login.tailscale.com/admin/*`
  (content script, to restyle those pages only).
- No other permissions.

## Assets

| Asset | File |
| --- | --- |
| Icon (128×128) | ships in the package (`firefox/icons/`) |
| Screenshot 1 — card grid | `screenshots/1-grid-view-1280x800.png` |
| Screenshot 2 — classic view | `screenshots/2-classic-view-1280x800.png` |

## Upload package

```
../tailscale-clean-console-firefox-1.0.0.zip
```

AMO accepts this `.zip` directly, or sign it yourself with
`npx web-ext sign --source-dir firefox --channel unlisted`.
