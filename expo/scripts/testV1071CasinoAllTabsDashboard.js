const fs = require('fs');
const path = require('path');

const root = process.cwd();
const analyticsPath = path.join(root, 'app/(tabs)/analytics.tsx');
const pkgPath = path.join(root, 'package.json');
const appJsonPath = path.join(root, 'app.json');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

const source = fs.readFileSync(analyticsPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

assert(pkg.version === '9.11.61', 'package.json version should be 9.11.61');
assert(appJson.expo.version === '9.11.61', 'app.json expo.version should be 9.11.61');
assert(appJson.expo.ios.buildNumber === '9.11.61', 'iOS buildNumber should be 9.11.61');
assert(appJson.expo.android.versionCode === 91161, 'Android versionCode should be 91161');

assert(source.includes("type CasinoTab = 'portfolio' | 'value' | 'action' | 'history'"), 'all four Casino tabs should be typed');
assert(source.includes('function CasinoPortfolioPage'), 'Casino Portfolio page should exist');
assert(source.includes('function CruiseValuePage'), 'Cruise Value page should exist');
assert(source.includes('function ActionCenterPage'), 'Casino Action Center page should exist');
assert(source.includes('function HistorySimulatorPage'), 'History & Simulator page should exist');

for (const label of ['Casino Portfolio', 'Cruise Value', 'Action Center', 'History & Simulator']) {
  assert(source.includes(label), `${label} label should appear`);
}

for (const section of [
  'Cruise Value Overview',
  'Cruise Economics Ledger',
  'Offer Attribution Ledger',
  'True Make-Out Ledger',
  'Casino Action Center',
  'Upcoming Cruises',
  'Offers Expiring Soon',
  'Instant Certificate Bank',
  'Today\'s Action Items',
  'History & Simulator',
  'Historical Casino Points',
  'Ship Performance History',
  'Simulator Builder',
  'Keep Playing / Stop Playing Decision',
]) {
  assert(source.includes(section), `${section} should be present`);
}

assert(!source.includes('CasinoAnalyticsScreenFull'), 'stable Casino route must not import/load legacy heavy CasinoAnalyticsScreenFull');
assert(!source.includes('expo-linear-gradient'), 'stable Casino route must not import expo-linear-gradient');
assert(!source.includes('.split('), 'stable Casino route must avoid direct string split calls after Hermes native crash');
assert(source.includes('slice(0, 80)'), 'Casino rows should be capped at 80 before display calculations');
assert(source.includes('slice(0, 8)'), 'display tables should be capped for native/Fabric safety');
assert(source.includes('CASINO_V1071_ALL_TABS_DASHBOARD_MOUNTED'), 'v1071 diagnostic mount event should exist');
assert(source.includes('v1071: all four Casino dashboard tabs rebuilt'), 'v1071 footer should identify all-tab rebuild');

console.log('✅ v1071 Casino all-tabs dashboard checks passed');
