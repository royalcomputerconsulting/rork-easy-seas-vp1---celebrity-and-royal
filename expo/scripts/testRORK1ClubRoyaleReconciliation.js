const fs = require('fs');
const path = require('path');
const { root, loadTs } = require('./clubRoyaleTestBootstrap');
const {
  getCanonicalOfferSailingKey,
  getMaterialOfferRowKey,
  partitionAuthoritativeCompletedRows,
  summarizeOfferExtraction,
} = loadTs('lib/royalCaribbean/reconciliation.ts');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const base = {
  sourcePage: 'Offers',
  offerCode: '2607C06',
  offerName: 'July Instant Cruise Reward',
  shipName: 'Icon of the Seas',
  sailingDate: '2026-09-12',
  itinerary: '7 Night Eastern Caribbean Cruise',
  departurePort: 'Miami',
  cabinType: 'Balcony',
  numberOfGuests: '2 Guests',
  interiorPrice: '$100',
  oceanviewPrice: '$200',
  balconyPrice: '$300',
  suitePrice: '$800',
  taxesAndFees: '$150',
  perks: '$250 FreePlay',
  bookingLink: 'https://example.test/a',
};
const exact = { ...base };
const priceVariant = { ...base, balconyPrice: '$350' };
const cabinVariant = { ...base, cabinType: 'Oceanview', bookingLink: 'https://example.test/b' };
const crossOfferVariant = { ...base, offerCode: '26MIX403' };

assert(getMaterialOfferRowKey(base) === getMaterialOfferRowKey(exact), 'Exact repeated rows must share a material identity.');
assert(getMaterialOfferRowKey(base) !== getMaterialOfferRowKey(priceVariant), 'Price variants must remain distinct.');
assert(getMaterialOfferRowKey(base) !== getMaterialOfferRowKey(cabinVariant), 'Cabin/link variants must remain distinct.');
assert(getMaterialOfferRowKey(base) !== getMaterialOfferRowKey(crossOfferVariant), 'Cross-offer variants must remain distinct.');
assert(getCanonicalOfferSailingKey(base) === getCanonicalOfferSailingKey(priceVariant), 'Canonical sailing identity must intentionally ignore offer price variants.');

const reconciliation = summarizeOfferExtraction(
  [base, exact, priceVariant, cabinVariant, crossOfferVariant],
  [base, priceVariant, cabinVariant, crossOfferVariant],
  5,
);
assert(reconciliation.rawOfferRows === 5, 'Raw extractor count must be preserved.');
assert(reconciliation.retainedOfferRows === 4, 'One exact duplicate must consolidate while material variants remain.');
assert(reconciliation.canonicalOfferSailings === 1, 'All material rows represent one canonical ship/date/itinerary sailing.');
assert(reconciliation.retainedVariantRows === 3, 'Three legitimate material variants must be reported separately.');
assert(reconciliation.duplicateRowsConsolidated === 1, 'Exact duplicate consolidation must be visible.');

const history = partitionAuthoritativeCompletedRows([
  { sourcePage: 'Past Cruises', status: 'Completed', shipName: 'Harmony of the Seas', sailingStartDate: '2026-03-01', bookingId: 'OK-1' },
  { sourcePage: 'Past Cruises', status: 'Completed', shipName: 'Radiance of the Seas', sailingStartDate: '', bookingId: 'NO-DATE' },
  { sourcePage: 'Past Cruises', status: 'Completed', shipName: '', sailingStartDate: '2026-04-01', bookingId: 'NO-SHIP' },
  { sourcePage: 'Upcoming', status: 'Upcoming', shipName: '', sailingStartDate: '', bookingId: 'UPCOMING-THIN' },
]);
assert(history.accepted.length === 2, 'Authoritative completed and non-completed rows should be retained.');
assert(history.quarantined.length === 2, 'Incomplete completed rows must be quarantined.');
assert(history.quarantined.some((entry) => entry.reason === 'missing_sailing_date'), 'Missing completed sailing date must be explained.');
assert(history.quarantined.some((entry) => entry.reason === 'missing_ship'), 'Missing completed ship must be explained.');

const provider = fs.readFileSync(path.join(root, 'state/RoyalCaribbeanSyncProvider.tsx'), 'utf8');
const syncScreen = fs.readFileSync(path.join(root, 'app/royal-caribbean-sync.tsx'), 'utf8');
const step1 = fs.readFileSync(path.join(root, 'lib/royalCaribbean/step1_offers.ts'), 'utf8');
const syncLogic = fs.readFileSync(path.join(root, 'lib/royalCaribbean/syncLogic.ts'), 'utf8');
const trpc = fs.readFileSync(path.join(root, 'lib/trpc.ts'), 'utf8');

for (const marker of [
  'summarizeOfferExtraction',
  'partitionAuthoritativeCompletedRows',
  'quarantinedCompletedCruisesRef',
  'Offer reconciliation: raw=',
  'Apply reconciliation:',
  'readbackVerified: false',
]) assert(provider.includes(marker), `Provider missing RORK-1 marker: ${marker}`);

for (const marker of [
  'rawOfferRows',
  'retainedVariantRows',
  'duplicateRowsConsolidated',
  'incomplete row(s) quarantined',
]) assert(syncScreen.includes(marker), `Sync review UI missing transparent reconciliation marker: ${marker}`);

for (const marker of [
  'row.interiorPrice || row.priceInterior',
  'row.oceanviewPrice || row.priceOceanview',
  'row.balconyPrice || row.priceBalcony',
  'row.suitePrice || row.priceSuite',
  'row.detailUrl || row.bookingLink',
]) assert(step1.includes(marker), `Web extractor identity missing material variant field: ${marker}`);

assert(syncLogic.includes('material offer variants must'), 'Final available-cruise identity must preserve material variants.');
assert(syncLogic.includes('cruise.bookingLink'), 'Final available-cruise identity must include booking link.');
assert(trpc.includes('EXPO_PUBLIC_RORK_API_BASE_URL'), 'RORK backend authority must remain intact.');
assert(!trpc.includes("'https://easy-seas-backend-v2.onrender.com'") && !trpc.includes('EXPO_PUBLIC_RENDER_BACKEND_URL'), 'Dead Render backend must not be restored as an executable fallback.');

console.log('PASS testRORK1ClubRoyaleReconciliation');
