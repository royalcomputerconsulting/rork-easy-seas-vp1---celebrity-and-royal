const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

// Allow Metro to bundle CSV files as static assets
config.resolver.assetExts = [...(config.resolver.assetExts ?? []), 'csv'];

module.exports = withRorkMetro(config);
