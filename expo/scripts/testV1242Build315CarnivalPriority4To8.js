const fs = require('fs');
const path = require('path');
const os = require('os');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const readJson = (file) => JSON.parse(read(file));
function assert(condition, message) { if (!condition) throw new Error(message); }

const app = readJson('app.json');
assert(app.expo.version === '12.4.2', 'Marketing version must remain 12.4.2');
assert(app.expo.ios.buildNumber === '314', 'Original iOS buildNumber must remain 314');
assert(app.expo.android.versionCode === 120405, 'Original Android versionCode must remain 120405');

let ts;
try { ts = require('typescript'); }
catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); }

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'easyseas-carnival-priority4-8-'));
for (const relative of [
  'lib/carnival/carnivalDataRuntime.ts',
  'lib/carnival/carnivalSafeSync.ts',
  'lib/carnival/carnivalSyncRuntime.ts',
  'lib/carnival/carnivalInventoryRuntime.ts',
  'lib/carnival/carnivalApplyTransaction.ts',
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

const dataRuntime = require(path.join(tempRoot, 'lib/carnival/carnivalDataRuntime.js'));
const safeSync = require(path.join(tempRoot, 'lib/carnival/carnivalSafeSync.js'));
const syncRuntime = require(path.join(tempRoot, 'lib/carnival/carnivalSyncRuntime.js'));
const inventoryRuntime = require(path.join(tempRoot, 'lib/carnival/carnivalInventoryRuntime.js'));
const applyTransaction = require(path.join(tempRoot, 'lib/carnival/carnivalApplyTransaction.js'));

const profileInjection = safeSync.injectCarnivalProfileScrape('priority4-parse-test', 'run-315');
new Function(profileInjection);
assert(profileInjection.includes('run-315'), 'Profile bridge messages must be run-scoped');

assert(dataRuntime.carnivalStableHash('abc') === 'sha256-ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'Cryptographic SHA-256 request/context hashing must match the standard test vector');

const currentBridgeMessage = dataRuntime.evaluateCarnivalBridgeMessageScope({ messageRunId: 'run-315', messageRequestId: 'request-1', activeRunId: 'run-315', activeRequestId: 'request-1' });
assert(currentBridgeMessage.current, 'Matching WebView run/request IDs must be accepted');
assert(dataRuntime.evaluateCarnivalBridgeMessageScope({ messageRunId: 'old-run', messageRequestId: 'request-1', activeRunId: 'run-315', activeRequestId: 'request-1' }).reason === 'stale_run_message', 'Wrong-run WebView responses must fail immediately');
assert(dataRuntime.evaluateCarnivalBridgeMessageScope({ messageRunId: 'run-315', messageRequestId: 'old-request', activeRunId: 'run-315', activeRequestId: 'request-1' }).reason === 'stale_request_message', 'Wrong-request WebView responses must fail immediately');

const safeSyncSource = read('lib/carnival/carnivalSafeSync.ts');
assert(safeSyncSource.includes('authenticatedMyOffersPage && entries.length === 0 && visibleNoOffersState'), 'Catalog zero-offer authority must require authenticated My Offers page, zero codes, and a visible empty state');
assert(safeSyncSource.includes('visibleOfferSpecificEmptyState()'), 'Search zero-result authority must use a visible offer-specific empty-state element');
assert(!safeSyncSource.includes("var explicitEmptyText = /(?:0|no)\\s+"), 'Broad body-text zero-result matching must not be authoritative');
const authSource = read('lib/royalCaribbean/authDetection.ts');
assert(authSource.includes("contextFingerprint: String(context.contextFingerprint || '')"), 'Captured Carnival requests must retain the code-specific context fingerprint');
assert(safeSyncSource.includes("String(envelope.contextFingerprint || '') !== String(INPUT.contextFingerprint || '')"), 'Search parser must reject a payload from a different code-specific context fingerprint');

// Priority 1-3 fixtures: schema-specific inventory, pricing/facets isolation,
// authoritative zero, unknown redesign rejection, request/page proof, and all 329 rows.
const inventoryPageFixture = readJson('tests/fixtures/carnival/inventory-page.json');
const inventoryPageAnalysis = inventoryRuntime.analyzeCarnivalPayload(inventoryPageFixture, {
  requestUrl: 'https://www.carnival.com/graphql/inventory?ratecodes=FBN&pageNumber=1&pagesize=50',
  method: 'GET', expectedOfferCode: 'FBN', expectedPageNumber: 1,
});
assert(inventoryPageAnalysis.kind === 'inventory' && inventoryPageAnalysis.inventoryItems.length === 1, 'Inventory fixture must use a whitelisted sailing adapter');
assert(inventoryPageAnalysis.totalResults === 1 && inventoryPageAnalysis.offerCodeMatched && inventoryPageAnalysis.pageMatched, 'Inventory fixture must retain exact code/page proof');
const zeroFixtureAnalysis = inventoryRuntime.analyzeCarnivalPayload(readJson('tests/fixtures/carnival/zero-results.json'), {
  requestUrl: 'https://www.carnival.com/graphql/inventory?ratecodes=FBN&pageNumber=1&pagesize=50',
  method: 'GET', expectedOfferCode: 'FBN', expectedPageNumber: 1,
});
assert(zeroFixtureAnalysis.kind === 'inventory_empty' && zeroFixtureAnalysis.authoritativeEmpty, 'Matched zero-results fixture must be authoritatively empty');
const facetsFixtureAnalysis = inventoryRuntime.analyzeCarnivalPayload(readJson('tests/fixtures/carnival/facets-payload.json'), {
  requestUrl: 'https://www.carnival.com/graphql/facets?ratecodes=FBN&pageNumber=1', expectedOfferCode: 'FBN', expectedPageNumber: 1,
});
assert(facetsFixtureAnalysis.kind === 'facets' && !facetsFixtureAnalysis.authoritativeEmpty, 'Facet fixture must not overwrite or prove inventory totals');
const pricingFixtureAnalysis = inventoryRuntime.analyzeCarnivalPayload(readJson('tests/fixtures/carnival/pricing-payload.json'), {
  requestUrl: 'https://www.carnival.com/graphql/pricing?ratecodes=FBN&pageNumber=1', expectedOfferCode: 'FBN', expectedPageNumber: 1,
});
assert(pricingFixtureAnalysis.kind === 'pricing' && !pricingFixtureAnalysis.authoritativeEmpty, 'Pricing fixture must remain separate from inventory');
const unknownFixtureAnalysis = inventoryRuntime.analyzeCarnivalPayload(readJson('tests/fixtures/carnival/unknown-redesign.json'), {
  requestUrl: 'https://www.carnival.com/graphql/unknown?ratecodes=FBN&pageNumber=1', expectedOfferCode: 'FBN', expectedPageNumber: 1,
});
assert(!['inventory', 'inventory_empty'].includes(unknownFixtureAnalysis.kind) && unknownFixtureAnalysis.totalResults === null, 'Unknown redesign fixture must remain incomplete instead of trusting arbitrary totals');
const fixture329 = readJson('tests/fixtures/carnival/inventory-329.json');
const fixture329Keys = new Set();
for (let index = 0; index < fixture329.pages.length; index += 1) {
  const pageNumber = index + 1;
  const analysis = inventoryRuntime.analyzeCarnivalPayload(fixture329.pages[index], {
    requestUrl: `https://www.carnival.com/graphql/inventory?ratecodes=${fixture329.offerCode}&pageNumber=${pageNumber}&pagesize=50`,
    expectedOfferCode: fixture329.offerCode, expectedPageNumber: pageNumber,
  });
  assert(analysis.kind === 'inventory' && analysis.offerCodeMatched && analysis.pageMatched, `329 fixture page ${pageNumber} must be request-scoped inventory`);
  analysis.inventoryItems.forEach((item) => fixture329Keys.add(inventoryRuntime.createCarnivalSailingKey(item)));
}
assert(fixture329Keys.size === 329, '329 fixture must yield all 329 unique server sailings');
const legacyCheckpointFixture = readJson('tests/fixtures/carnival/checkpoint-v1.json');
assert(!syncRuntime.isCarnivalCheckpointFresh(legacyCheckpointFixture, Date.parse('2026-07-14T12:00:00.000Z')), 'Version-1 checkpoint fixture must be rejected and migrated by starting fresh');
const webViewFixture = readJson('tests/fixtures/carnival/webview-events.json');
assert(dataRuntime.evaluateCarnivalBridgeMessageScope({ messageRunId: webViewFixture.events[0].runId, messageRequestId: webViewFixture.events[0].requestId, activeRunId: 'run-current', activeRequestId: 'request-current' }).current, 'Current WebView fixture event must be accepted');
assert(!dataRuntime.evaluateCarnivalBridgeMessageScope({ messageRunId: webViewFixture.events[1].runId, messageRequestId: webViewFixture.events[1].requestId, activeRunId: 'run-current', activeRequestId: 'request-current' }).current, 'Old-run WebView fixture event must fail immediately');
assert(!dataRuntime.evaluateCarnivalBridgeMessageScope({ messageRunId: webViewFixture.events[2].runId, messageRequestId: webViewFixture.events[2].requestId, activeRunId: 'run-current', activeRequestId: 'request-current' }).current, 'Old-request WebView fixture event must fail immediately');
assert(dataRuntime.classifyCarnivalNavigationAuth(webViewFixture.events[3]) === 'auth_lost', 'Login redirect fixture must classify as authentication loss');
assert(dataRuntime.classifyCarnivalNavigationAuth(webViewFixture.events[4]) === 'authenticated_or_public', 'Normal Carnival navigation fixture must not be misclassified as auth loss');
const catalogFixture = readJson('tests/fixtures/carnival/catalog-page.json');
const cardsFixture = readJson('tests/fixtures/carnival/offer-cards.json');
const catalogWithCards = { ...catalogFixture, actionCards: cardsFixture.cards.map((card, index) => ({ index, title: card.title, perks: '', href: card.shopNowUrl })) };
const catalogIdentity = syncRuntime.buildCarnivalCheckpointIdentity({ catalog: catalogWithCards, appProfileId: 'profile-1', authenticatedEmail: 'owner@example.com' });
assert(syncRuntime.isCarnivalCheckpointIdentityUsable(catalogIdentity), 'Catalog fixture must produce a verified account-bound identity');
for (const card of cardsFixture.cards) assert(safeSync.isCarnivalBookingLinkForCode(card.shopNowUrl, card.code), `Offer-card fixture ${card.code} must have an exact code-specific URL`);

// Priority 4: deterministic IDs, robust dates, end-date classification and dedupe.
for (const [input, expected] of [
  ['2023-09-02', '09/02/2023'],
  ['09/02/2023', '09/02/2023'],
  ['Sep 2, 2023', '09/02/2023'],
  ['2 September 2023', '09/02/2023'],
]) assert(dataRuntime.formatCarnivalDate(input) === expected, `Carnival date parser failed for ${input}`);
assert(dataRuntime.parseCarnivalDate('February 31, 2023') === null, 'Invalid dates must be rejected');

const bookingFixture = readJson('tests/fixtures/carnival/bookings-history.json');
const normalizedIds = bookingFixture.rows.map((row) => dataRuntime.ensureCarnivalBookingIdentity(row).bookingId);
assert(normalizedIds[0] === normalizedIds[1], 'Equivalent synthetic/history bookings must resolve to one deterministic ID');
assert(/^carnival-synthetic-[a-f0-9]{16}$/.test(normalizedIds[0]), 'Generated booking ID must use the canonical carnival-synthetic prefix');
const merged = syncRuntime.mergeCarnivalBookingRows(bookingFixture.rows, new Date(bookingFixture.now));
assert(merged.length === 1, 'September 2023 Panorama API/DOM/history duplicate must merge exactly once');
assert(merged[0].status === 'Completed' && merged[0].sourcePage === 'Completed', 'Past Panorama sailing must classify only as completed');
assert(!merged[0].numberOfNights, 'VIFP points must never be copied into cruise nights');

const sameBookingA = dataRuntime.buildCarnivalSyntheticBookingId({ shipName: 'Carnival Jubilee', sailingStartDate: '10/1/2026', sailingEndDate: '10/8/2026', itinerary: 'Western Caribbean' });
const sameBookingB = dataRuntime.buildCarnivalSyntheticBookingId({ shipName: 'Carnival Jubilee', sailingStartDate: 'Oct 1, 2026', sailingEndDate: 'Oct 8, 2026', itinerary: 'Western Caribbean' });
assert(sameBookingA === sameBookingB, 'Synthetic IDs must be stable across supported date formats');

// Priority 4 loyalty: one decoder, Blue support, field-by-field profile merge, inferred label.
assert(dataRuntime.decodeCarnivalVifpTier('00').tier === 'Blue', 'Tier code 00 must decode to Blue');
assert(dataRuntime.decodeCarnivalVifpTier('Blue').tier === 'Blue', 'Blue name must decode consistently');
assert(safeSync.parseCarnivalPersonalizedUrl('https://www.carnival.com/cruise-search?tierCode=00&ratecodes=FBN&tgo=FBN,20260701,20261231').tierName === 'Blue', 'URL tier parsing must use the canonical Carnival decoder');
assert(dataRuntime.CARNIVAL_VIFP_TIER_BY_CODE['00'] === 'Blue', 'Canonical Carnival tier table must include Blue');
const inferred = dataRuntime.decodeCarnivalVifpTier('', 80);
assert(inferred.source === 'inferred' && /\(inferred\)/.test(inferred.displayTier), 'Locally inferred tiers must be visibly labeled inferred');
const profile = dataRuntime.mergeCarnivalProfileSnapshots(readJson('tests/fixtures/carnival/profile-snapshots.json'));
assert(profile.vifpNumber === '1234567890', 'Merged profile must retain VIFP number from one page');
assert(profile.totalCruises === 9 && profile.playersClubPoints === 4321, 'Merged profile must retain cruise and Players Club values from other pages');
assert(profile.vifpTierSource === 'authoritative', 'Authoritative VIFP tier must outrank inferred/unknown evidence');

// Priority 6: canonical unique sailing count and terminal manifest truth.
const sailingRows = [
  { offerCode: 'FBN', shipName: 'Carnival Celebration', sailingDate: '10/01/2026', itinerary: 'Eastern Caribbean', departurePort: 'Miami' },
  { offerCode: 'FBN', shipName: 'Carnival Celebration', sailingDate: '2026-10-01', itinerary: 'Eastern Caribbean', departurePort: 'Miami' },
  { offerCode: 'FBN', shipName: 'Carnival Celebration', sailingDate: '10/08/2026', itinerary: 'Western Caribbean', departurePort: 'Miami' },
];
assert(dataRuntime.countUniqueCarnivalSailings(sailingRows) === 2, 'Eligible Sailings must count canonical unique sailing records, not raw rows');
const ledgerFixture = readJson('tests/fixtures/carnival/manifest-ledger.json').codes.map((item) => ({ ...item, updatedAt: '2026-07-14T12:00:00.000Z' }));
const partialManifest = dataRuntime.buildCarnivalSyncManifest({
  runId: 'run-315', appProfileId: 'profile-1', authenticatedEmailHash: 'sha256-email', accountFingerprint: 'account', vifpFingerprint: 'vifp', catalogHash: 'catalog', catalogCount: 3,
  completedCodeCount: 2, successfulCodes: ['FBN'], authoritativeEmptyCodes: ['ZERO'], failedCodes: [], incompleteCodes: ['WAIT'],
  rowBearingCodes: ['FBN'], uniqueSailingCount: 2, rawSailingRowCount: 3, upcomingBookingCount: 1, completedHistoryCount: 1,
  codeLedger: ledgerFixture, terminalStatus: 'partial_resumable', createdAt: '2026-07-14T12:00:00.000Z',
});
assert(!dataRuntime.isCarnivalManifestComplete(partialManifest), 'Manifest with an incomplete code must never be labeled complete');
const completeManifest = dataRuntime.buildCarnivalSyncManifest({ ...partialManifest, terminalStatus: 'complete', completedCodeCount: 3, incompleteCodes: [], codeLedger: ledgerFixture.map((item) => item.code === 'WAIT' ? { ...item, status: 'authoritative_empty', totalResults: 0, truncated: false } : item) });
assert(dataRuntime.isCarnivalManifestComplete(completeManifest), 'Manifest may complete only when every catalog code is resolved');

// Mutation guards: each intentional integrity mutation must alter/reject the expected truth.
assert(dataRuntime.carnivalBookingCanonicalKey({ ...bookingFixture.rows[0], shipName: 'Carnival Horizon' }) !== dataRuntime.carnivalBookingCanonicalKey(bookingFixture.rows[0]), 'Mutation guard must detect changed ship identity');
assert(dataRuntime.countUniqueCarnivalSailings([...sailingRows, { ...sailingRows[0], sailingDate: '10/02/2026' }]) === 3, 'Mutation guard must detect a changed sailing date');
assert(!dataRuntime.isCarnivalManifestComplete({ ...completeManifest, failedCodes: ['BROKEN'] }), 'Mutation guard must reject a failed-code complete manifest');
const fixtureJournal = applyTransaction.createCarnivalApplyJournal({
  transactionId: 'fixture-tx', targetProfileId: 'profile-1', selectedSections: { offers: true, availableCruises: true, bookedCruises: true, completedCruises: true, loyalty: true },
  before: { offers: [{ id: 'old' }], cruises: [{ id: 'old-sailing' }], bookedCruises: [{ id: 'old-booking' }], profile: { id: 'profile-1', carnivalVifpTier: 'Red' } },
  after: { offers: [{ id: 'new' }], cruises: [{ id: 'new-sailing' }], bookedCruises: [{ id: 'new-booking' }], profileUpdates: { carnivalVifpTier: 'Gold' } },
});
assert(applyTransaction.validateCarnivalApplyJournal(fixtureJournal).valid, 'Checksummed transactional Apply Sync fixture must validate');
const mutatedJournal = JSON.parse(JSON.stringify(fixtureJournal));
mutatedJournal.after.cruises.push({ id: 'uncommitted' });
assert(!applyTransaction.validateCarnivalApplyJournal(mutatedJournal).valid, 'Mutation guard must detect a partially modified staged Apply Sync');

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
for (const marker of [
  'ownerId: providerInstanceIdRef.current',
  'activeCarnivalRun.settled = true',
  "type: 'carnival_auth_probe'",
  'verifyCarnivalAuthentication',
  'Rejected a stale Carnival search completion immediately',
  'Rejected a stale Carnival profile completion immediately',
  'CARNIVAL_SYNC_MANIFEST',
  "terminalStatus: incompleteCodes.length > 0 ? 'partial_resumable'",
  "status: committedCarnivalManifest?.terminalStatus === 'partial_resumable' ? 'partial' : 'complete'",
  'mergeCarnivalProfileSnapshots',
  'evaluateCarnivalBridgeMessageScope',
  'actionCardsNeedingResolution',
  'opening every unresolved card',
  'Rejected a stale Carnival catalog response immediately',
  'Rejected a stale Carnival authentication probe immediately',
  "type: 'carnival_navigation_auth_probe'",
]) assert(provider.includes(marker), `Provider missing Priority 4-6 behavioral marker: ${marker}`);
assert(!provider.includes('carnivalVifpPoints: msg.crownAndAnchorPoints'), 'Carnival VIFP data must not be sourced from Crown & Anchor fields');

const carnivalScreen = read('app/carnival-sync.tsx');
assert(carnivalScreen.includes('VERIFY CARNIVAL LOGIN'), 'Login confirmation must be a distinct verification action');
assert(carnivalScreen.includes('carnival-run-ingestion-button'), 'Start Sync must remain a distinct action');
assert(carnivalScreen.includes('Per-Code Result Ledger'), 'Review UI must expose per-code outcomes');
assert(carnivalScreen.includes("state.status === 'partial'"), 'Partial/resumable terminal state must be visible');
assert(!carnivalScreen.includes('__easySeasForceLoggedIn'), 'Manual logged-in bypass must be removed');
assert(!carnivalScreen.includes('state.loyaltyData?.crownAndAnchorLevel'), 'Carnival screen must not fall back to Crown & Anchor tier');
assert(!carnivalScreen.includes('state.loyaltyData?.clubRoyaleTier'), 'Carnival screen must not fall back to Club Royale tier');

const overview = read('app/(tabs)/(overview)/index.tsx');
assert(overview.includes('CARNIVAL_SYNC_MANIFEST'), 'Dashboard must load the persisted Carnival manifest');
assert(overview.includes("carnivalManifest.appProfileId === (currentUser?.id || '')"), 'Dashboard must reject a manifest from another app profile');
assert(overview.includes('carnivalManifest.uniqueSailingCount'), 'Dashboard Eligible Sailings must come from manifest unique count');
assert(overview.includes('carnivalSailingCanonicalKey'), 'Dashboard fallback must still deduplicate canonical sailings');

const extension = read('assets/easy-seas-extension/carnival-sync.js');
const extensionContent = read('assets/easy-seas-extension/content.js');
assert(extension.includes("version: '12.4.2-deprecated'") && extension.includes('disabled: true'), 'Divergent Carnival extension must be formally disabled');
assert(extensionContent.includes('Carnival desktop sync disabled'), 'Extension content flow must stop Carnival execution');
assert(!extension.includes('DEFAULT_PAGE_SIZE = 8'), 'Deprecated extension must not retain the divergent page-size engine');

const packageJson = readJson('package.json');
assert(packageJson.dependencies['lucide-react-native'] === '^0.475.0', 'Original Build 314 dependency graph must remain untouched');
assert(packageJson.packageManager === 'bun@1.3.13', 'Original Build 314 Bun package-manager declaration must remain untouched');
assert(packageJson.overrides?.['expo-location'] === '~19.0.8', 'Original Build 314 Expo override must remain untouched');
assert(fs.existsSync(path.join(root, 'node-version')), 'Original Build 314 node-version file must remain present');
assert(read('node-version').trim() === '20', 'Original Build 314 Node version marker must remain unchanged');
assert(!fs.existsSync(path.join(root, 'package-lock.json')), 'No npm lockfile may be introduced into the original Build 314 base');
assert(!fs.existsSync(path.join(root, 'bun.lock')), 'No new Bun lockfile may be introduced into the original Build 314 base');
assert(!fs.existsSync(path.join(root, '.github', 'workflows')), 'No CI/workflow files may be introduced into the original Build 314 base');

console.log('PASS testV1242Build315CarnivalPriority4To8');
