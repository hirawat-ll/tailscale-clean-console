# Tailscale Clean Console (Firefox extension)

A small Firefox extension that makes the Tailscale admin console
(`https://console.tailscale.com/admin/machines`) easier on the eyes:

- **Removes the top banner** — the big "Your free trial has ended" plan card
  that sits above the Machines page. It is hidden on every admin page.
- **Grid view by default** — the machine list (`<table class="tb">`) is
  rendered as a responsive card grid instead of full-width table rows,
  split into **Online** and **Offline** sections with live counts. The
  Addresses and Version rows are dropped from the cards, so each card shows
  just the machine name, its tags/badges, and last-seen status. One click
  switches back to the classic list.
- **Hide anything** — a picker lets you click any element on the page
  (a promo card, a warning strip, the "Add devices" footer…) and hide it
  permanently. A reset button brings everything back.

The selected layout and hidden elements are remembered per-site in
`localStorage` (`tsc:settings:v1`).

## Install

### Try it now (temporary, until Firefox restarts)

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `manifest.json` in this folder
4. Open `https://console.tailscale.com/admin/machines` and log in

### Keep it permanently

Temporary add-ons are removed when Firefox restarts. To keep it, either:

- **Sign it for yourself** (any Firefox, no account needed beyond AMO):
  `npx web-ext sign --source-dir . --channel unlisted` then install the
  resulting `.xpi` from `web-ext-artifacts/`, or upload it at
  <https://addons.mozilla.org/developers/> as an unlisted add-on.
- **Or** use Firefox Developer Edition / Nightly and set
  `xpinstall.signatures.required = false` in `about:config`, then install an
  unsigned `.xpi` (zip this folder with `manifest.json` at the root).

For development, `npx web-ext run --source-dir .` opens a Firefox that
auto-reloads on file changes.

## Usage

A small pill appears at the bottom-right corner of the Machines page:

| Button   | Action                                                              |
| -------- | ------------------------------------------------------------------- |
| ▦ Grid / ☰ List | Toggle card grid ↔ classic table (remembered)               |
| ⌖ Hide   | Enter picker mode, then click the element you want to hide (Esc cancels) |
| ↺        | Unhide all elements hidden with the picker                          |

The trial banner and grid view are on by default; the pill is only there if
you want to change that.

## How it works

The selectors were taken from the console's own JavaScript bundle, so they
match the real markup rather than guessed class names:

- Trial banner wrapper: `.trial-expired-notice` (hidden via CSS in `styles.css`)
- Machines list: `table.tb` with one `<tr>` per machine
  - The script adds `.tsc-machines` to the table, `.tsc-grid` to `<html>`,
    `.tsc-title` / `.tsc-actions` to the first/last cell of each row, and
    `data-tsc-label="…"` attributes copied from the table headers.
  - Cells whose column header is `Addresses` / `IP` / `Version` get
    `.tsc-omit` and are hidden in grid view.
  - Each machine row is classified online/offline from its Last seen cell
    (the console renders a green `bg-green-300` dot + "Connected" when the
    node is connected to the control plane; "Connected" text is the
    fallback), then tagged `.tsc-online` / `.tsc-offline`.
  - Two generated `<tr class="tsc-section">` header rows ("Online"/"Offline"
    with counts) are placed in the grid via CSS `order`: online header,
    online cards, offline header, offline cards. If one group is empty its
    header hides itself. The section rows are display:none outside grid view.
  - `styles.css` turns the rows into cards with a responsive
    `grid-template-columns: repeat(auto-fill, minmax(290px, 1fr))`.
- If the `.tb` class ever disappears, the script falls back to the table with
  the most body rows, so the grid keeps working.

The content script is injected on `https://console.tailscale.com/admin/*`
(and the `login.tailscale.com` alias) so it also survives client-side
navigation inside the console; the grid itself only activates on the Machines
route.

## Troubleshooting

- **Banner or something else still visible** → use the ⌖ Hide button and
  click it. To undo, press ↺ or clear the `tsc:settings:v1` localStorage key.
- **Grid doesn't apply** → the Machines table may have changed. Open the
  browser console (F12); the script marks the table it picked with the class
  `tsc-machines`. If that class is missing, the page probably no longer uses
  a `<table>` for the list — update `findMachinesTable()` in `content.js`.
- **Want the trial banner back** → remove the `.trial-expired-notice` rule
  from `styles.css`.

## Files

```
manifest.json   extension manifest (MV2 content script)
content.js      grid markup, pill UI, element picker, settings
styles.css      banner hiding, card grid, pill styling
test/mock.html  offline replica of the Machines page for visual testing
```
