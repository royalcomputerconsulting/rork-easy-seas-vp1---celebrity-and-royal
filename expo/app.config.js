const appJson = require('./app.json');

const APP_STORE_VERSION = '12.4.2';
const IOS_BUILD_NUMBER = '311';
const ANDROID_VERSION_CODE = 120402;
const FORCE_VERSION_PLUGIN = './plugins/withForcedIOSVersion';

/**
 * Dynamic Expo config intentionally hard-locks the App Store marketing version.
 * Rork/EAS-supplied config values are spread first, then overwritten here so a
 * stale remote value such as 9.17.1 cannot become CFBundleShortVersionString.
 */
module.exports = ({ config = {} } = {}) => {
  const staticExpo = appJson.expo || {};
  const staticPlugins = Array.isArray(staticExpo.plugins) ? staticExpo.plugins : [];
  const hasForcePlugin = staticPlugins.some((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name === FORCE_VERSION_PLUGIN;
  });

  return {
    ...config,
    ...staticExpo,
    version: APP_STORE_VERSION,
    ios: {
      ...(config.ios || {}),
      ...(staticExpo.ios || {}),
      buildNumber: IOS_BUILD_NUMBER,
      infoPlist: {
        ...((config.ios && config.ios.infoPlist) || {}),
        ...((staticExpo.ios && staticExpo.ios.infoPlist) || {}),
        CFBundleShortVersionString: APP_STORE_VERSION,
        CFBundleVersion: IOS_BUILD_NUMBER,
      },
    },
    android: {
      ...(config.android || {}),
      ...(staticExpo.android || {}),
      versionCode: ANDROID_VERSION_CODE,
    },
    plugins: hasForcePlugin
      ? staticPlugins
      : [...staticPlugins, FORCE_VERSION_PLUGIN],
  };
};
