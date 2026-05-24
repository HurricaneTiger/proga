#!/bin/bash
set -e

echo "=== MC LAN Tunnel - Build Release ==="
echo ""

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "[1/4] Installing dependencies..."
npm install

echo ""
echo "[2/4] Building all packages..."
npm run build

echo ""
echo "[3/4] Bundling relay server..."
npm run bundle:relay

echo ""
echo "[4/4] Packaging for Windows..."
npx electron-builder --win --project apps/desktop

echo ""
echo "=== Build complete! ==="
echo "Output: apps/desktop/release/"
echo ""
ls -la apps/desktop/release/ 2>/dev/null || echo "(release directory will be created on Windows)"
