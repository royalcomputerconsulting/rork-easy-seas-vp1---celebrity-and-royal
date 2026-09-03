const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const syncIntegrity = read('lib/sync/syncRunIntegrity.ts');
assert(syncIntegrity.includes('verifyBookedCruiseSyncReadback'), 'booked cruise readback must have a booked-specific verifier');
assert(syncIntegrity.includes("['reservationNumber', 'reservationId', 'reservation', 'bookingId', 'bwoNumber'"), 'booked verifier must match reservation/booking identity');
assert(syncIntegrity.includes("'voyage-cabin'"), 'booked verifier must fall back to voyage/cabin identity when generated ids change');

const royalSync = read('state/RoyalCaribbeanSyncProvider.tsx');
assert(royalSync.includes('verifyBookedCruiseSyncReadback(expectedRows, storedRows)'), 'Royal/Celebrity sync must use booked-specific readback for booked cruises');

const importReview = read('lib/importReconciliationReview.ts');
assert(importReview.includes('maxRows?: number'), 'offers import review must accept a preview cap');
assert(importReview.includes('Preview limited for performance'), 'large offers imports must display a capped preview notice');
assert(importReview.includes('Apply uses the complete merged dataset'), 'preview cap must not reduce imported data applied');

const settings = read('app/(tabs)/settings.tsx');
assert(settings.includes('maxRows: 250'), 'Settings offers CSV import must cap review preview rows');
assert(settings.includes('displayedClubRoyalePoints'), 'Settings profile must prefer current loyalty provider points for primary profile display');
assert(settings.includes('displayedCrownAnchorPoints'), 'Settings profile must prefer current C&A provider points for primary profile display');
assert(settings.includes('Completed Cruises Casino History CSV/XLSX'), 'Settings must expose a completed cruises casino-history import button under import features');
assert(settings.includes("['club royale casino points', 'casino points', 'club royale points', 'points earned']"), 'completed cruises importer must map Club Royale casino points');
assert(settings.includes('casinoHistoryImportId'), 'completed cruises importer must mark owner-scoped historical casino facts');

const loyalty = read('state/LoyaltyProvider.tsx');
assert(loyalty.includes('Mirrored Club Royale points to active user profile'), 'manual/synced Club Royale point saves must mirror to active user profile');
assert(loyalty.includes('Mirrored Crown & Anchor points to active user profile'), 'manual/synced Crown & Anchor point saves must mirror to active user profile');

const overview = read('app/(tabs)/(overview)/index.tsx');
assert(overview.includes('isCertificateDocumentOfferLeak'), 'Offers page must guard against certificate-document rows leaking into active offers');
assert(overview.includes('looksLikeMonthlyCertificateCode'), 'Offers page certificate leak guard must identify monthly certificate codes');

const dataIdentity = read('lib/dataIdentity.ts');
assert(dataIdentity.includes('CASINO_PERFORMANCE_FIELDS'), 'booked-cruise merges must explicitly protect casino performance facts');
assert(dataIdentity.includes('preservesCasinoFact'), 'incoming zero/blank sync/import rows must not wipe saved per-cruise casino facts');
assert(dataIdentity.includes('preservesLocalCasinoFactFromProvider'), 'provider sync must not overwrite saved/manual per-cruise casino facts');
for (const field of ['pointsEarned', 'earnedPoints', 'casinoPoints', 'coinIn', 'winningsBroughtHome', 'winLoss']) {
  assert(dataIdentity.includes(`'${field}'`), `casino fact guard must include ${field}`);
}

const casinoCommandCenter = read('components/casino/CasinoCommandCenter.tsx');
assert(casinoCommandCenter.includes('casino-final-annual-host-summary'), 'Casino section must display the final annual casino-host summary from user data');
assert(casinoCommandCenter.includes('Final annual totals'), 'annual summary must include final annual totals');
assert(casinoCommandCenter.includes('Final annual averages'), 'annual summary must include final annual averages');
assert(casinoCommandCenter.includes('ROI-style summary'), 'annual summary must include ROI-style summary');
assert(casinoCommandCenter.includes('Future certificate inventory'), 'casino cruise rows must correlate earned certificates to parsed future option inventory');
assert(casinoCommandCenter.includes('Host ledger correlation'), 'casino cruise rows must show points/coin-in/theo/value correlation');
assert(casinoCommandCenter.includes('Easy Seas will not show another user’s static casino totals on an empty profile'), 'annual summary must not show owner-specific static data to empty profiles');

const casinoPointTruth = read('lib/casinoPointTruth.ts');
assert(casinoPointTruth.includes('CONFIRMED_CLUB_ROYALE_2026_POINTS = 23446'), 'current Club Royale 2026 confirmed points must match the latest user-stated total');
const casinoEconomics = read('lib/casinoCruiseEconomics.ts');
assert(casinoEconomics.includes('does not fabricate winnings for totals'), 'missing casino win/loss must remain missing instead of inflating totals');
assert(casinoEconomics.includes('does not fabricate points for totals'), 'missing Club Royale points must remain missing instead of inflating totals');
assert(!casinoEconomics.includes('knownNights * 300'), 'completed cruises must not receive fabricated 300-points-per-night totals');

const bundleOperations = read('lib/dataBundle/bundleOperations.ts');
const bundleFileIO = read('lib/dataBundle/bundleFileIO.ts');
assert(bundleOperations.includes('crewRecognition: {') && bundleOperations.includes('entries: crewEntries') && bundleOperations.includes('sailings: crewSailings'), 'Save All must include crew recognition entries and sailings');
assert(bundleOperations.includes('ALL_STORAGE_KEYS.CREW_RECOGNITION_ENTRIES') && bundleOperations.includes('ALL_STORAGE_KEYS.CREW_RECOGNITION_SAILINGS'), 'Load All must restore crew recognition entries and sailings to scoped storage');
for (const storageKey of [
  'CASINO_SESSIONS', 'CERTIFICATES', 'MACHINE_ENCYCLOPEDIA', 'MY_SLOT_ATLAS',
  'USER_SLOT_MACHINES', 'COMP_ITEMS', 'W2G_RECORDS',
]) {
  assert(
    bundleOperations.includes(`quotaSafeGetItem(sk(ALL_STORAGE_KEYS.${storageKey}))`),
    `Save All must dereference resilient/file-backed ${storageKey} storage before counting and exporting it`,
  );
}
assert(bundleOperations.includes('loadCrewRecognitionRows<RecognitionEntryWithCrew>'), 'Save All must dereference profile-scoped crew recognition entry storage before counting and exporting it');
assert(bundleOperations.includes('loadCrewRecognitionRows<Sailing>'), 'Save All must dereference profile-scoped crew sailing storage before counting and exporting it');
assert(bundleFileIO.includes('crewRecognitionEntries') && bundleFileIO.includes('crewSailings'), 'backup summary must report crew recognition counts');

console.log('build411 profile/import/readback regression passed');
