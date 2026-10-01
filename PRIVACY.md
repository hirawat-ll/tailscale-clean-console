# Privacy Policy — Tailscale Clean Console

_Last updated: 2026-10-01_

Tailscale Clean Console is a browser extension that restyles the Tailscale
admin console (`console.tailscale.com` / `login.tailscale.com`). It runs
entirely on your computer and does not collect, transmit, or sell any data.

## What the extension does

- It reads the page you are already viewing in the Tailscale admin console to
  find the "Machines" list and render it as a card grid.
- It hides UI elements you ask it to hide (the trial/plan banner by default).

## What it stores

Your layout choice (grid or list) and the list of elements you hid are saved
in your browser's **local storage for the Tailscale site**
(`localStorage` key `tsc:settings:v1`). This data:

- never leaves your browser,
- is not readable by the extension on any other site,
- is deleted when you clear the site's data.

## What it does not do

- No network requests. The extension has no servers and talks to nothing.
- No analytics, telemetry, tracking, or advertising.
- No collection of personal information, browsing history, keystrokes, or
  credentials.
- No remote code. All code is contained in the published package.

## Permissions

The extension only runs on `console.tailscale.com/admin/*` and
`login.tailscale.com/admin/*`, and only to restyle those pages.

## Contact

Questions or issues: open an issue at
<https://github.com/hirawat-ll/tailscale-clean-console/issues>.

---

Tailscale Clean Console is an unofficial, community project. It is not
affiliated with, endorsed by, or sponsored by Tailscale Inc. "Tailscale" is a
trademark of its respective owner and is used only to describe what the
extension works with.
