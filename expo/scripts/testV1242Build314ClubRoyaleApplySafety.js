const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = process.cwd();
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
const loyaltyProvider = read('state/LoyaltyProvider.tsx');
const core = read('state/CoreDataProvider.tsx');
const overlap = read('lib/cruiseOverlapGuards.ts');
const identity = read('lib/dataIdentity.ts');
const settings = read('app/(tabs)/settings.tsx');

for (const marker of [
  'mergeCapturedLoyalty',
  'Loyalty field authority',
  'hasAuthoritativeCrownAndAnchorData',
  'Crown & Anchor lane remained incomplete; only individually authoritative C&A fields were updated and all others were preserved',
  'Loyalty/profile readback mismatch',
  'rollbackRoyalCelebrityApply',
  'Royal/Celebrity rollback restored offers, sailings, bookings/history, loyalty storage, and selected profile state',
  'throw loyaltyError',
  'throw extLoyaltyError',
]) assert(provider.includes(marker), `Royal provider missing safety marker: ${marker}`);
assert(!provider.includes('Ignoring DOM loyalty data - API data already received'), 'Partial API data must not suppress DOM fallback.');
assert(!provider.includes('mergeRoyalCompletedHistoryTruth'), 'Live Royal sync must not inject the hard-coded completed-history fallback.');
assert(!provider.includes('ROYAL_COMPLETED_HISTORY_TRUTH_COUNT'), 'Live Royal sync counts must come from authenticated extraction, not a forced historical minimum.');
assert(provider.includes('Royal completed-history reconciliation:'), 'Live Royal completed-history extraction must be reconciled explicitly before persistence.');
assert(provider.includes('const syncedClubRoyalePoints = effectiveExtendedLoyalty?.clubRoyalePointsFromApi;'), 'Profile Club Royale points must come only from captured extended data.');
assert(provider.includes('const syncedCrownAnchorPoints = effectiveExtendedLoyalty?.crownAndAnchorPointsFromApi;'), 'Profile C&A points must come only from captured C&A data.');

for (const marker of [
  'Extended loyalty data readback mismatch',
  'Club Royale points readback mismatch',
  'Crown & Anchor points readback mismatch',
  'Loyalty transaction rollback completed',
]) assert(loyaltyProvider.includes(marker), `LoyaltyProvider missing transactional marker: ${marker}`);

for (const marker of [
  'Booked cruise reconciliation audit',
  'Booked cruise normalization ledger mismatch',
  'Booked cruise storage readback mismatch',
  'Booked cruise transaction failed; restoring prior storage',
  'applyUserConfirmedBookedCruiseManifestWithLedger',
]) assert(core.includes(marker), `CoreDataProvider missing count/readback guard: ${marker}`);

assert(overlap.includes('The manifest is never used as a replacement list'), 'Manifest must be documented and implemented as an overlay.');
assert(overlap.includes('Ambiguous ship/date fallback matched multiple live bookings'), 'Manifest must reject ambiguous fallback matches.');
assert(overlap.includes('the live source remains authoritative for record identity and lifecycle'), 'Manifest must preserve live lifecycle and identity.');
assert(identity.includes('Cabin and guest signatures prevent one couple/room from collapsing'), 'Reservation-free booking identity must include cabin and guests.');
assert(identity.includes('dedupeBookedCruisesWithLedger'), 'Booked-cruise dedupe must expose a complete input-to-output ledger.');
assert(core.includes('identity upgrades are allowed') || core.includes('Identity upgrades are allowed'), 'CoreData must permit safe partial-to-reservation identity upgrades.');
assert(settings.includes('isPrimaryProfileSelected ? loyaltyClubRoyalePoints'), 'Primary Settings Club Royale values must render from verified LoyaltyProvider state.');
assert(settings.includes('isPrimaryProfileSelected ? loyaltyCrownAnchorPoints'), 'Primary Settings C&A values must render from verified LoyaltyProvider state.');
assert(settings.includes('profileDisplayUser?.clubRoyalePoints'), 'Secondary Settings Club Royale values must remain profile-scoped.');
assert(settings.includes('canonical offer-sailing rows'), 'Settings must label its canonical sailing count accurately.');

const expected = Object.fromEntries(read('CLUB_ROYALE_PROTECTED_HASHES_BEFORE.sha256').trim().split(/\n/).map(line => {
  const [hash, file] = line.trim().split(/\s+/); return [file, hash];
}));
for (const [file, hash] of Object.entries(expected)) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  assert(actual === hash, `Protected file changed: ${file}`);
}

console.log('PASS testV1242Build314ClubRoyaleApplySafety');
