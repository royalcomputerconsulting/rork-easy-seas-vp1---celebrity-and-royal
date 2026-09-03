const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = JSON.parse(read('app.json')).expo;
const packageJson = JSON.parse(read('package.json'));

const parserCore = read('lib/certificates/certificatePdfParserCore.ts');
const clientEngine = read('lib/certificates/clientCertificatePdfEngine.ts');
const pipeline = read('lib/certificates/certificatePdfPipeline.ts');
const transport = read('lib/certificates/certificateBinaryTransport.ts');
const documentStore = read('lib/certificates/certificateDocumentStore.ts');
const carnival = read('lib/carnival/carnivalSafeSync.ts');
const carnivalRuntime = read('lib/carnival/carnivalInventoryRuntime.ts');
const carnivalOffers = read('lib/carnival/carnivalOffersExtraction.ts');

assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);
assert.equal(packageJson.version, '13.0.44');

assert.doesNotMatch(parserCore, /\(\?<\!/, 'The shared certificate parser must not use lookbehind unsupported by shipped Hermes runtimes.');
assert.doesNotMatch(clientEngine, /\(\?<\!/, 'The direct certificate engine must not use lookbehind unsupported by shipped Hermes runtimes.');
assert.match(parserCore, /v2\.4\.0-hermes-explicit-date-parser/);
assert.match(pipeline, /certificate-parser-v2\.4-hermes-explicit-date-parser/);
assert.match(transport, /Referer: 'https:\/\/www\.royalcaribbean\.com\/'/);
assert.match(transport, /'User-Agent': 'Mozilla\/5\.0/);
assert.match(documentStore, /restoreCertificateDocumentBytesForReprocess/);
assert.match(documentStore, /readAsStringAsync\(archiveUri/);
assert.match(documentStore, /sha256DocumentHash\(bytes\) !== record\.documentHash/);

assert.match(carnival, /\[data-testid\^="tripTile_"\]/, 'Carnival collector must recognize the current trip-tile result cards.');
assert.match(carnival, /new URL\('\/cruisesearch\/api\/search'/, 'Carnival sync must use the current observed cruise-search API route.');
assert.match(carnival, /results\.itineraries/);
assert.match(carnival, /Array\.isArray\(itinerary\.sailings\)/);
assert.match(carnival, /current_carnival_api/);
assert.match(carnival, /directInventory\.totalResults > 0 \? directInventory\.totalResults : directRows\.length/);
assert.match(carnival, /clicked < 250/, 'Carnival collector must expand every displayed itinerary date group, not just the first 40.');
assert.match(carnival, /clicked % 12 === 0/, 'Date expansion must yield in bounded batches so the WebView stays responsive.');
assert.match(carnival, /sailDate\|departureDate\|startDate\|date/);
assert.match(carnival, /itineraryLabelMatch/);
assert.match(carnival, /for \(var pass = 0; pass < 16 && stablePasses < 3; pass\+\+\)/);
assert.doesNotMatch(carnival, /if \(href && \/book\|cruise\|itinerary\/i\.test\(href\)\) break/, 'All expanded booking links must be scanned so later sail dates are retained.');
assert.match(carnivalRuntime, /current-carnival-results-itineraries/);
assert.match(carnivalRuntime, /\['results', 'itineraries'\]/);
assert.match(carnivalOffers, /'\/cruisesearch\/api\/search\?\{QUERY\}'/);

function verifyExactDeviceCertificateFallback() {
  const originalLoad = Module._load;
  Module._load = function patchedCertificateLoad(request, parent, isMain) {
    if (String(request).includes('certificateDocumentStore')) {
      return {
        archiveCertificatePdfBytes: async () => ({}),
        archiveCertificatePdfBytesBatch: async () => new Map(),
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const { loadTs } = require('../scripts/clubRoyaleTestBootstrap');
    const engine = loadTs('lib/certificates/clientCertificatePdfEngine.ts');
    const bytes = new Uint8Array(fs.readFileSync(path.join(root, 'tests/fixtures/certificates/2608C07.pdf')));
    const result = engine.parseCertificatePdfBytesWithDeviceFallbackFixture({ certificateCode: '2608C07', pdfBytes: bytes });
    assert.equal(result.parserAuthority, 'shared-device-pdf-fallback');
    assert.equal(result.sailingCount, 544, 'The exact C07 PDF that failed on iPhone must retain every sailing in the production fallback branch.');
    assert.equal(result.firstSailing.shipName, 'Enchantment Of The Seas');
    assert.equal(result.firstSailing.sailDate, '2026-08-08');
    assert.equal(result.lastSailing.shipName, 'Serenade Of The Seas');
    assert.equal(result.lastSailing.sailDate, '2027-08-01');
  } finally {
    Module._load = originalLoad;
  }
}

verifyExactDeviceCertificateFallback();

function loadCarnivalSafeSync() {
  const filename = path.join(root, 'lib/carnival/carnivalSafeSync.ts');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === './carnivalDataRuntime') {
      return {
        CARNIVAL_SHIP_CODE_MAP: {},
        CARNIVAL_VIFP_TIER_BY_CODE: {},
        decodeCarnivalVifpTier: () => ({ tier: '' }),
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(compiled, filename);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

async function verifyCurrentCarnivalRuntime() {
  const safeSync = loadCarnivalSafeSync();
  const expectedUrl = 'https://www.carnival.com/cruise-search?pageNumber=1&pagesize=50&numadults=2&ratecodes=G3J';
  const messages = [];
  // Carnival rewrites the visible URL after login and may remove the rate-code
  // query entirely. The exact, verified same-origin API request must still run.
  const location = new URL('https://www.carnival.com/cruise-search?numadults=2&pagesize=8');
  const apiPayload = {
    filters: { rateCodes: ['G3J'], pageNumber: 1, pageSize: 50 },
    results: {
      currentPage: 1,
      lastPage: 2,
      totalResults: 75,
      itineraries: [{
        shipName: 'Carnival Celebration',
        shipCode: 'CB',
        departurePortName: 'Miami, FL',
        dur: 7,
        itineraryTitle: 'Eastern Caribbean',
        regionName: 'Caribbean',
        portsToDisplay: ['Miami', 'Nassau'],
        sailings: [{
          departureDate: '2026-09-05T00:00:00',
          sailingId: 'CB09052026',
          sailingURL: '/booking?rateCodes=G3J&sailDate=09052026',
          rooms: {
            interior: { price: 399, taxesAndFees: 100, soldOut: false },
            oceanview: { price: 499, taxesAndFees: 100, soldOut: false },
            balcony: { price: 599, taxesAndFees: 100, soldOut: false },
            suite: { price: 999, taxesAndFees: 100, soldOut: false },
          },
        }],
      }],
    },
  };
  const window = {
    location,
    scrollY: 0,
    scrollTo: () => undefined,
    ReactNativeWebView: { postMessage: (message) => messages.push(JSON.parse(message)) },
    fetch: async (url) => ({
      ok: true,
      url: String(url),
      json: async () => apiPayload,
    }),
  };
  const document = {
    body: { innerText: '1 Cruise Result', scrollHeight: 100 },
    documentElement: { scrollHeight: 100 },
    querySelectorAll: () => [],
    querySelector: () => null,
  };
  const script = safeSync.injectCarnivalSearchPageScrape({
    requestId: 'request-1', runId: 'run-1', contextFingerprint: 'fingerprint-1',
    expectedUrl, offerCode: 'G3J', offerName: 'Fun-Filled Getaway Sale',
    offerExpiry: '', perks: 'Sale', pageNumber: 1, pageSize: 50,
  });
  vm.runInNewContext(script, { window, document, URL, AbortController, setTimeout, clearTimeout, console });
  await new Promise((resolve) => setTimeout(resolve, 350));
  const row = messages.find((message) => message.type === 'carnival_search_page_chunk')?.rows?.[0];
  const complete = messages.find((message) => message.type === 'carnival_search_page_complete');
  assert.equal(row.shipName, 'Carnival Celebration');
  assert.equal(row.sailingDate, '09/05/2026');
  assert.equal(row.interiorPrice, '$798');
  assert.equal(row.taxesAndFees, '$200');
  assert.equal(row.carnivalSailingId, 'CB09052026');
  assert.equal(complete.rowCount, 1);
  assert.equal(complete.payloadMatched, true);
  assert.equal(complete.requestProof, true);
  assert.equal(complete.pageProof, true);
  assert.equal(complete.totalResults, 75, 'Carnival itinerary-group totals must not be inflated by nested sailing-date rows.');
  assert.equal(complete.hasNextPage, true);
  assert.equal(complete.readiness, 'authoritative-current-carnival-api');
  assert.ok(messages.some((message) => message.type === 'log' && /verified 1 sailing from the inventory API; more pages remain/.test(message.message)));
}

verifyCurrentCarnivalRuntime().then(() => {
  console.log('PASS Build 388 certificate and Carnival release blockers regression');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
