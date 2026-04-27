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

# Install pods
cd apps/mobile/ios
pod install

echo "=== post-clone complete ==="
