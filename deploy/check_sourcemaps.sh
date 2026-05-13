#!/bin/bash
# Check that every //# sourceMappingURL= comment in a served JS/CSS file
# points to a map file that actually exists.
# Exits with code 1 and lists the offenders if any are missing.

set -euo pipefail

PUBLIC_DIRS=(
  "packages/server/public"
)

MISSING=()

# Normalise a path that may contain .. segments (cross-platform, no GNU coreutils needed)
normalise_path() {
  python3 -c "import os.path, sys; print(os.path.normpath(sys.argv[1]))" "$1"
}

for dir in "${PUBLIC_DIRS[@]}"; do
  while IFS= read -r -d '' file; do
    # grep for the last sourceMappingURL in the file — handles trailing newlines,
    # CDN banners, and other cases where it is not the very last line
    match=$(grep -E '(//[#@]|/\*[#@])\s*sourceMappingURL=' "$file" | tail -1 || true)
    [[ -z "$match" ]] && continue

    # Extract everything after sourceMappingURL=, strip trailing */ and whitespace
    map_ref=$(echo "$match" | sed 's/.*sourceMappingURL=//; s/[[:space:]].*//; s/\*\///')
    [[ -z "$map_ref" ]] && continue

    # Skip data URIs (inline source maps)
    [[ "$map_ref" == data:* ]] && continue

    # Skip remote URLs
    [[ "$map_ref" == http://* || "$map_ref" == https://* || "$map_ref" == //* ]] && continue

    # Skip anything that looks like a template literal or non-path content
    # (valid map refs only contain path-safe characters)
    [[ "$map_ref" =~ [^a-zA-Z0-9_./%~:@=-] ]] && continue

    # Resolve relative to the source file, normalising .. segments
    map_path=$(normalise_path "$(dirname "$file")/$map_ref")

    if [[ ! -f "$map_path" ]]; then
      MISSING+=("$file -> $map_ref")
    fi
  done < <(find "$dir" -type f \( -name "*.js" -o -name "*.css" \) -print0)
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "ERROR: Missing source map files:"
  for entry in "${MISSING[@]}"; do
    echo "  $entry"
  done
  exit 1
fi

echo "OK: all sourceMappingURL references are satisfied"
