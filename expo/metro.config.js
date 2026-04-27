const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const exclusionList = require("metro-config/src/defaults/exclusionList");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);
const generatedBuildOutputPattern = new RegExp(
  `^${path.resolve(__dirname, "dist-build-check.*").replace(/[\\/]/g, "[\\/]")}(?:[\\/].*)?
);

config.resolver = {
  ...config.resolver,
  blockList: exclusionList([
    generatedBuildOutputPattern,
  ]),
};

module.exports = withRorkMetro(config);
