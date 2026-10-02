#!/bin/bash
# Build a Chrome Web Store-ready zip from extension/.
# - Strips the dev-only "key" field so the store assigns a fresh extension ID.
# - Does NOT touch the repo's extension/ (dev keeps its pinned ID for the
#   native-host allowlist).
# Usage: bash store/build.sh   (run from repo root)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/extension"
VER="$(python3 -c "import json;print(json.load(open('$SRC/manifest.json'))['version'])")"
TMP="$(mktemp -d)"
OUT="$ROOT/store/webai-hands-store-$VER.zip"

rm -rf "$TMP/build"
mkdir -p "$TMP/build"
cp -r "$SRC/." "$TMP/build/"

# Strip dev key -> store assigns a new extension ID on first upload.
python3 - "$TMP/build/manifest.json" <<'EOF'
import json, sys
p = sys.argv[1]
m = json.load(open(p))
m.pop("key", None)
json.dump(m, open(p, "w"), indent=2, ensure_ascii=False)
open(p, "a").write("\n")
print("store manifest: key stripped, version", m["version"])
EOF

# Drop dev leftovers just in case.
find "$TMP/build" -name '*.bak' -delete

rm -f "$OUT"
(cd "$TMP/build" && zip -qr "$OUT" .)
rm -rf "$TMP"
echo "built: $OUT"
echo "NOTE: first upload assigns a NEW extension ID."
echo "Then update the native-host allowlist and tell users to re-run install."
