const { getDefaultConfig } = require("expo/metro-config");
const fs = require("node:fs");
const path = require("node:path");

const config = getDefaultConfig(__dirname);

// The authoritative workspace can live on the external MQ-100 volume.
// Watchman may wait indefinitely for watch-project on removable volumes,
// while Metro's portable watcher works on both the internal and external
// build folders. This changes development file discovery only.
config.resolver.useWatchman = false;

// Development builds may intentionally keep the large dependency tree on the
// EasySeasDev volume to preserve laptop space. Metro must explicitly follow
// that symlink; otherwise the native app installs successfully but cannot
// resolve expo-router/entry when it requests the JavaScript bundle.
const nodeModulesPath = fs.realpathSync(path.join(__dirname, "node_modules"));
if (nodeModulesPath !== path.join(__dirname, "node_modules")) {
  config.watchFolders = [...new Set([...(config.watchFolders || []), nodeModulesPath])];
  config.resolver.nodeModulesPaths = [nodeModulesPath];
  config.resolver.unstable_enableSymlinks = true;
}

// expo-sqlite's web worker imports its bundled SQLite runtime as a WASM
// asset. Include it explicitly so the same health/trust repository can be
// rendered in the web validation build instead of failing Metro resolution.
if (!config.resolver.assetExts.includes("wasm")) {
  config.resolver.assetExts.push("wasm");
}

// BookDrop manuscripts are bundled as offline shareable files.
for (const extension of ["docx", "epub", "txt"]) {
  if (!config.resolver.assetExts.includes(extension)) {
    config.resolver.assetExts.push(extension);
  }
}

module.exports = config;
