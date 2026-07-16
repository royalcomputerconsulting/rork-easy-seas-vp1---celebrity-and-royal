const fs = require('fs');
const path = require('path');
const os = require('os');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
function assert(condition, message) { if (!condition) throw new Error(message); }

const app = JSON.parse(read('app.json'));
assert(app.expo.version === '12.4.2', 'Marketing version must remain 12.4.2');
assert(app.expo.ios.buildNumber === '314', 'iOS buildNumber must remain 314');
assert(app.expo.android.versionCode === 120405, 'Android versionCode must remain 120405');

let ts;
try { ts = require('typescript'); }
catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); }

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'easyseas-carnival-priority1-3-'));
for (const relative of [
  'lib/carnival/carnivalDataRuntime.ts',
  'lib/carnival/carnivalSafeSync.ts',
  'lib/carnival/carnivalSyncRuntime.ts',
  'lib/carnival/carnivalInventoryRuntime.ts',
  'lib/royalCaribbean/authDetection.ts',
]) {
  const sourcePath = path.join(root, relative);
  const outputPath = path.join(tempRoot, relative.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const output = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: sourcePath,
    reportDiagnostics: true,
  });
  const errors = (output.diagnostics || []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert(errors.length === 0, `Syntax diagnostics while compiling ${relative}: ${errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, ' ')).join('; ')}`);
  fs.writeFileSync(outputPath, output.outputText);
}

const safeSync = require(path.join(tempRoot, 'lib/carnival/carnivalSafeSync.js'));
const syncRuntime = require(path.join(tempRoot, 'lib/carnival/carnivalSyncRuntime.js'));
const inventory = require(path.join(tempRoot, 'lib/carnival/carnivalInventoryRuntime.js'));
const authDetection = require(path.join(tempRoot, 'lib/royalCaribbean/authDetection.js'));

// Template-literal injection bodies need their own JavaScript parse test;
// TypeScript transpilation alone does not parse the code embedded inside strings.
new Function(authDetection.AUTH_DETECTION_SCRIPT);
new Function(safeSync.injectCarnivalCatalogDiscovery());
new Function(safeSync.injectCarnivalSearchPageScrape({
  requestId: 'parse-test', runId: 'run-test', expectedUrl: 'https://www.carnival.com/cruise-search?ratecodes=FBN&pageNumber=1',
  offerCode: 'FBN', offerName: 'Parse Test', offerExpiry: '', perks: '', pageNumber: 1, pageSize: 50,
}));

