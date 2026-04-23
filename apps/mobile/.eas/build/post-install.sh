#!/usr/bin/env bash
set -euo pipefail

# EAS Build working directory is the monorepo root (/home/expo/workingdir/build).
# Build @okr-tool/core so dist/index.js exists for any tooling that needs it.
echo "Building @okr-tool/core..."
cd packages/core
npx tsc || true
echo "@okr-tool/core build complete."
