const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));
const app = JSON.parse(read('app.json'));
const analytics = read('app/(tabs)/analytics.tsx');
const entitlement = read('state/EntitlementProvider.tsx');
const diagnostic = read('lib/diagnosticLogger.ts');
const layout = read('app/_layout.tsx');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(app.expo.newArchEnabled === true, 'Expo New Architecture must remain enabled.');
assert(!pkg.dependencies['react-native-purchases'], 'react-native-purchases must not be present in package.json.');
assert(!entitlement.includes("react-native-purchases"), 'EntitlementProvider must not import react-native-purchases.');
assert(entitlement.includes("source: 'free_use'"), 'EntitlementProvider must grant free_use access.');
assert(entitlement.includes('isPro: true'), 'EntitlementProvider must grant Pro access.');
assert(!analytics.includes("expo-linear-gradient"), 'Casino route must not import expo-linear-gradient.');
assert(!analytics.includes('diagnosticLogger'), 'Casino route must not use diagnosticLogger.');
assert(!analytics.includes('.split('), 'Casino route must avoid direct .split calls.');
assert(!diagnostic.includes('@react-native-async-storage/async-storage'), 'diagnosticLogger must not import AsyncStorage.');
assert(!diagnostic.includes('console.log =') && !diagnostic.includes('console.warn =') && !diagnostic.includes('console.error ='), 'diagnosticLogger must not monkey-patch console methods.');
assert(!layout.includes('recordDiagnosticEvent') && !layout.includes('initializeDiagnosticLogger'), 'Root layout must not import or initialize diagnostics.');
console.log('PASS testV1076NativeNoRevenueCatCasino');
