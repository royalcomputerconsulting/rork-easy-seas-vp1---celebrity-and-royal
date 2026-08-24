const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);
assert.equal(pkg.version, '13.0.44');
assert.equal(app.ios.bundleIdentifier, 'app.rork.easy-seas-vp1-celebrity-and-royal');

const safetyFile = path.join(root, 'lib/webViewSourceSafety.ts');
const compiled = ts.transpileModule(fs.readFileSync(safetyFile, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: safetyFile,
}).outputText;
const mod = new Module(safetyFile, module);
mod.filename = safetyFile;
mod.paths = Module._nodeModulePaths(path.dirname(safetyFile));
mod._compile(compiled, safetyFile);
assert.equal(mod.exports.isSafeRemoteWebViewUrl('https://www.carnival.com/profilemanagement/profiles/cruises'), true);
assert.equal(mod.exports.isSafeRemoteWebViewUrl('http://localhost:8081'), true);
for (const unsafe of [undefined, null, '', 'file:///tmp/carnival.html', 'about:blank', 'data:text/html,test', '/tmp/file.html', 'https://']) {
  assert.equal(mod.exports.isSafeRemoteWebViewUrl(unsafe), false, `unsafe WebView source accepted: ${String(unsafe)}`);
}
assert.equal(
  mod.exports.getSafeRemoteWebViewUrl('file:///tmp/carnival.html', 'https://www.carnival.com/profilemanagement/profiles/cruises'),
  'https://www.carnival.com/profilemanagement/profiles/cruises',
);

const carnival = read('app/carnival-sync.tsx');
assert.ok(carnival.includes('source={{ uri: safeWebViewUrl }}'));
assert.ok(!carnival.includes('allowingReadAccessToURL'));
assert.ok(!carnival.includes('about:blank'));
assert.ok(!carnival.includes("source={{ uri: webViewUrl }}"));

const packageSourceGate = pkg.scripts['verify:source-release'];
assert.match(packageSourceGate, /runMaintainedReleaseTests/);
assert.match(packageSourceGate, /verifyBuild337Startup/);
assert.match(packageSourceGate, /build356_performance_certificate_carnival_regression/);
assert.match(pkg.scripts['verify:testflight-evidence'], /verifyTestFlightReleaseEvidence/);

assert.equal(fs.existsSync(path.join(root, 'PHASE3_RELEASE_GATE_STATUS.json')), false, 'old QA status artifact must not ship');

assert.ok(fs.existsSync(path.join(root, 'tests/phase1_critical_sync_repairs_regression.js')));
assert.ok(fs.existsSync(path.join(root, 'tests/phase2_certificates_logo_regression.js')));
console.log('PASS build330_phase3_release_candidate_regression');
