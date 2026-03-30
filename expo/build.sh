#!/bin/bash

set -e

echo "Syncing latest project files into expo workspace..."
node ./scripts/sync-from-root.mjs

echo "Installing dependencies..."
bun install

echo "Exporting Expo web app..."
bunx expo export -p web --output-dir dist

echo "Build complete! Static files are in ./dist"
