#!/usr/bin/env bash
# chuck-core/build.sh
# Compile le cœur Rust en WebAssembly et copie le résultat dans chuck-ide.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IDE_DIR="$SCRIPT_DIR/../chuck-ide"

echo "── Chuck Core — Build WASM ──────────────────────────────"

# 1. Tests natifs d'abord
echo "▶ Tests Rust natifs..."
cargo test --quiet 2>&1
echo "✓ Tests OK"

# 2. Build WASM
echo "▶ Build WebAssembly (release)..."
wasm-pack build \
  --target web \
  --out-dir "$SCRIPT_DIR/pkg" \
  --release \
  2>&1

echo "✓ WASM généré dans pkg/"

# 3. Copie dans chuck-ide/public/
echo "▶ Copie vers chuck-ide/src/lib/..."
mkdir -p "$IDE_DIR/src/lib"

cp "$SCRIPT_DIR/pkg/chuck_core_bg.wasm"  "$IDE_DIR/src/lib/"
cp "$SCRIPT_DIR/pkg/chuck_core.js"        "$IDE_DIR/src/lib/"
cp "$SCRIPT_DIR/pkg/chuck_core.d.ts"      "$IDE_DIR/src/lib/"

echo "✓ Fichiers copiés :"
echo "  src/lib/chuck_core_bg.wasm  ($(du -sh "$IDE_DIR/src/lib/chuck_core_bg.wasm" | cut -f1))"
echo "  src/lib/chuck_core.js"
echo "  src/lib/chuck_core.d.ts"

echo ""
echo "── Build terminé ────────────────────────────────────────"
