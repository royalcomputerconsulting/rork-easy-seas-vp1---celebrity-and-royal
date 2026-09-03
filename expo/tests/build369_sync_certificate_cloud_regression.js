const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const app = JSON.parse(read('app.json')).expo;
assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);

const parserCore = loadTs('lib/certificates/certificatePdfParserCore.ts');
const pipeline = loadTs('lib/certificates/certificatePdfPipeline.ts');
const filler = 'COLUMN-FILLER '.repeat(120);
const columnarText = [
  'Offer Code Ship Departure Port Sail Date Itinerary Stateroom Type Offer Type Next Cruise OBC',
  '2608C09 2608C09',
  'Jewel Of The Seas Adventure Of The Seas',
  filler,
  'Fort Lauderdale Miami',
  'August 10, 2026 August 17, 2026',
  'Bahamas Caribbean',
  'Balcony Interior',
  'Cruise Fare For 1 Guest Cruise Fare For 2 Guests',
  '$50 $75',
].join(' ');

const facts = parserCore.extractColumnarCertificateSailingFacts('2608C09', columnarText);
assert.equal(facts.length, 2);
assert.deepEqual(facts.map((row) => row.sailDate), ['2026-08-10', '2026-08-17']);
assert.deepEqual(facts.map((row) => row.shipName), ['Jewel Of The Seas', 'Adventure Of The Seas']);

const parsedColumnar = pipeline.parseCertificatePdfTextOnBackend(columnarText, {
  originalUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2608C09.pdf',
  retrievedAt: '2026-08-10T12:00:00.000Z',
}, '2608C09');
assert.equal(parsedColumnar.sailings.length, 2);
assert.deepEqual(parsedColumnar.sailings.map((row) => row.sailingDate), ['2026-08-10', '2026-08-17']);

// A normal material row remains authoritative; the column fallback must never
// replace its FreePlay/OBC evidence merely because it can infer more rows.
const benefitText = 'Next Cruise OBC 2607A02A Harmony Of The Seas Miami July 17, 2026 Caribbean Balcony Cruise Fare For 2 Guests $300 FreePlay $100';
const benefitResult = pipeline.parseCertificatePdfTextOnBackend(benefitText, {
  originalUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2607A02A.pdf',
  retrievedAt: '2026-08-10T12:00:00.000Z',
}, '2607A02A');
assert.equal(benefitResult.sailings.length, 1);
assert.equal(benefitResult.sailings[0].freePlay, 300);
assert.equal(benefitResult.sailings[0].onboardCredit, 100);

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.match(provider, /hardTimeout: boolean = false/);
assert.match(provider, /waiting for the verified local commit instead of aborting it/);
assert.match(provider, /result = await operationPromise/);

const syncLogic = read('lib/royalCaribbean/syncLogic.ts');
assert.match(syncLogic, /const remappedFinalOffers = finalOffers\.map/);
assert.match(syncLogic, /finalCruiseIds\.has\(id\)/);
assert.match(syncLogic, /return \{ offers: remappedFinalOffers, cruises: finalCruises/);

const lookup = read('app/certificate-lookup.tsx');
const card = read('components/CasinoCertificatesCard.tsx');
assert.match(lookup, /Array\.isArray\(nextResult\?\.summary\?\.failedCodes\)/);
assert.match(card, />View Certificates</);

const userDataSync = read('state/UserDataSyncProvider.tsx');
const trpc = read('lib/trpc.ts');
const settings = read('app/(tabs)/settings.tsx');
const eas = JSON.parse(read('eas.json'));
assert.match(userDataSync, /lastSyncAttemptRef\.current = 0;\s*retryCountRef\.current = 0;\s*return syncToCloud\(\)/);
assert.match(trpc, /if \(isCloudBackupRequest\) return 120_000/);
assert.match(settings, /resetBackendHealthCache\(\);\s*const reachable = await isBackendReachable\(\)/);
assert.match(settings, /const createCloudDriveBackup = async/);
assert.match(settings, /choose Save to Files and select iCloud Drive/);
assert.match(settings, /await createCloudDriveBackup\('The optional Easy Seas cloud service was offline/);
assert.equal(eas.build.production.env.EXPO_PUBLIC_EASYSEAS_CLOUD_BACKUP_ENABLED, 'true');

console.log('PASS Build 369: Royal reference remap, authoritative Carnival commit, certificate fallback, navigation, and manual cloud backup');
