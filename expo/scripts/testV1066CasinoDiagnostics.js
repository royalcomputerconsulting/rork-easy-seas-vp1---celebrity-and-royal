const fs = require('fs');
function read(p){ return fs.readFileSync(p,'utf8'); }
function assert(cond,msg){ if(!cond){ console.error('❌ '+msg); process.exit(1); } }
const analytics = read('app/(tabs)/analytics.tsx');
const diag = read('lib/diagnosticLogger.ts');
const pkg = JSON.parse(read('package.json'));
const app = JSON.parse(read('app.json')).expo;
assert(diag.includes("| 'CASINO'") || diag.includes("'CASINO'"), 'diagnostic logger includes CASINO category');
assert(diag.includes('recordDiagnosticError'), 'recordDiagnosticError helper exists');
assert(diag.includes('GLOBAL_FATAL_ERROR'), 'global fatal ErrorUtils handler is installed');
assert(diag.includes('UNHANDLED_PROMISE_REJECTION'), 'unhandled promise rejection logging is installed');
assert(diag.includes('CASINO / ANALYTICS EVENTS'), 'diagnostic export has casino analytics section');
assert(diag.includes('formatEventDetail'), 'diagnostic export includes event data details');
assert(analytics.includes('recordDiagnosticEvent, recordDiagnosticError'), 'analytics imports diagnostic helpers');
assert(analytics.includes('ANALYTICS_SCREEN_MOUNTED'), 'analytics screen mount is logged');
assert(analytics.includes('CASINO_TAB_SELECTED'), 'casino tab selection is logged');
assert(analytics.includes('CASINO_PIPELINE_READY'), 'casino pipeline summary is logged');
assert(analytics.includes('CASINO_TAB_RENDER_RECOVERED'), 'section crash boundary records diagnostic error');
assert(analytics.includes('ANALYTICS_ROOT_RENDER_RECOVERED'), 'root crash boundary records diagnostic error');
assert(analytics.includes('CURRENT_SEASON_METRICS_FAILED'), 'current season metrics failure is logged');
assert(pkg.version === '9.11.56', 'package version bumped to 9.11.56');
assert(app.version === '9.11.56', 'expo version bumped to 9.11.56');
assert(app.ios.buildNumber === '9.11.56', 'ios build bumped');
assert(app.android.versionCode === 91156, 'android version code bumped');
console.log('✅ v1066 casino diagnostics checks passed');
