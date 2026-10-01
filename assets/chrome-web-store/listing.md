# Chrome Web Store — listing copy

Paste these into the Chrome Web Store developer dashboard. Asset files live
in `promo/` and `screenshots/` (paths relative to this folder).

## Store listing

**Name** (max 45)

```
Tailscale Clean Console
```

**Summary / short description** (max 132)

```
A calmer Tailscale admin console: machines as a card grid, no trial banner, and a picker to hide anything on the page.
```

**Category:** Productivity

**Language:** English

**Detailed description**

```
Tailscale Clean Console tidies up the Tailscale admin console so the Machines
page is easy to scan.

Features
• Card grid — the machine list is rendered as a responsive grid of cards
  instead of full-width table rows.
• Online / Offline sections — machines are grouped automatically, with live
  counts, using the connection status already shown on the page.
• No trial banner — the "Your free trial has ended" plan card is hidden.
• Hide anything — a picker lets you click any element on the page (a promo
  card, a warning strip, a footer…) and hide it. One button brings it back.
• Stays put — your layout choice and hidden elements are remembered.

Usage
A small pill sits in the bottom-right corner of the admin page:
• ▦ Grid / ☰ List — switch between the card grid and the classic table
• ⌖ Hide — click the element you want to hide (Esc cancels)
• ↺ — show everything you hid again

Notes
• Works on console.tailscale.com and login.tailscale.com admin pages.
• Runs only on those pages and changes nothing but how they look.
• No account, no tracking, no network requests, no data collection.
• Unofficial community project, not affiliated with Tailscale Inc.

Permissions
The extension only needs access to the Tailscale admin pages it restyles. It
requests no other permissions.
```

**Privacy policy URL**

```
https://github.com/hirawat-ll/tailscale-clean-console/blob/main/PRIVACY.md
```

## Privacy practices (dashboard answers)

**Single purpose description**

```
Makes the Tailscale admin Machines page easier to read by hiding the plan
banner and showing the machine list as a card grid.
```

**Permission justification**

```
Content-script access to console.tailscale.com/admin/* and
login.tailscale.com/admin/* is required to restyle the Machines page: hide the
billing banner and render the machine table as cards. No other host or API
permissions are requested.
```

**Remote code** — `No, I am not using remote code.`

**Data usage** — for every category (personally identifiable information,
health, financial, authentication, personal communications, location, web
history, user activity, website content): **not collected**. Confirm all three
statements (not sold/transferred, not used for unrelated purposes, not used for
creditworthiness).

## Assets

| Asset | File |
| --- | --- |
| Store icon (128×128) | `../icons/icon-1024.png` (downscaled automatically) |
| Screenshot 1 — card grid | `screenshots/1-grid-view-1280x800.png` |
| Screenshot 2 — classic view | `screenshots/2-classic-view-1280x800.png` |
| Screenshot 3 — dark mode | `screenshots/3-dark-mode-1280x800.png` |
| Small promo tile (440×280) | `promo/small-tile-440x280.png` |
| Large promo tile (920×680) | `promo/large-tile-920x680.png` |
| Marquee (1400×560) | `promo/marquee-1400x560.png` |

Screenshots are 1280×800 (the recommended size); to add more, capture the page
at 1280×800 and drop the PNG in `screenshots/`.

## Upload package

```
../tailscale-clean-console-chrome-1.0.0.zip
```

Rebuild with `./assets/package.sh` after bumping the version in
`chrome/manifest.json`.
