const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function loadTs(relativePath) {
  const filename = path.join(root, relativePath);
  const compiled = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(compiled, filename);
  return mod.exports;
}

const runtime = loadTs('lib/carnival/carnivalInventoryRuntime.ts');

assert.equal(runtime.shouldRetryCarnivalSearchPage({
  rowCount: 0,
  pageContextMatched: true,
  resultStable: true,
}, 1, 2), false, 'a stable exact-context empty page must not reload in circles');

assert.equal(runtime.shouldRetryCarnivalSearchPage({
  rowCount: 0,
  pageContextMatched: false,
  resultStable: false,
}, 1, 2), true, 'one real reload remains available for an unsettled page');

assert.equal(runtime.shouldRetryCarnivalSearchPage({
  rowCount: 0,
  pageContextMatched: false,
  resultStable: false,
}, 2, 2), false, 'an unsettled page is bounded to one reload');

assert.equal(runtime.shouldRetryCarnivalSearchPage({
  rowCount: 1,
  pageContextMatched: true,
  resultStable: true,
}, 1, 2), false, 'captured inventory must continue to pagination without a redundant reload');

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.match(provider, /let activeCarnivalIngestionToken: symbol \| null = null/);
assert.match(provider, /await activeCarnivalIngestionCompletion/);
assert.match(provider, /instead of starting a duplicate run/);
assert.match(provider, /the duplicate start was ignored/);
assert.match(provider, /attempt <= 2/);
assert.match(provider, /shouldRetryCarnivalSearchPage/);
assert.doesNotMatch(provider, /attempt <= 3/);

const cancelStart = provider.indexOf('const cancelSync = useCallback');
const cancelEnd = provider.indexOf('const resumeCarnivalSync = useCallback', cancelStart);
const cancelBlock = provider.slice(cancelStart, cancelEnd > cancelStart ? cancelEnd : cancelStart + 2500);
assert.ok(cancelStart >= 0, 'Carnival cancellation callback must exist');
assert.doesNotMatch(cancelBlock, /ingestionInFlightRef\.current = false/, 'Back/cancel must not unlock before the active run unwinds');
assert.match(cancelBlock, /syncStopRequestedRef\.current = true/);

const screen = read('app/carnival-sync.tsx');
assert.match(screen, /Logged In — Ready to Sync/);
assert.match(screen, /testID="carnival-run-ingestion-button"/);
assert.doesNotMatch(screen, /autoSyncStartedForLoginRef/);
assert.doesNotMatch(screen, /autoSyncAttemptInFlightRef/);

const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);
assert.equal(pkg.version, '13.0.44');

console.log('PASS Build 383 Carnival single-flight start, immediate cancellation, and bounded stable-page retry regression');