const sailing = (index, code = 'FBN') => ({
  rateCode: code,
  shipName: `Carnival Test ${Math.floor(index / 50) + 1}`,
  sailDate: `2027-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
  itineraryName: `Fixture itinerary ${index}`,
  departurePortName: 'Miami',
});

// Schema-first inventory capture must work even when the endpoint URL itself
// does not contain "search" or "cruise".
const schemaPayload = {
  data: {
    sailings: [sailing(1)],
    totalResults: 1,
    pageNumber: 1,
    pageSize: 50,
    hasNextPage: false,
  },
};
const schemaAnalysis = inventory.analyzeCarnivalPayload(schemaPayload, {
  requestUrl: 'https://www.carnival.com/graphql/inventory',
  responseUrl: 'https://www.carnival.com/graphql/inventory',
  method: 'POST',
  body: JSON.stringify({ rateCode: 'FBN', pageNumber: 1, pageSize: 50 }),
  expectedOfferCode: 'FBN',
  expectedPageNumber: 1,
  expectedUrl: 'https://www.carnival.com/cruise-search?ratecodes=FBN&pageNumber=1&pagesize=50',
});
assert(schemaAnalysis.kind === 'inventory', 'Schema-based sailing payload must be classified as inventory');
assert(schemaAnalysis.offerCodeMatched && schemaAnalysis.pageMatched, 'Inventory payload must prove the selected code and page');
assert(schemaAnalysis.inventoryItems.length === 1, 'Inventory adapter must expose the sailing collection');
const unrelatedCountAnalysis = inventory.analyzeCarnivalPayload({
  data: { sailings: [sailing(1)], totalResults: 1, pageNumber: 1, pageSize: 50, facets: [{ name: 'Port', buckets: [{ count: 9999 }] }] },
}, {
  requestUrl: 'https://www.carnival.com/graphql/inventory', method: 'POST',
  body: JSON.stringify({ rateCode: 'FBN', pageNumber: 1, pageSize: 50 }),
  expectedOfferCode: 'FBN', expectedPageNumber: 1,
});
assert(unrelatedCountAnalysis.totalResults === 1, 'Facet bucket counts must not overwrite the authoritative sailing total');

// Facets and pricing must never masquerade as an authoritative empty inventory.
const facetAnalysis = inventory.analyzeCarnivalPayload({
  data: { results: [], totalResults: 0, facets: [{ name: 'Ship', buckets: [] }] },
}, {
  requestUrl: 'https://www.carnival.com/api/search?ratecodes=FBN&pageNumber=1&pagesize=50',
  method: 'GET', expectedOfferCode: 'FBN', expectedPageNumber: 1,
});
assert(facetAnalysis.kind === 'facets', 'Facet payload must be separated from sailing inventory');
assert(!facetAnalysis.authoritativeEmpty, 'Facet payload cannot prove an empty sailing inventory');

const pricingAnalysis = inventory.analyzeCarnivalPayload({
  pricing: { cabins: [], availability: [], totalResults: 0 },
}, {
  requestUrl: 'https://www.carnival.com/api/search?ratecodes=FBN&pageNumber=1&pagesize=50',
  method: 'GET', expectedOfferCode: 'FBN', expectedPageNumber: 1,
});
assert(pricingAnalysis.kind === 'pricing', 'Pricing payload must be separated from sailing inventory');
assert(!pricingAnalysis.authoritativeEmpty, 'Pricing payload cannot prove an empty sailing inventory');

const mismatchedCode = inventory.analyzeCarnivalPayload(schemaPayload, {
  requestUrl: 'https://www.carnival.com/graphql/inventory', method: 'POST',
  body: JSON.stringify({ rateCode: 'O17', pageNumber: 1, pageSize: 50 }),
  expectedOfferCode: 'FBN', expectedPageNumber: 1,
});
assert(!mismatchedCode.offerCodeMatched, 'A request for a different rate code must be rejected');

const broadPayload = inventory.analyzeCarnivalPayload({
  data: { sailings: [{ ...sailing(1, 'FBN') }, { ...sailing(2, 'O17') }], totalResults: 2, pageNumber: 1, pageSize: 50 },
  rateCodes: ['FBN', 'O17'],
}, {
  requestUrl: 'https://www.carnival.com/graphql/inventory', method: 'POST', body: '{}',
  expectedOfferCode: 'FBN', expectedPageNumber: 1,
});
assert(!broadPayload.offerCodeMatched, 'A broad multi-code payload without an exact request filter must be rejected');

const mismatchedPage = inventory.analyzeCarnivalPayload(schemaPayload, {
  requestUrl: 'https://www.carnival.com/graphql/inventory', method: 'POST',
  body: JSON.stringify({ rateCode: 'FBN', pageNumber: 2, pageSize: 50 }),
  expectedOfferCode: 'FBN', expectedPageNumber: 3,
});
assert(!mismatchedPage.pageMatched, 'A response for a different page must be rejected');

const emptyAnalysis = inventory.analyzeCarnivalPayload({
  data: { sailings: [], totalResults: 0, pageNumber: 1, pageSize: 50, hasNextPage: false },
}, {
  requestUrl: 'https://www.carnival.com/graphql/inventory', method: 'POST',
  body: JSON.stringify({ rateCode: 'FBN', pageNumber: 1, pageSize: 50 }),
  expectedOfferCode: 'FBN', expectedPageNumber: 1,
});
assert(emptyAnalysis.kind === 'inventory_empty' && emptyAnalysis.authoritativeEmpty, 'Only matched clean sailing inventory may prove zero eligible sailings');

// Exact next-link URLs and cursor requests can prove later pages even when the
// endpoint does not use a numeric page parameter.
const cursorAnalysis = inventory.analyzeCarnivalPayload({ data: { sailings: [sailing(52)], totalResults: 100, nextCursor: 'next-2' } }, {
  requestUrl: 'https://www.carnival.com/graphql/inventory?ratecodes=FBN&cursor=cursor-2',
  expectedUrl: 'https://www.carnival.com/graphql/inventory?ratecodes=FBN&cursor=cursor-2',
  expectedOfferCode: 'FBN', expectedPageNumber: 2,
});
assert(cursorAnalysis.pageMatched, 'Cursor request must retain page proof for the current run sequence');

// Behavioral 329-result pagination fixture. The loop must not terminate from
// the two visible-card symptom and must capture every unique server result.
const allRows = [];
let expectedTotal = 0;
let consecutiveNoGrowth = 0;
const signatureCounts = new Map();
let finalDecision = null;
for (let page = 1; page <= 7; page += 1) {
  const start = (page - 1) * 50;
  const count = page < 7 ? 50 : 29;
  const rows = Array.from({ length: count }, (_, offset) => ({
    offerCode: 'O7O', shipName: `Carnival Fixture ${start + offset}`,
    sailingDate: `2028-01-${String((start + offset) % 28 + 1).padStart(2, '0')}`,
    itinerary: `Voyage ${start + offset}`, departurePort: 'Miami', interiorPrice: '$100',
  }));
  expectedTotal = 329;
  const before = allRows.length;
  for (const row of rows) {
    const key = inventory.createCarnivalSailingKey(row);
    if (!allRows.some((prior) => inventory.createCarnivalSailingKey(prior) === key)) allRows.push(row);
  }
  const signature = inventory.createCarnivalPageSignature({ rows, totalResults: 329, pageNumber: page, pageSize: 50 });
  const priorSignatureCount = signatureCounts.get(signature) || 0;
  finalDecision = inventory.evaluateCarnivalPaginationStep({
    currentPageNumber: page, pagesVisited: page, maxPages: 50,
    uniqueCountBefore: before, uniqueCountAfter: allRows.length, expectedTotal,
    hasNextPage: page < 7, payloadMatched: true, authoritativeEmpty: false,
    pageSignature: signature, priorSignatureCount, consecutiveNoGrowth,
  });
  signatureCounts.set(signature, finalDecision.nextSignatureCount);
  consecutiveNoGrowth = finalDecision.nextConsecutiveNoGrowth;
  if (page < 7) assert(finalDecision.continuePaging && !finalDecision.terminal, `329 fixture stopped early on page ${page}`);
}
assert(allRows.length === 329, '329 fixture must capture and deduplicate all 329 sailings');
assert(finalDecision && finalDecision.terminal && finalDecision.successfulTerminal, '329 fixture must terminate authoritatively after result 329');

const oneNoGrowth = inventory.evaluateCarnivalPaginationStep({
  currentPageNumber: 2, pagesVisited: 2, maxPages: 50,
  uniqueCountBefore: 50, uniqueCountAfter: 50, expectedTotal: 100,
  hasNextPage: true, payloadMatched: true, authoritativeEmpty: false,
  pageSignature: 'different-page-signature', priorSignatureCount: 0, consecutiveNoGrowth: 0,
});
assert(oneNoGrowth.continuePaging && !oneNoGrowth.terminal, 'One no-growth page with a new signature must not stop pagination');
const twoNoGrowth = inventory.evaluateCarnivalPaginationStep({
  currentPageNumber: 3, pagesVisited: 3, maxPages: 50,
  uniqueCountBefore: 50, uniqueCountAfter: 50, expectedTotal: 100,
  hasNextPage: true, payloadMatched: true, authoritativeEmpty: false,
  pageSignature: 'another-page-signature', priorSignatureCount: 0, consecutiveNoGrowth: oneNoGrowth.nextConsecutiveNoGrowth,
});
assert(twoNoGrowth.continuePaging && !twoNoGrowth.terminal && /no new unique sailings/i.test(twoNoGrowth.warningReason || ''), 'No-growth pages must continue while Carnival authoritatively reports a next page');
const repeatedSignature = inventory.evaluateCarnivalPaginationStep({
  currentPageNumber: 2, pagesVisited: 2, maxPages: 50,
  uniqueCountBefore: 50, uniqueCountAfter: 50, expectedTotal: 100,
  hasNextPage: true, payloadMatched: true, authoritativeEmpty: false,
  pageSignature: 'same-page', priorSignatureCount: 1, consecutiveNoGrowth: 0,
});
assert(repeatedSignature.continuePaging && !repeatedSignature.terminal && /Repeated page signature/.test(repeatedSignature.warningReason || ''), 'Repeated pages must be logged but cannot terminate while Carnival reports a next page');
const repeatedAtSafetyLimit = inventory.evaluateCarnivalPaginationStep({
  currentPageNumber: 50, pagesVisited: 50, maxPages: 50,
  uniqueCountBefore: 50, uniqueCountAfter: 50, expectedTotal: 100,
  hasNextPage: true, payloadMatched: true, authoritativeEmpty: false,
  pageSignature: 'same-page', priorSignatureCount: 2, consecutiveNoGrowth: 4,
});
assert(repeatedAtSafetyLimit.terminal && !repeatedAtSafetyLimit.successfulTerminal && /Safety page limit/.test(repeatedAtSafetyLimit.incompleteReason), 'Only the explicit safety limit may stop an authoritative repeating next-page sequence');

const domOnlyTotal = inventory.evaluateCarnivalPaginationStep({
  currentPageNumber: 1, pagesVisited: 1, maxPages: 50,
  uniqueCountBefore: 0, uniqueCountAfter: 2, expectedTotal: 2,
  hasNextPage: false, payloadMatched: false, authoritativeEmpty: false,
  pageSignature: 'dom-only', priorSignatureCount: 0, consecutiveNoGrowth: 0,
});
assert(domOnlyTotal.terminal && !domOnlyTotal.successfulTerminal, 'DOM-only displayed totals cannot mark an offer complete');

const pageUrl = inventory.buildCarnivalNextPageUrl({
  currentUrl: 'https://www.carnival.com/cruise-search?ratecodes=FBN&pageNumber=1&pagesize=50',
  offerCode: 'FBN', nextPageNumber: 2, pageSize: 50,
});
assert(new URL(pageUrl).searchParams.get('pageNumber') === '2', 'Page adapter must advance pageNumber');
const offsetUrl = inventory.buildCarnivalNextPageUrl({
  currentUrl: 'https://www.carnival.com/cruise-search?ratecodes=FBN&offset=0&pagesize=50',
  offerCode: 'FBN', nextPageNumber: 2, pageSize: 50, nextOffset: 50,
});
assert(new URL(offsetUrl).searchParams.get('offset') === '50', 'Offset adapter must advance offset');
const cursorUrl = inventory.buildCarnivalNextPageUrl({
  currentUrl: 'https://www.carnival.com/cruise-search?ratecodes=FBN&cursor=one',
  offerCode: 'FBN', nextPageNumber: 2, pageSize: 50, nextCursor: 'two',
});
assert(new URL(cursorUrl).searchParams.get('cursor') === 'two', 'Cursor adapter must advance cursor');
const nextLinkUrl = inventory.buildCarnivalNextPageUrl({
  currentUrl: 'https://www.carnival.com/cruise-search?ratecodes=O17&pageNumber=1',
  nextUrl: '/cruise-search?ratecodes=O17&pageNumber=2&pagesize=50',
  offerCode: 'O17', nextPageNumber: 2, pageSize: 50,
});
assert(safeSync.isCarnivalBookingLinkForCode(nextLinkUrl, 'O17'), 'Next-link adapter must preserve the exact offer code');
const apiNextLinkUrl = inventory.buildCarnivalNextPageUrl({
  currentUrl: 'https://www.carnival.com/cruise-search?ratecodes=FBN&pageNumber=1&pagesize=50',
  nextUrl: 'https://www.carnival.com/api/v2/inventory?ratecodes=FBN&cursor=api-next-token',
  offerCode: 'FBN', nextPageNumber: 2, pageSize: 50,
});
assert(new URL(apiNextLinkUrl).pathname === '/cruise-search', 'API next links must not navigate the WebView away from the rendered cruise-search page');
assert(new URL(apiNextLinkUrl).searchParams.get('cursor') === 'api-next-token', 'API next-link cursor must be copied onto the browser search URL');

const broadCatalog = {
  sourceUrl: 'https://www.carnival.com/cruise-deals',
  personalizedSearchUrl: 'https://www.carnival.com/cruise-search?vifp=9000000000&tgo=FBN,20260701,20261231;O17,20260701,20261231',
  tgo: 'FBN,20260701,20261231;O17,20260701,20261231', vifp: '9000000000',
  tierCode: '01', tierName: 'Red', resident: 'AZ', locality: '1', currency: 'USD',
  rateCodes: [{ code: 'FBN', startDate: '', endDate: '', bookingLink: 'https://www.carnival.com/cruise-deals' }, { code: 'O17', startDate: '', endDate: '' }],
  actionCards: [], noOffersConfirmed: true,
};
const isolated = safeSync.ensureCarnivalCodeSpecificCatalog(broadCatalog);
assert(isolated.rateCodes.every((entry) => safeSync.isCarnivalBookingLinkForCode(entry.bookingLink, entry.code)), 'Every catalog code must receive a verified isolated search context');
assert(!isolated.noOffersConfirmed, 'Discovered rate codes must defeat a transient no-offers shell');

const clickedFbn = {
  ...broadCatalog,
  tgo: 'FBN,20260701,20261231',
  personalizedSearchUrl: 'https://www.carnival.com/cruise-search?ratecodes=FBN&tgo=FBN,20260701,20261231',
  rateCodes: [{ code: 'FBN', startDate: '', endDate: '', bookingLink: 'https://www.carnival.com/cruise-search?ratecodes=FBN&tgo=FBN,20260701,20261231', bookingLinkVerified: true, bookingLinkSource: 'clicked' }],
  noOffersConfirmed: false,
};
const merged = syncRuntime.mergeCarnivalCatalogs([broadCatalog, clickedFbn]);
assert(safeSync.parseCarnivalTgo(merged.tgo).length === 2, 'A one-code clicked TGO must not overwrite the richer authenticated catalog');
assert(safeSync.isCarnivalBookingLinkForCode(merged.rateCodes.find((entry) => entry.code === 'FBN').bookingLink, 'FBN'), 'Newest verified code-specific link must win');
assert(merged.rateCodes.some((entry) => entry.code === 'O17'), 'Transient clicked catalog must not erase other discovered offer codes');

const authSource = read('lib/royalCaribbean/authDetection.ts');
const safeSource = read('lib/carnival/carnivalSafeSync.ts');
const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
for (const marker of [
  'CARNIVAL_CAPTURE_RUNTIME_SCRIPT', 'requestMethod', 'requestBody', 'responseUrl',
  'inventoryValidated', 'carnivalSearchByContext', 'maxEnvelopeBytes', 'expectedUrl',
]) assert(authSource.includes(marker), `Network capture missing Priority 1 marker: ${marker}`);
for (const marker of [
  'Never walk broad hydration/__NEXT_DATA__ blobs', 'pageSignature', 'paginationMode',
  'authoritativeEmpty', 'pageContextMatched', 'inventoryPayloadCount', 'bookingLinkVerified',
]) assert(safeSource.includes(marker), `Safe scraper missing Priority 1-3 marker: ${marker}`);
for (const marker of [
  'v12.4.2-build314-carnival-priority1-3 active', 'maxPages = 50',
  'evaluateCarnivalPaginationStep', 'buildCarnivalNextPageUrl', 'signatureCounts',
  'releaseCarnivalSearchContext', 'verified DOM fallback', 'no verified code-specific Shop Now context',
]) assert(provider.includes(marker), `Provider missing Priority 1-3 marker: ${marker}`);
assert(!provider.includes('if (noGrowthPages >= 1)'), 'Legacy single no-growth-page stop must be removed');

console.log('PASS testV1242Build314CarnivalPriority1To3');
