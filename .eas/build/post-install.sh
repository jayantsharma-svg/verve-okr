#!/usr/bin/env bash
set -euo pipefail

echo "Building @okr-tool/core..."
cd packages/core
npx tsc
echo "@okr-tool/core build complete."
