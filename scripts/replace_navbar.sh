#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="${ROOT_DIR}/src/building_blocks/navbar.html"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Navbar template not found: $TEMPLATE" >&2
  exit 1
fi

while IFS= read -r -d '' file; do
  rel="${file#$ROOT_DIR/src/}"
  dir="$(dirname "$rel")"
  if [[ "$dir" == "." ]]; then
    depth=0
  else
    depth=$(awk -F/ '{print NF}' <<<"$dir")
  fi

  prefix=""
  if [[ "$depth" -gt 0 ]]; then
    prefix=$(printf '../%.0s' $(seq 1 "$depth"))
  fi

  nav_tmp="$(mktemp)"
  sed "s|__DEPTH__|${prefix}|g" "$TEMPLATE" > "$nav_tmp"

  tmp="${file}.tmp"
  sed -e "/<nav /,/<\\/nav>/d" \
      -e "/<a class=\"logo\"/,/<\\/ul>/d" \
      -e "/<body[^>]*>/r $nav_tmp" \
      "$file" > "$tmp"
  mv "$tmp" "$file"
  rm "$nav_tmp"
done < <(find "${ROOT_DIR}/src" -name "*.html" ! -path "*/building_blocks/*" -print0)
