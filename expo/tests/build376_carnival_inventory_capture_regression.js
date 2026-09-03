const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);
assert.equal(pkg.version, '13.0.44');

const auth = read('lib/royalCaribbean/authDetection.ts');
const safeSync = read('lib/carnival/carnivalSafeSync.ts');
const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
const runtime = read('lib/carnival/carnivalInventoryRuntime.ts');

// The previously orphaned inventory analyzer must execute inside the WebView
// interceptor for both Fetch and XHR responses.
assert.match(auth, /CARNIVAL_CAPTURE_RUNTIME_SCRIPT/);
assert.match(auth, /\$\{CARNIVAL_CAPTURE_RUNTIME_SCRIPT\}/);
assert.match(auth, /function captureCarnivalSearchInventory/);
assert.match(auth, /captureCarnivalSearchInventory\(data, url, response\.url/);
assert.match(auth, /captureCarnivalSearchInventory\([\s\S]{0,500}this\.responseURL/);
assert.match(auth, /carnivalSearchCandidates/);
assert.match(auth, /analysis\.approvedEndpoint/);
assert.match(auth, /analysis\.offerCodeMatched/);
assert.match(auth, /analysis\.pageMatched/);
assert.match(auth, /Verified Carnival inventory for/);

// A request may finish before the native scraper creates its waiter. The
// candidate fallback is still accepted only with exact, recent inventory,
// offer, endpoint, and page proof.
assert.match(safeSync, /Date\.now\(\) - 90000/);
assert.match(safeSync, /analysis\.kind !== 'inventory'/);
assert.match(safeSync, /!analysis\.approvedEndpoint \|\| !analysis\.offerCodeMatched \|\| !analysis\.pageMatched/);
assert.match(safeSync, /analysis\.offerProofSource === 'none'/);
assert.match(safeSync, /analysis\.pageProofSource === 'none'/);
assert.match(safeSync, /inventoryValidated: true/);

// Marketing CTA URLs retain official companion codes while emitting exactly
// one canonical rateCodes key and authenticated personalization.
assert.match(provider, /url\.searchParams\.set\('rateCodes', sourceRateCodes\.includes\(code\)/);
assert.doesNotMatch(provider, /url\.searchParams\.set\('ratecodes', code\)/);
assert.match(provider, /url\.searchParams\.set\('tgo', tgoParam\)/);
assert.match(provider, /url\.searchParams\.set\('vifp', tgoData\.vifp\)/);
assert.match(provider, /buildCarnivalSearchUrl\(offer\.offerCode, offer\.bookingLink\)/);
assert.match(provider, /verified Carnival API/);
assert.match(provider, /partial\/resumable/);

// Completeness remains authoritative and bounded.
assert.match(runtime, /CARNIVAL_CAPTURE_RUNTIME_SCRIPT/);
assert.match(runtime, /kind === 'inventory_empty'/);
assert.match(provider, /pageResult\.requestProof/);
assert.match(provider, /pageResult\.pageProof/);
assert.match(provider, /CARNIVAL_SEARCH_MAX_PAGES/);

console.log('PASS Build 383 Carnival inventory capture: canonical personalized URLs and exact Fetch/XHR offer-page proof');
