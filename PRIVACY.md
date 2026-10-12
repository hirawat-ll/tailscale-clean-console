# Privacy Policy — Tailscale Clean Console

_Last updated: 2026-10-12_

Tailscale Clean Console is a browser extension that restyles the Tailscale
admin console (`console.tailscale.com` / `login.tailscale.com`). It runs
entirely on your computer and does not collect, transmit, or sell any data.

## What the extension does

- It reads the page you are already viewing in the Tailscale admin console to
  find the "Machines" list and render it as a card grid.
- It hides UI elements you ask it to hide (the trial/plan banner by default).

## What it stores

Your layout choice (`view`), the elements you hid (`hidden`), the devices you
hid (`hiddenDevices`), your interface language (`locale`), whether the floating
pill is hidden (`pillHidden`), and three small first-run / preference flags —
whether you have already seen the welcome card (`onboarded`), the one-time hide
hint (`hintShown`), and whether cross-device sync is on (`sync`) — are saved in
your browser's **local storage for the Tailscale site** (`localStorage` key
`tsc:settings:v1`), together with a `schema` marker that lets a newer version of
the extension read older data safely. This data:

- never leaves your browser,
- is not readable by the extension on any other site,
- is deleted when you clear the site's data.

If you switch on **Sync settings across devices** in the Settings popover, the
same object is also written to your browser's built-in sync storage
(`browser.storage.sync`), which your browser provider — not this extension —
carries between your signed-in devices. It is off by default, only available
where the browser offers it, and turning it off stops further syncing. Exported
JSON files are created locally and saved wherever you choose.

## Permissions

The extension only runs on `console.tailscale.com/admin/*` and
`login.tailscale.com/admin/*`, and only to restyle those pages. It asks for the
`storage` permission only to offer the optional cross-device sync described
above; without sync enabled, everything stays in the site's local storage.

## What it does not do

- No network requests of its own. The extension has no servers and talks to
  nothing; if you enable sync, your browser carries the data on its own.
- No analytics, telemetry, tracking, or advertising.
- No collection of personal information, browsing history, keystrokes, or
  credentials.
- No remote code. All code is contained in the published package.

## Contact

Questions or issues: open an issue at
<https://github.com/hirawat-ll/tailscale-clean-console/issues>.

---

Tailscale Clean Console is an unofficial, community project. It is not
affiliated with, endorsed by, or sponsored by Tailscale Inc. "Tailscale" is a
trademark of its respective owner and is used only to describe what the
extension works with.
