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

const royal = read('lib/royalCaribbean/step1_offers.ts');
const carnival = read('state/RoyalCaribbeanSyncProvider.tsx');
const carnivalScraper = read('lib/carnival/carnivalSafeSync.ts');
const transaction = read('lib/storage/syncTransaction.ts');
const core = read('state/CoreDataProvider.tsx');

// Royal retains instance-safe detail URLs, bounded parallelism, retry/backoff,
// and final website/parsed/exported reconciliation diagnostics.
assert.match(royal, /detailsParams\.append\('playerOfferId', playerOfferId\)/);
assert.match(royal, /const DETAIL_WORKER_LIMIT = 4/);
assert.match(royal, /Math\.min\(DETAIL_WORKER_LIMIT, initialOffers\.length\)/);
assert.match(royal, /const detailRequestCache = new Map\(\)/);
assert.match(royal, /status === 429 \|\| status >= 500/);
assert.match(royal, /for \(let attempt = 0; attempt < 3; attempt \+= 1\)/);
assert.match(royal, /const pricingWorkerCount = Math\.min\(3, groups\.length\)/);
assert.match(royal, /setTimeout\(\(\) => controller\.abort\(\), 18000\)/);
assert.match(royal, /Offer reconciliation — website:/);
assert.match(royal, /parsed instances:/);
assert.match(royal, /exported instances:/);

// Carnival uses a fast handoff only for results pages because the injected
// scraper still polls readiness and requires two stable, matching snapshots.
assert.match(carnival, /navigateToPage\(activePageUrl, 25_000, 500\)/);
assert.match(carnival, /primeCarnivalSearchCaptureContext/);
assert.match(carnival, /navigateToPage\(activePageUrl, 30_000, 750\)/);
assert.match(carnival, /waitForCapturedSection\(page\.section/);
assert.match(carnival, /CARNIVAL_SEARCH_MAX_PAGES/);
assert.match(carnival, /pageResult\.requestProof/);
assert.match(carnival, /pageResult\.pageProof/);
assert.match(carnival, /partial\/resumable/);
assert.match(carnivalScraper, /while \(Date\.now\(\) - started < 8000\)/);
assert.match(carnivalScraper, /firstDomSignature === secondDomSignature/);
assert.match(carnivalScraper, /pageContextMatched && secondContextMatched/);

// Large datasets still write and read back in parallel, while duplicate sync
// metadata and three serial manifest writes are consolidated.
assert.match(core, /finalizeLocalSyncMetadata/);
assert.match(core, /updateLastSync: false/);
assert.match(core, /markImportedData\?: boolean/);
assert.match(transaction, /export async function recordSyncDatasets/);
assert.match(transaction, /manifest:datasets/);
assert.match(carnival, /RECORD_DATASETS_TRANSACTION/);
assert.doesNotMatch(carnival, /RECORD_OFFERS_TRANSACTION/);
assert.match(carnival, /READBACK_OFFERS/);
assert.match(carnival, /READBACK_AVAILABLE_CRUISES/);
assert.match(carnival, /READBACK_BOOKINGS_AND_HISTORY/);

console.log('PASS Build 383 sync throughput: bounded Royal pools, proof-safe Carnival waits, and consolidated local commits');
