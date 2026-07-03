const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const analytics = fs.readFileSync(path.join(root, 'app/(tabs)/analytics.tsx'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
function assert(condition, message) { if (!condition) throw new Error(message); }
assert(!analytics.includes("from 'expo-linear-gradient'"), 'Casino route must not import expo-linear-gradient after native crash report');
assert(!analytics.includes('CasinoAnalyticsScreenFull'), 'Casino route must not import/load legacy heavy CasinoAnalyticsScreenFull');
assert(!analytics.includes('buildCruiseEconomicsSummary'), 'Casino route must not call heavy casino economics summary on mount');
assert(!analytics.includes('buildCasinoValueAttributionSummary'), 'Casino route must not call heavy attribution summary on mount');
assert(!analytics.includes('.split('), 'Casino route must not use direct string.split after Hermes split segfault report');
assert(analytics.includes('CASINO_SAFE_NATIVE_CRASH_MITIGATION_MOUNTED'), 'Casino route must log native crash mitigation mount');
assert(analytics.includes('slice(0, 80)'), 'Casino route must cap render rows');
assert(pkg.version === '9.11.59', 'package version should be 9.11.59');
assert(app.expo.version === '9.11.59', 'expo version should be 9.11.59');
assert(app.expo.ios.buildNumber === '9.11.59', 'iOS build should be 9.11.59');
assert(app.expo.android.versionCode === 91159, 'Android versionCode should be 91159');
console.log('✅ v1069 Casino native crash mitigation checks passed');
