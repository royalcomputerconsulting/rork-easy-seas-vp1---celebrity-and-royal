const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
}

const analyticsPath = path.join(process.cwd(), 'app/(tabs)/analytics.tsx');
const analytics = fs.readFileSync(analyticsPath, 'utf8');

assert(analytics.includes('class CasinoTabCrashBoundary'), 'Casino tab crash boundary is missing');
assert(analytics.includes('<CasinoTabCrashBoundary tabKey={activeTab}>'), 'Active casino tab content is not wrapped in the crash boundary');
assert(analytics.includes('formatSafeDateLabel(clubRoyaleNextResetDate)'), 'Club Royale reset date still assumes a Date object');
assert(analytics.includes('safeArray(localData?.booked'), 'Booked cruises are not safely read from localData');
assert(!analytics.includes('localData.booked'), 'Unsafe localData.booked access remains');
assert(!analytics.includes('localData.offers'), 'Unsafe localData.offers access remains');
assert(analytics.includes('renderColorfulProgressionLevelsCard'), 'Colorful progression chart section is missing');
assert(analytics.includes("renderColorfulProgressionLevelsCard('portfolio')"), 'Portfolio colorful progression section is missing');
assert(analytics.includes("renderColorfulProgressionLevelsCard('value')"), 'Value colorful progression section is missing');
assert(analytics.includes("renderColorfulProgressionLevelsCard('play')"), 'Play colorful progression section is missing');
assert(analytics.includes("renderColorfulProgressionLevelsCard('forecast')"), 'Forecast colorful progression section is missing');
assert(analytics.includes('progressionLevelPill'), 'Progression level UI styles are missing');
assert(analytics.includes('colorChartFill'), 'Color chart bar UI styles are missing');
assert(analytics.includes('safeNumber(currentSeasonMetrics.averagePointsPerNight).toFixed(2)'), 'Average points/night render is not null-safe');
assert(analytics.includes('safeNumber(currentSeasonMetrics.averageDailyPlayHours).toFixed(2)'), 'Average daily play hours render is not null-safe');

const result = ts.transpileModule(analytics, {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  reportDiagnostics: true,
  fileName: analyticsPath,
});
const diagnostics = (result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
assert(diagnostics.length === 0, `TypeScript transpile errors: ${diagnostics.map((d) => d.messageText).join('; ')}`);

const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const appJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'app.json'), 'utf8'));
assert(packageJson.version === '9.11.54', 'package.json version should be 9.11.54');
assert(appJson.expo.version === '9.11.54', 'app.json expo.version should be 9.11.54');
assert(appJson.expo.ios.buildNumber === '9.11.54', 'iOS buildNumber should be 9.11.54');
assert(appJson.expo.android.versionCode === 91154, 'Android versionCode should be 91154');

console.log('✅ v1064 casino tab crash + colorful progression UI checks passed');
