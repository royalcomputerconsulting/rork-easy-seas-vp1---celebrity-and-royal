const appJson = require('./app.json');

const APP_STORE_VERSION = '13.0.45';
const FORCE_VERSION_PLUGIN = './plugins/withForcedIOSVersion';

/**
 * Dynamic Expo config intentionally hard-locks only the App Store marketing
 * version. Developer-facing iOS/Android build numbers remain sourced from
 * app.json for local builds and from EAS remote versioning for production.
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
      infoPlist: {
        ...((config.ios && config.ios.infoPlist) || {}),
        ...((staticExpo.ios && staticExpo.ios.infoPlist) || {}),
        CFBundleShortVersionString: APP_STORE_VERSION,
      },
    },
    android: {
      ...(config.android || {}),
      ...(staticExpo.android || {}),
    },
    plugins: hasForcePlugin
      ? staticPlugins
      : [...staticPlugins, FORCE_VERSION_PLUGIN],
  };
};
