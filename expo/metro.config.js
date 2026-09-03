const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The authoritative workspace can live on the external MQ-100 volume.
// Watchman may wait indefinitely for watch-project on removable volumes,
// while Metro's portable watcher works on both the internal and external
// build folders. This changes development file discovery only.
config.resolver.useWatchman = false;

// expo-sqlite's web worker imports its bundled SQLite runtime as a WASM
// asset. Include it explicitly so the same health/trust repository can be
// rendered in the web validation build instead of failing Metro resolution.
if (!config.resolver.assetExts.includes("wasm")) {
  config.resolver.assetExts.push("wasm");
}

module.exports = config;
