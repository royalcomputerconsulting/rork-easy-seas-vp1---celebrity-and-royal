const fs = require('fs');
const path = require('path');
const os = require('os');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const ts = require('typescript');

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
const screen = read('app/carnival-sync.tsx');
const safeSyncSource = read('lib/carnival/carnivalSafeSync.ts');

for (const forbidden of [
  'CARNIVAL_RATE_CODE_ENRICHMENT_LIMIT',
  'CARNIVAL_RATE_CODE_ENRICHMENT_BUDGET_MS',
  'CARNIVAL_UNACKNOWLEDGED_ABORT_THRESHOLD',
  'allOffersToEnrich.slice(',
  'waitForOfferSailings(offer.offerCode, 22000)',
]) {
  assert(!provider.includes(forbidden), `Legacy partial-scrape limiter remains: ${forbidden}`);
}

for (const required of [
  'const offersToEnrich = allOffersToEnrich',
  'injectCarnivalSearchPageScrape',
  'CARNIVAL_SEARCH_MAX_PAGES = 50',
  'STEP 1.5 PARTIAL/RESUMABLE',
  'Ignored a stale Carnival page completion',
  'page_scrape_timeout',
  'renderedTerminalProof',
]) {
  assert(provider.includes(required), `Full-catalog runtime marker missing: ${required}`);
}

assert(screen.includes("evidence: isLoggedIn ? 'protected_account_page' : 'visible_sign_in_form'"), 'Carnival screen must send explicit auth evidence');
assert(!screen.includes('var isLoggedIn = !hasForm'), 'Absence of a password input must not be treated as proof of login');
assert(safeSyncSource.includes('displayedTotalReached'), 'Rendered-page completion must validate the advertised total');

for (const file of ['state/RoyalCaribbeanSyncProvider.tsx', 'app/carnival-sync.tsx', 'lib/carnival/carnivalSafeSync.ts']) {
  const result = ts.transpileModule(read(file), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: file,
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert(errors.length === 0, `${file} has syntax diagnostics: ${errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, ' ')).join('; ')}`);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'easyseas-build371-carnival-'));
for (const file of ['lib/carnival/carnivalDataRuntime.ts', 'lib/carnival/carnivalSafeSync.ts']) {
  const result = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: file,
  });
  const output = path.join(tempRoot, file.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, result.outputText);
}
const safeSync = require(path.join(tempRoot, 'lib/carnival/carnivalSafeSync.js'));
new Function(safeSync.injectCarnivalSearchPageScrape({
  requestId: 'request-1',
  runId: 'run-1',
  contextFingerprint: 'run-1|FBN',
  expectedUrl: 'https://www.carnival.com/cruise-search?ratecodes=FBN&pageNumber=1&pagesize=50',
  offerCode: 'FBN',
  offerName: 'Fixture offer',
  offerExpiry: '',
  perks: '',
  pageNumber: 1,
  pageSize: 50,
  priorUniqueCount: 0,
}));

console.log('PASS Build 371 Carnival full-catalog, auth, pagination, and syntax regression');
