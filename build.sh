#!/bin/bash
set -e

echo "Running Expo build from ./expo..."
cd "$(dirname "$0")/expo"
bash ./build.sh
