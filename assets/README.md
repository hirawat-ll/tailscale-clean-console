# assets

Distribution material for both stores. Nothing here is part of the extensions
themselves — it is what you upload to the Chrome Web Store and Firefox Add-ons.

```
build.py                 captures the mock and builds every image asset
capture.py               Chromium/Playwright capture of test/mock.html
package.sh               builds the two upload .zip files from chrome/ and firefox/
tailscale-clean-console-chrome-1.0.0.zip     upload to Chrome Web Store
tailscale-clean-console-firefox-1.0.0.zip    upload to Firefox Add-ons (AMO)

icons/icon-1024.png      master icon (the PNGs shipped in the packages are
                         generated from the same drawing code)
chrome-web-store/
  listing.md             ready-to-paste store listing, privacy answers, assets
  promo/                 small tile 440×280, large tile 920×680, marquee 1400×560
  screenshots/           1280×800 store screenshots (grid, classic, dark)
firefox-addons/
  listing.md             ready-to-paste AMO listing
  screenshots/           1280×800 store screenshots (grid, classic, dark)
```

The `screenshots/` folder in the repo root holds the two framed README images.

## Rebuild

```sh
pip install pillow playwright && playwright install chromium   # once
python3 assets/build.py      # capture the mock, draw icons/banners/README shots
./assets/package.sh          # rezip both extensions (uses the manifest version)
```

`build.py` launches `test/mock.html` in headless Chromium at 2x, then draws the
icons, framed README shots, 1280×800 store screenshots and promo tiles with
Pillow. Icons are written straight into `chrome/icons/` and `firefox/icons/` so
the packaged extensions always match. All machine names, IPs, owners and times
in the fixture are invented.

## Before submitting

1. Bump `version` in `chrome/manifest.json` and `firefox/manifest.json`.
2. `./assets/package.sh` and upload the two archives.
3. Refresh the listing text from the store folders if anything changed.
4. Keep `PRIVACY.md` (repo root) up to date — both stores link to it.
