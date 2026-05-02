const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

// Allow CSV files to be bundled as static assets
config.resolver.assetExts = [...(config.resolver.assetExts ?? []), "csv"];

module.exports = withRorkMetro(config);
