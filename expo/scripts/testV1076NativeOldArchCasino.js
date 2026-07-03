const fs = require('fs');
const path = require('path');

const root = process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
}

const pkg = JSON.parse(read('package.json'));
const app = JSON.parse(read('app.json'));
const layout = read('app/_layout.tsx');
const entitlement = read('state/EntitlementProvider.tsx');
const diagnostics = read('lib/diagnosticLogger.ts');
const casinoRoute = read('app/(tabs)/analytics.tsx');

assert(/^9\.11\.(6[6-9]|[7-9]\d)$/.test(pkg.version), 'package version remains at or above 9.11.66');
assert(/^9\.11\.(6[6-9]|[7-9]\d)$/.test(app.expo.version), 'app config version remains at or above 9.11.66');
assert(/^9\.11\.(6[6-9]|[7-9]\d)$/.test(app.expo.ios.buildNumber), 'iOS build number remains at or above 9.11.66');
assert(app.expo.android.versionCode >= 91166, 'Android versionCode remains at or above 91166');
assert(app.expo.newArchEnabled === false, 'Expo New Architecture is disabled to avoid the TurboModule/Hermes crash path');
assert(!('react-native-worklets' in pkg.dependencies), 'react-native-worklets dependency removed because it forced New Architecture and is not used by the app');
assert(!('react-native-purchases' in pkg.dependencies), 'react-native-purchases dependency remains removed');
assert(!/from ['"]react-native-purchases['"]/.test(entitlement), 'EntitlementProvider does not import react-native-purchases');
assert(/isPro:\s*true/.test(entitlement) && /tier:\s*'pro'/.test(entitlement), 'EntitlementProvider keeps full free-use pro access');
assert(!/initializeDiagnosticLogger\(\)/.test(layout), 'Root layout does not initialize diagnostics at module load');
assert(!/AsyncStorage/.test(diagnostics), 'diagnosticLogger has no AsyncStorage dependency');
assert(!/console\.log\s*=|console\.warn\s*=|console\.error\s*=/.test(diagnostics), 'diagnosticLogger does not monkey-patch console methods');
assert(/type CasinoTab = 'portfolio' \| 'value' \| 'action' \| 'history'/.test(casinoRoute), 'Casino route keeps all four sections');
assert(!casinoRoute.includes('CasinoAnalyticsScreenFull'), 'Legacy heavy casino analytics screen is not imported');
assert(!casinoRoute.includes('expo-linear-gradient'), 'Casino route does not use native gradient module');
assert(casinoRoute.includes('sessionRows') && casinoRoute.includes('slice(0, 80)'), 'Session rendering remains capped for native safety');

if (process.exitCode) process.exit(1);
console.log('✅ v1076 native old-arch casino crash hardening checks passed');
