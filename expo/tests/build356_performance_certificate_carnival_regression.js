const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
// This workspace can be iCloud-backed. Require two identical consecutive
// reads so a transient hydration/replacement window cannot report a source
// marker as missing when the file on disk is complete.
const read = (relative) => {
  const absolute = path.join(root, relative);
  let previous = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = fs.readFileSync(absolute, 'utf8');
    if (current === previous) return current;
    previous = current;
  }
  return previous ?? '';
};
const sha256 = (relative) => crypto.createHash('sha256').update(read(relative)).digest('hex');

const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);
assert.equal(pkg.version, '13.0.44');

// Build 339 root navigation/provider and tab architecture remains immutable.
assert.equal(sha256('app/_layout.tsx'), '8feada8a189883c07b6180c090b4f021d750f50e50c7c88c1ab750869a45775d');
assert.equal(sha256('app/(tabs)/_layout.tsx'), '8370c9a38f5c0a81c6ed420c2291f25fa804d1889a3fcc9a3d21f00e6ffbec6d');

const packageSource = read('package.json');
const agentProvider = read('state/AgentXProvider.tsx');
const pricing = read('lib/cruisePricingSync.ts');
const metro = read('metro.config.js');
assert.ok(!packageSource.includes('@rork-ai/toolkit-sdk'));
assert.ok(!agentProvider.includes("from '@rork-ai/toolkit-sdk'"));
assert.ok(!pricing.includes("from '@rork-ai/toolkit-sdk'"));
assert.ok(!metro.includes('@rork-ai/toolkit-sdk'));

const storageLoaders = read('state/coreData/storageLoaders.ts');
const coreProvider = read('state/CoreDataProvider.tsx');
assert.ok(storageLoaders.includes('subscribeToLateStorageReads'));
assert.ok(storageLoaders.includes('publishLateStorageRead'));
assert.ok(!storageLoaders.includes('JSON.stringify(parsedBookedData) !== JSON.stringify(nonMockCruises)'));
assert.ok(coreProvider.includes('lateStorageReloadTimerRef'));

const royalProvider = read('state/RoyalCaribbeanSyncProvider.tsx');
const royalStep = read('lib/royalCaribbean/step1_offers.ts');
const healing = read('lib/dataHealing.ts');
assert.ok(royalStep.includes('Math.min(DETAIL_WORKER_LIMIT, initialOffers.length)'));
assert.ok(royalProvider.includes('Promise.all(['));
assert.ok(royalProvider.includes('COMMIT_OFFERS skipped'));
assert.ok(royalProvider.includes('getSyncLogs'));
assert.ok(healing.includes('offersByCode'));
assert.ok(healing.includes('offersByCruiseId'));

const loyalty = read('state/LoyaltyProvider.tsx');
assert.ok(loyalty.includes('const rawCrownAnchorPoints = manualCrownAnchorPoints'));
assert.ok(loyalty.includes('crownAnchorPoints: 0'));
assert.ok(!loyalty.includes('CONFIRMED_CROWN_ANCHOR_POINTS'));

const settings = read('app/(tabs)/settings.tsx');
const sessionExport = read('lib/sessionLogExport.ts');
assert.ok(settings.includes('Export Current User Session Log (.json)'));
assert.ok(settings.includes('JSON.parse(content)'));
assert.ok(sessionExport.includes('easyseas-current-user-session-log'));
assert.ok(sessionExport.includes('bytesbase64'));
assert.ok(sessionExport.includes("'[REDACTED]'"));

const certificateStore = read('lib/certificates/certificateDocumentStore.ts');
const certificateBatch = read('lib/certificates/certificateBatchDownload.ts');
const certificateCodes = read('app/certificate-codes.tsx');
const certificateLookup = read('app/certificate-lookup.tsx');
const certificateLogger = read('lib/certificates/certificateDownloadLogger.ts');
assert.ok(certificateStore.includes('withCertificateStoreTransaction'));
assert.ok(certificateStore.includes('getDocumentSourceIdentity'));
assert.ok(certificateBatch.includes("updateCertificate(code, 'downloading'"));
assert.ok(certificateBatch.includes("updateCertificate(code, 'saving'"));
assert.ok(certificateBatch.includes("updateCertificate(code, 'saved'"));
assert.ok(certificateLogger.includes("'queued' | 'downloading' | 'parsing' | 'saving' | 'saved' | 'failed'"));
assert.ok(certificateCodes.includes("pathname: '/certificate-lookup'"));
assert.ok(certificateCodes.includes('documentStorageKey: getUserScopedKey'));
assert.ok(certificateCodes.includes("backgroundColor: '#10223A'"));
assert.ok(certificateCodes.includes("color: '#FFD86B'"));
assert.ok(certificateLookup.includes('buildLocalCertificateSailingIndex'));
assert.ok(certificateLookup.includes('startDateFilter'));
assert.ok(certificateLookup.includes('endDateFilter'));
assert.ok(certificateLookup.includes('These remain separate from Available Cruises'));

