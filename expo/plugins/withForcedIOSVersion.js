const { withInfoPlist, withXcodeProject } = require('expo/config-plugins');

const APP_STORE_VERSION = '13.0.74';

/**
 * Final native safeguard for the user-facing marketing version only. EAS owns
 * CFBundleVersion/CURRENT_PROJECT_VERSION so every production build can receive
 * a unique automatically incremented build number.
 */
module.exports = function withForcedIOSVersion(config) {
  config.version = APP_STORE_VERSION;

  config = withInfoPlist(config, (modConfig) => {
    modConfig.modResults.CFBundleShortVersionString = APP_STORE_VERSION;
    return modConfig;
  });

  config = withXcodeProject(config, (modConfig) => {
    const section = modConfig.modResults.pbxXCBuildConfigurationSection();
    Object.keys(section).forEach((key) => {
      const entry = section[key];
      if (!entry || typeof entry !== 'object' || !entry.buildSettings) return;
      entry.buildSettings.MARKETING_VERSION = APP_STORE_VERSION;
    });
    return modConfig;
  });

  return config;
};
