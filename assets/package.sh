#!/usr/bin/env bash
# Build the upload archives for both stores (manifest.json at the archive root).
#
#   ./assets/package.sh
#
# Produces:
#   assets/tailscale-clean-console-chrome-<version>.zip    -> Chrome Web Store
#   assets/tailscale-clean-console-firefox-<version>.zip   -> Firefox Add-ons (AMO)
set -euo pipefail
cd "$(dirname "$0")/.."

version="$(node -p "require('./chrome/manifest.json').version")"
rm -f assets/tailscale-clean-console-chrome-*.zip assets/tailscale-clean-console-firefox-*.zip

# -X strips extra attributes, -x filters out dotfiles such as .DS_Store
( cd chrome  && zip -rqX "../assets/tailscale-clean-console-chrome-${version}.zip"  . -x ".*" -x "*/.*" )
( cd firefox && zip -rqX "../assets/tailscale-clean-console-firefox-${version}.zip" . -x ".*" -x "*/.*" )

echo "chrome : assets/tailscale-clean-console-chrome-${version}.zip"
echo "firefox: assets/tailscale-clean-console-firefox-${version}.zip"
