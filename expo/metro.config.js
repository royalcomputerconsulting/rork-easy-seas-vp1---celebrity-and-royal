const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

config.resolver = config.resolver || {};
config.resolver.assetExts = Array.from(new Set([...(config.resolver.assetExts || []), 'csv']));

module.exports = withRorkMetro(config);
