#!/bin/sh
set -e

echo "=== Xcode Cloud post-clone script ==="

# Install Homebrew if not present
which brew || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node || true

# Install CocoaPods
brew install cocoapods || true

# Navigate to the monorepo root
cd "$CI_PRIMARY_REPOSITORY_PATH"

# Install npm dependencies
npm install --legacy-peer-deps

# Regenerate native iOS project fresh so module paths match this CI environment
cd apps/mobile
npx expo prebuild --platform ios --clean --no-install

# Install pods with the freshly generated project
cd ios
pod install

echo "=== post-clone complete ==="
