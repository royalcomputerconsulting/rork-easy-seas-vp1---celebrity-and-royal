const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes("csv")) {
  config.resolver.assetExts.push("csv");
}

module.exports = withRorkMetro(config);
