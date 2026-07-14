const { withInfoPlist, withXcodeProject } = require('expo/config-plugins');

const APP_STORE_VERSION = '12.4.2';
const IOS_BUILD_NUMBER = '311';

/**
 * Final native safeguard. This runs during Expo prebuild and writes the values
 * into both Info.plist and Xcode build settings, after higher-level config has
 * been resolved.
 */
module.exports = function withForcedIOSVersion(config) {
  config.version = APP_STORE_VERSION;
  config.ios = {
    ...(config.ios || {}),
    buildNumber: IOS_BUILD_NUMBER,
  };

  config = withInfoPlist(config, (modConfig) => {
    modConfig.modResults.CFBundleShortVersionString = APP_STORE_VERSION;
    modConfig.modResults.CFBundleVersion = IOS_BUILD_NUMBER;
    return modConfig;
  });

  config = withXcodeProject(config, (modConfig) => {
    const section = modConfig.modResults.pbxXCBuildConfigurationSection();
    Object.keys(section).forEach((key) => {
      const entry = section[key];
      if (!entry || typeof entry !== 'object' || !entry.buildSettings) return;
      entry.buildSettings.MARKETING_VERSION = APP_STORE_VERSION;
      entry.buildSettings.CURRENT_PROJECT_VERSION = IOS_BUILD_NUMBER;
    });
    return modConfig;
  });

  return config;
};
