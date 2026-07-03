const fs = require('fs');
const path = require('path');

const root = process.cwd();
const analyticsPath = path.join(root, 'app/(tabs)/analytics.tsx');
const pkgPath = path.join(root, 'package.json');
const appPath = path.join(root, 'app.json');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

const analytics = fs.readFileSync(analyticsPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));

assert(pkg.version === '9.11.60', 'package version must be 9.11.60');
assert(app.expo.version === '9.11.60', 'app version must be 9.11.60');
assert(app.expo.android.versionCode === 91160, 'android versionCode must be 91160');
assert(app.expo.ios.buildNumber === '9.11.60', 'ios build number must be 9.11.60');

assert(!analytics.includes('expo-linear-gradient'), 'Casino route must not import expo-linear-gradient');
assert(!analytics.includes('CasinoAnalyticsScreenFull'), 'Casino route must not import legacy CasinoAnalyticsScreenFull');
assert(!analytics.includes('.split('), 'Casino route should avoid direct .split calls after Hermes crash');
assert(analytics.includes("type CasinoTab = 'portfolio' | 'value' | 'action' | 'history'"), 'four section tab type must exist');
assert(analytics.includes('function CasinoPortfolioPage'), 'CasinoPortfolioPage must exist');
assert(analytics.includes('Casino Portfolio'), 'Casino Portfolio label must exist');
assert(analytics.includes('Cruise Value'), 'Cruise Value label must exist');
assert(analytics.includes('Action Center'), 'Action Center label must exist');
assert(analytics.includes('History & Simulator'), 'History & Simulator label must exist');
assert(analytics.includes('Completed Cruise Sailings'), 'Completed Cruise Sailings section must exist');
assert(analytics.includes('Ship Casino Performance'), 'Ship Casino Performance section must exist');
assert(analytics.includes('Data Integrity'), 'Data Integrity section must exist');
assert(analytics.includes('Colorful') || analytics.includes('Progress'), 'progression visuals must exist');
assert(analytics.includes('rows.slice(0, 8)'), 'rendered cruise rows must remain capped');
assert(analytics.includes('ships.slice(0, 6)'), 'rendered ship rows must remain capped');
assert(analytics.includes('CASINO_V1070_PORTFOLIO_DASHBOARD_MOUNTED'), 'v1070 diagnostic mount event must exist');

console.log('✅ v1070 Casino Portfolio dashboard checks passed');
