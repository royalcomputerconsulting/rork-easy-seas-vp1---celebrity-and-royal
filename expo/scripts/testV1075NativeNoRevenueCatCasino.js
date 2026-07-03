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
const entitlement = read('state/EntitlementProvider.tsx');
const layout = read('app/_layout.tsx');
const diagnostics = read('lib/diagnosticLogger.ts');
const casinoRoute = read('app/(tabs)/analytics.tsx');

assert(pkg.version === '9.11.65', 'package version bumped to 9.11.65');
assert(app.expo.version === '9.11.65', 'app config version bumped to 9.11.65');
assert(app.expo.ios.buildNumber === '9.11.65', 'iOS build number bumped to 9.11.65');
assert(app.expo.android.versionCode === 91165, 'Android versionCode bumped to 91165');
assert(app.expo.newArchEnabled === true, 'Expo New Architecture remains enabled for react-native-worklets');
assert(!('react-native-purchases' in pkg.dependencies), 'react-native-purchases dependency removed');
assert(!/from ['"]react-native-purchases['"]/.test(entitlement), 'EntitlementProvider no longer imports react-native-purchases');
assert(/isPro:\s*true/.test(entitlement) && /tier:\s*'pro'/.test(entitlement), 'EntitlementProvider grants full free-use pro access');
assert(!/initializeDiagnosticLogger\(\)/.test(layout), 'Root layout does not initialize diagnostics at module load');
assert(!/AsyncStorage/.test(diagnostics), 'diagnosticLogger has no AsyncStorage dependency');
assert(!/console\.log\s*=|console\.warn\s*=|console\.error\s*=/.test(diagnostics), 'diagnosticLogger no longer monkey-patches console methods');
assert(/type CasinoTab = 'portfolio' \| 'value' \| 'action' \| 'history'/.test(casinoRoute), 'Casino route keeps all four sections');
assert(/portfolio|value|action|history/.test(casinoRoute), 'Casino route section keys are present');
assert(/Modal/.test(casinoRoute) && /DetailPayload/.test(casinoRoute), 'Casino drill-down modal support remains present');
assert(/ScrollView/.test(casinoRoute) && /RefreshControl/.test(casinoRoute), 'Casino section supports scroll and pull-to-refresh');

if (process.exitCode) process.exit(1);
console.log('✅ v1075 native no-RevenueCat casino hardening checks passed');
