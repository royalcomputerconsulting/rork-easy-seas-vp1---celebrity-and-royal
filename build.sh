#!/bin/bash

echo "Installing dependencies..."
npm install

echo "Exporting Expo web app..."
npx expo export -p web --output-dir dist

echo "Build complete! Static files are in ./dist"
