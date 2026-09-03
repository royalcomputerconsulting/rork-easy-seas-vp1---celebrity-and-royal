const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs } = require('../scripts/clubRoyaleTestBootstrap');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const app = JSON.parse(read('app.json')).expo;
const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
const syncLogicSource = read('lib/royalCaribbean/syncLogic.ts');
const carnivalExtraction = read('lib/carnival/carnivalOffersExtraction.ts');
const carnivalScreen = read('app/carnival-sync.tsx');
const rootLayout = read('app/_layout.tsx');

assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);

// Royal application sync must not repeat a full-array scan for each provider
// row, and stale-row replacement must remain linear during apply.
assert.ok(syncLogicSource.includes('function filterRedundantOfferLevelRows'));
assert.ok(syncLogicSource.includes('const detailedIndex = new Map'));
assert.ok(!syncLogicSource.includes('isRedundantOfferLevelRow(row, allRows)'));
assert.ok(!syncLogicSource.includes('preview.offers.new.some(newOffer'));
assert.ok(!syncLogicSource.includes('preview.cruises.new.some(newCruise'));
assert.ok(!syncLogicSource.includes('preview.bookedCruises.new.some(newCruise'));

// Every storage checkpoint is bounded, cancellation closes the active local
// transaction, and the next awaited stage observes the stop request.
assert.ok(provider.includes('Promise.race([operationPromise, timeoutPromise])'));
assert.ok(provider.includes('SYNC_CHECKPOINT_TIMEOUT:'));
assert.ok(provider.includes('activeSyncTransactionRef'));
assert.ok(provider.includes('SYNC_CANCELLED_BY_USER'));
assert.ok(provider.includes('assertSyncNotCancelled(\'before_preview\')'));
assert.ok(provider.includes('assertSyncNotCancelled(\'after_dataset_writes\')'));
assert.ok(provider.includes("'FINALIZE_LOCAL_TRANSACTION'"));
assert.ok(provider.includes("'ABORT_LOCAL_TRANSACTION'"));

// Startup recovery is best-effort background work and cannot gate the splash
// screen or provider tree after an interrupted sync.
assert.ok(rootLayout.includes('void ensureStorageHealthy()'));
assert.ok(rootLayout.includes('void SplashScreen.hideAsync()'));
assert.ok(rootLayout.includes('void recoverIncompleteSyncTransaction().catch'));
assert.ok(!rootLayout.includes('Promise.all([ensureStorageHealthy(), recoverIncompleteSyncTransaction()])'));
assert.ok(rootLayout.indexOf('SplashScreen.hideAsync') < rootLayout.indexOf('recoverIncompleteSyncTransaction().catch'));

// Carnival authoritative API offers take precedence over nested DOM copies.
// Enrichment runs once per unique rate code and exits repeating empty fallbacks.
assert.ok(carnivalExtraction.includes('var seenDomOffers = {}'));
assert.ok(carnivalExtraction.includes('if (found.length > 120)'));
assert.ok(carnivalExtraction.includes('if (!hasAuthoritativeVifpOffers)'));
assert.ok(carnivalExtraction.includes("for (var pass = 0; pass < 2; pass++)"));
assert.ok(!carnivalExtraction.includes("document.querySelectorAll('[aria-expanded=\"false\"]')"));
assert.ok(provider.includes('interface CarnivalSearchPageWaiter'));
assert.ok(provider.includes('CARNIVAL_SEARCH_MAX_PAGES = 50'));
assert.ok(provider.includes('const offersToEnrich = allOffersToEnrich'));
assert.ok(!provider.includes('CARNIVAL_RATE_CODE_ENRICHMENT_LIMIT'), 'Build 371 must not truncate discovered rate codes');
assert.ok(!provider.includes('CARNIVAL_UNACKNOWLEDGED_ABORT_THRESHOLD'), 'Build 371 must not abort after three late pages');
assert.ok(provider.includes('offer.instances.flatMap'));

const leaveHandler = carnivalScreen.slice(
  carnivalScreen.indexOf('const handleLeaveScreen'),
  carnivalScreen.indexOf('const handleOpenImportTools'),
);
assert.ok(leaveHandler.includes('cancelSync();'));
assert.ok(!leaveHandler.includes('if (isRunning)'));

// Exercise the reported 2,500-row scale with distinct provider instances that
// intentionally share offer codes. Console output is suppressed because the
// transformer has developer diagnostics for every row.
const { createSyncPreview, applySyncPreview } = loadTs('lib/royalCaribbean/syncLogic.ts');
const rows = Array.from({ length: 2500 }, (_, index) => ({
  offerCode: `26TEST${index % 100}`,
  playerOfferId: `player-offer-${index}`,
  offerInstanceId: `player-offer-${index}`,
  offerName: `Distinct offer ${index}`,
  shipName: `Test Ship ${index % 20}`,
  sailingDate: `${String((index % 12) + 1).padStart(2, '0')}/${String((index % 27) + 1).padStart(2, '0')}/2027`,
  roomType: ['Interior', 'Oceanview', 'Balcony'][index % 3],
  guests: '2',
  offerExpirationDate: '12/31/2026',
  offerSource: 'royal',
}));

const originalLog = console.log;
const originalWarn = console.warn;
console.log = () => undefined;
console.warn = () => undefined;
let preview;
let previewMs;
let applied;
let applyMs;
try {
  const previewStarted = Date.now();
  preview = createSyncPreview(
    rows,
    [],
    null,
    [],
    [],
    [],
    { clubRoyalePoints: 0, clubRoyaleTier: '', crownAndAnchorPoints: 0, crownAndAnchorLevel: '' },
    'royal',
  );
  previewMs = Date.now() - previewStarted;
  const staleRows = preview.offers.new.map((offer, index) => ({ ...offer, id: `stale-${index}`, offerSource: 'royal' }));
  const applyStarted = Date.now();
  applied = applySyncPreview(preview, staleRows, [], [], 'royal');
  applyMs = Date.now() - applyStarted;
} finally {
  console.log = originalLog;
  console.warn = originalWarn;
}

assert.equal(preview.offers.new.length, 2500, 'same-code offers with unique provider IDs must all survive');
assert.equal(applied.offers.length, 2500);
assert.ok(previewMs < 2000, `2,500-row preview took ${previewMs}ms`);
assert.ok(applyMs < 1000, `2,500-row apply took ${applyMs}ms`);

console.log(`PASS Build 362: 2,500-row preview ${previewMs}ms, apply ${applyMs}ms; startup, cancellation, transaction, and Carnival loop guards verified`);
