const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const analytics = read('app/(tabs)/analytics.tsx');
const pkg = JSON.parse(read('package.json'));
const app = JSON.parse(read('app.json'));

assert(analytics.includes('class AnalyticsScreenRootBoundary'), 'Analytics root crash boundary missing');
assert(analytics.includes('<AnalyticsScreenRootBoundary>'), 'Default export does not wrap analytics content in root boundary');
assert(analytics.includes('function AnalyticsScreenContent()'), 'Analytics content component missing');
assert(analytics.includes('[Analytics] Casino tab data flow failed; using empty fallback'), 'Casino data-flow safe fallback missing');
assert(analytics.includes('[Analytics] Casino value attribution failed; using empty fallback'), 'Casino attribution safe fallback missing');
assert(analytics.includes('[Analytics] Cruise economics summary failed; using empty fallback'), 'Cruise economics safe fallback missing');
assert(analytics.includes('[Analytics] Host View profile failed; using empty fallback'), 'Host View safe fallback missing');
assert(analytics.includes('[Analytics] Raw session analytics failed; using empty analytics fallback'), 'Raw session analytics fallback missing');
assert(analytics.includes('testID="analytics-root-recovered-error"'), 'Root recovery UI testID missing');
assert(analytics.includes('testID={`casino-colorful-progression-${context}`}'), 'Colorful progression section missing');
assert(pkg.version === '9.11.55', `package version expected 9.11.55 got ${pkg.version}`);
assert(app.expo.version === '9.11.55', `expo version expected 9.11.55 got ${app.expo.version}`);
assert(app.expo.ios.buildNumber === '9.11.55', 'iOS build number not bumped');
assert(app.expo.android.versionCode === 91155, 'Android versionCode not bumped');

console.log('✅ v1065 casino route hardening checks passed');
