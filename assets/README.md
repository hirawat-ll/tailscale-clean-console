# assets

Distribution material for both stores. Nothing here is part of the extensions
themselves — it is what you upload to the Chrome Web Store and Firefox Add-ons.

```
build.py                 generates the icons, promo tiles and store screenshots
package.sh               builds the two upload .zip files from chrome/ and firefox/
tailscale-clean-console-chrome-1.0.0.zip     upload to Chrome Web Store
tailscale-clean-console-firefox-1.0.0.zip    upload to Firefox Add-ons (AMO)

icons/icon-1024.png      master icon (the PNGs shipped in the packages are
                         generated from the same drawing code)
chrome-web-store/
  listing.md             ready-to-paste store listing, privacy answers, assets
  promo/                 small tile 440×280, large tile 920×680, marquee 1400×560
  screenshots/           1280×800 store screenshots
firefox-addons/
  listing.md             ready-to-paste AMO listing
  screenshots/           1280×800 store screenshots
```

## Rebuild

```sh
python3 assets/build.py      # icons + banners + store screenshots (needs Pillow)
./assets/package.sh          # rezip both extensions (uses the manifest version)
```

`build.py` draws everything with Pillow, so the artwork can be tweaked in one
place and regenerated at every required size. Icons are written straight into
`chrome/icons/` and `firefox/icons/` so the packaged extensions always match.

## Before submitting

1. Bump `version` in `chrome/manifest.json` and `firefox/manifest.json`.
2. `./assets/package.sh` and upload the two archives.
3. Refresh the listing text from the store folders if anything changed.
4. Keep `PRIVACY.md` (repo root) up to date — both stores link to it.
