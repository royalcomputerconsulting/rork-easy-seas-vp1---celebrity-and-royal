const fs = require('fs');
const path = require('path');

const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'app/(tabs)/analytics.tsx'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log('V1078 Casino crash guard QA');
assert(pkg.version === '9.11.68', 'package version bumped to 9.11.68');
assert(app.expo.version === '9.11.68', 'app config version bumped to 9.11.68');
assert(app.expo.newArchEnabled === false, 'Expo New Architecture remains disabled');
assert(!JSON.stringify(pkg.dependencies).includes('react-native-purchases'), 'RevenueCat native dependency remains removed');
assert(!JSON.stringify(pkg.dependencies).includes('react-native-maps'), 'react-native-maps remains absent');
assert(route.includes('class CasinoCrashBoundary extends React.Component'), 'Casino render error boundary exists');
assert(route.includes('<CasinoCrashBoundary activeTab={activeTab}>'), 'Casino sections are wrapped in crash guard');
assert(route.includes('componentDidCatch()'), 'Casino crash guard catches render failures without native diagnostics');
assert(route.includes('CASINO_TOTALS_FAILED'), 'Casino totals are safeRun-protected');
assert(route.includes('CASINO_SHIPS_FAILED'), 'Casino ship performance is safeRun-protected');
assert(route.includes('CASINO_SESSIONS_FAILED'), 'Casino sessions are safeRun-protected');
assert(route.includes('lines: asArray(payload?.lines).slice(0, 40)'), 'Casino detail modal caps/normalizes detail lines');
assert(route.includes('notes: asArray(payload?.notes).slice(0, 10)'), 'Casino detail modal caps/normalizes notes');
assert(route.includes('asArray(detail?.lines).map'), 'Casino detail modal never maps possibly undefined lines');
assert(!route.includes('CasinoAnalyticsScreenFull'), 'Legacy heavy CasinoAnalyticsScreenFull is not imported');
assert(!route.includes('diagnosticLogger'), 'Casino route does not import diagnostic logger');
assert(!route.includes('expo-linear-gradient'), 'Casino route avoids native gradient dependency');
assert(route.includes('slice(0, 80)'), 'Casino data/session rendering remains capped');
console.log('🎉 V1078 passed: Casino tab has render/data/detail crash guardrails.');
