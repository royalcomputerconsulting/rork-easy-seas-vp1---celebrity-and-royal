const fs = require('fs');
const path = require('path');

const root = process.cwd();
const analytics = fs.readFileSync(path.join(root, 'app/(tabs)/analytics.tsx'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(pkg.version === '9.11.58', 'package version should be 9.11.58');
assert(app.expo.version === '9.11.58', 'expo version should be 9.11.58');
assert(app.expo.ios.buildNumber === '9.11.58', 'iOS build number should be 9.11.58');
assert(app.expo.android.versionCode === 91158, 'Android version code should be 91158');
assert(!analytics.includes('require(\'@/components/analytics/CasinoAnalyticsScreenFull\')'), 'Casino route should not dynamically require the legacy heavy analytics module');
assert(!analytics.includes('useEntitlement()'), 'Casino route should not trigger RevenueCat entitlement checks just by opening the Casino tab');
assert(analytics.includes('CASINO_STABLE_ROUTE_MOUNTED'), 'Stable route mount diagnostic missing');
assert(analytics.includes('CASINO_STABLE_TAB_SELECTED'), 'Stable tab selection diagnostic missing');
assert(analytics.includes('buildSafe('), 'Safe builder wrapper missing');
assert(analytics.includes("type CasinoTab = 'portfolio' | 'value' | 'play' | 'forecast'"), 'Four stable casino tabs missing');
assert(analytics.includes('Colorful Charts & Progression Levels'), 'Colorful progression section missing');
assert(analytics.includes('Offer Attribution Ledger'), 'Offer attribution ledger missing');
assert(analytics.includes('True Make-Out Ledger'), 'True make-out ledger missing');
assert(analytics.includes('Certificate Created by Play'), 'Certificate created by play section missing');
assert(analytics.includes('Keep Playing / Stop Playing Decision'), 'Keep playing decision section missing');

console.log('✅ v1068 Casino stable route QA checks passed');