// Runtime check: retained certificate documents become a grouped local sailing
// inventory without collapsing materially different A/C certificate variants.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'easyseas-build356-cert-index-'));
for (const relative of ['certificatePdfParserCore.ts', 'certificateCatalog.ts', 'certificateSailingIndex.ts']) {
  const sourcePath = path.join(root, 'lib/certificates', relative);
  let output = ts.transpileModule(read(path.join('lib/certificates', relative)), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: sourcePath,
  }).outputText;
  output = output.replaceAll('@/lib/certificates/certificatePdfParserCore', './certificatePdfParserCore');
  fs.writeFileSync(path.join(temp, relative.replace(/\.ts$/, '.js')), output);
}
const { buildLocalCertificateSailingIndex } = require(path.join(temp, 'certificateSailingIndex.js'));
const parsedAt = '2026-08-01T00:00:00.000Z';
const row = (certificateCode, shipName, sailingDate, cabinCategory) => ({
  certificateCode, certificateFamily: certificateCode.charAt(4), certificateFamilyCode: certificateCode.charAt(4),
  sourcePage: 1, sourceGroup: 'fixture', sourceReferences: [], pageAttribution: 'explicit', shipName, sailingDate,
  cabinCategory, occupancy: '2 guests', freePlay: 100, onboardCredit: 50, pointRequirement: 1200, benefits: [],
  parserSource: 'device', parserVersion: 'fixture', parsedAt, validationStatus: 'accepted',
});
const indexed = buildLocalCertificateSailingIndex([
  { certificateCode: '2608C07', sourcePdfUrl: 'https://www.royalcaribbean.com/2608C07.pdf', parsedSailings: [row('2608C07', 'Icon of the Seas', '2026-09-01', 'Interior'), row('2608C07', 'Icon of the Seas', '2026-09-01', 'Balcony')] },
  { certificateCode: '2608A07', sourcePdfUrl: 'https://www.royalcaribbean.com/2608A07.pdf', parsedSailings: [row('2608A07', 'Icon of the Seas', '2026-09-01', 'Interior'), row('2608A07', 'Wonder of the Seas', '2026-10-02', 'Oceanview')] },
]);
assert.equal(indexed.length, 2);
assert.equal(indexed.find((match) => match.shipName === 'Icon of the Seas').levels.length, 3);

const authDetection = read('lib/royalCaribbean/authDetection.ts');
const carnivalExtraction = read('lib/carnival/carnivalOffersExtraction.ts');
const carnivalScreen = read('app/carnival-sync.tsx');
assert.ok(authDetection.includes('firstCarnivalOfferArray'));
assert.ok(authDetection.includes("'Items', 'items', 'offers', 'personalizedOffers', 'eligibleOffers'"));
assert.ok(authDetection.includes('captureCarnivalOfferPayload(data, this._url, \'XHR\')'));
assert.ok(carnivalExtraction.includes('item.RateCode || item.rateCode || item.offerCode'));
assert.ok(carnivalExtraction.includes('campaign.playerOfferId || campaign.offerId'));
assert.ok(carnivalScreen.includes('const completeLogs = getSyncLogs()'));

const weather = read('state/SailingWeatherProvider.tsx');
assert.ok(weather.includes("the sea day's proportional position along that route"));
assert.ok(weather.includes('previousCoordinates.latitude + ((nextCoordinates.latitude - previousCoordinates.latitude) * progress)'));

const carnivalRow = settings.indexOf('Sync Carnival Cruises');
const cloudRow = settings.indexOf('SYNC TO CLOUD');
const nextRow = settings.indexOf('Pricing Summary & History');
assert.ok(carnivalRow >= 0 && cloudRow > carnivalRow && nextRow > cloudRow);
assert.ok(settings.includes('Export Overall App Log'));
assert.ok(settings.includes('buildDiagnosticExport'));
assert.ok(!settings.includes('await coreData.syncToBackend()'));
const cloudProvider = read('state/UserDataSyncProvider.tsx');
assert.ok(cloudProvider.includes('automatic backend restore is disabled'));
assert.ok(!cloudProvider.includes('void initSync()'));

const forbiddenRootNames = fs.readdirSync(root).filter((name) =>
  name === '.DS_Store' || name.startsWith('._') || /(?:QA|TEST_LOG|RELEASE_NOTES|CHANGED_FILES|TODO|PROTOCOL|REPORT)/i.test(name)
);
assert.deepEqual(forbiddenRootNames, []);

console.log('PASS Build 356 performance, loyalty, certificate inventory, session-log, and Carnival capture regression');
