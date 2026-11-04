#!/usr/bin/env bash
# Screenshot a page at the project's four check widths (responsive-layout skill, step 5).
#
#   screenshots.sh <url> <out-dir> [hash]
#   screenshots.sh http://localhost:4174/ /tmp/layout listen
#
# Needs Google Chrome or Chromium. Serve the app first (npm run build && npx vite preview --port 4174).
set -euo pipefail

url="${1:?usage: screenshots.sh <url> <out-dir> [hash]}"
out="${2:?usage: screenshots.sh <url> <out-dir> [hash]}"
hash="${3:-}"
[[ -n "$hash" ]] && url="${url%%#*}#${hash#\#}"

chrome="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$chrome" ]]; then
  echo "No Chrome or Chromium found; check the widths by hand in browser dev tools." >&2
  exit 1
fi

mkdir -p "$out"
for size in 360x740 768x1024 1024x768 1280x800; do
  file="$out/layout-${hash:-home}-$size.png"
  timeout 60 "$chrome" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
    --virtual-time-budget=4000 --window-size="${size/x/,}" --screenshot="$file" "$url" >/dev/null 2>&1
  echo "$file"
done
