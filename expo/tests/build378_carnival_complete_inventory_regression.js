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
const canonical = new URL(runtime.buildCarnivalNextPageUrl({
  currentUrl: 'https://www.carnival.com/cruise-search?rateCodes=O7O%2CO16%2CO17&ratecodes=O7O&pageNumber=1&pageSize=50',
  offerCode: 'O7O',
  nextPageNumber: 2,
  pageSize: 50,
}));
const rateKeys = Array.from(canonical.searchParams.keys()).filter((key) => /^ratecodes?$/i.test(key));
assert.deepEqual(rateKeys, ['rateCodes'], 'Carnival search URL must emit one canonical rateCodes key');
assert.equal(canonical.searchParams.get('rateCodes'), 'O7O,O16,O17', 'official companion rate-code families must be preserved');
assert.equal(canonical.searchParams.get('pageNumber'), '2');

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.match(provider, /primeCarnivalSearchCaptureContext/);
assert.match(provider, /__easySeasCarnivalSearchContext/);
assert.match(provider, /_easySeasRetry/);
assert.match(provider, /retrying the Carnival results request once/);
assert.match(provider, /attempt <= 2/);
assert.match(provider, /status !== 'captured'/, 'resume must skip rate codes with completed pagination proof');
assert.match(provider, /carnivalOutcome === 'partial'[\s\S]{0,220}?'resumable'/);
assert.match(provider, /one or more rate codes are not fully paginated/);
assert.match(provider, /last complete Carnival dataset remains unchanged/);

const auth = read('lib/royalCaribbean/authDetection.ts');
assert.match(auth, /sessionStorage\.getItem\('__easySeasCarnivalSearchContext'\)/);
assert.match(auth, /contextCode && pageCodes\.indexOf\(contextCode\) >= 0/);

const scraper = read('lib/carnival/carnivalSafeSync.ts');
assert.match(scraper, /settleLazyResults/);
assert.match(scraper, /pagination-next/);

const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);
assert.equal(pkg.version, '13.0.44');

console.log('PASS Build 383 Carnival: canonical CTA URLs, real reload capture, complete-only publishing, and resumable missing-rate-code pagination');
