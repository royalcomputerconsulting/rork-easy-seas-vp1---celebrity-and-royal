const fs = require('fs');
const path = require('path');

const root = process.cwd();
const analyticsPath = path.join(root, 'app/(tabs)/analytics.tsx');
const pkgPath = path.join(root, 'package.json');
const appPath = path.join(root, 'app.json');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const analytics = fs.readFileSync(analyticsPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));

assert(pkg.version === '9.11.62', 'package version must be 9.11.62');
assert(app.expo.version === '9.11.62', 'expo version must be 9.11.62');
assert(app.expo.ios.buildNumber === '9.11.62', 'ios build number must be 9.11.62');
assert(app.expo.android.versionCode === 91162, 'android version code must be 91162');
assert(analytics.includes('type DetailPayload'), 'DetailPayload type must exist');
assert(analytics.includes('buildCruiseDetail'), 'Cruise detail builder must exist');
assert(analytics.includes('buildMetricDetail'), 'Metric detail builder must exist');
assert(analytics.includes('buildShipDetail'), 'Ship detail builder must exist');
assert(analytics.includes('<Modal visible={!!detail}'), 'Detail modal must be rendered');
assert(analytics.includes('CASINO_V1072_DETAIL_OPENED'), 'Detail open diagnostic event must exist');
assert((analytics.match(/onOpenDetail/g) || []).length >= 10, 'Pages and rows must wire onOpenDetail extensively');
assert((analytics.match(/onPress=\{\(\) => onOpenDetail/g) || []).length >= 10, 'Clickable drill-down onPress handlers must exist');
assert(analytics.includes('Coin-in is volume, not cost'), 'Coin-in guardrail must appear in detail notes');
assert(!analytics.includes('CasinoAnalyticsScreenFull'), 'Casino route must not import/load legacy heavy screen');
assert(!analytics.includes('expo-linear-gradient'), 'Casino route must not use native gradient dependency');
assert(!analytics.includes('.split('), 'Casino route must avoid direct split calls');
assert(analytics.includes('v1072: Casino dashboard drill-downs enabled'), 'Footer must reflect v1072 drill-down build');

console.log('✅ v1072 Casino drill-down checks passed');
