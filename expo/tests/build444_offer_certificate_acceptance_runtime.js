const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const { filterOfferSailingRows } = loadTs('lib/offers/offerSailingFilters.ts');
const { getCruiseInventoryOptionKey } = loadTs('lib/cruiseInventory/cruiseCanonicalIdentity.ts');

const emptyFilters = () => ({
  ships: [],
  shipClasses: [],
  cabins: [],
  guestCounts: [],
  departurePorts: [],
  dateFrom: '',
  dateTo: '',
  minNights: '',
  maxNights: '',
  gty: 'all',
  nextCruiseBonus: 'all',
});

const offerCodes = Array.from({ length: 13 }, (_, index) => `2609A${String(index + 1).padStart(2, '0')}`);
const rows = Array.from({ length: 3151 }, (_, index) => {
  const offerIndex = index % offerCodes.length;
  const shipIndex = index % 7;
  const guestCount = index % 3 === 0 ? 1 : 2;
  const cabin = index % 4 === 0 ? 'Interior GTY' : index % 4 === 1 ? 'Oceanview' : index % 4 === 2 ? 'Balcony' : 'Junior Suite';
  const europe = index % 11 === 0;
  return {
    id: `acceptance-row-${index}`,
    sourceRecordId: `certificate-row-${index}`,
    sourceRowIndex: index,
    sourceProvider: 'royal',
    playerOfferId: `instance-${offerIndex}`,
    offerCode: offerCodes[offerIndex],
    offerName: `September certificate ${offerIndex + 1}`,
    offerExpiry: '2026-09-30',
    shipName: `Acceptance Ship ${shipIndex}`,
    shipClass: shipIndex < 2 ? 'Oasis' : shipIndex < 5 ? 'Quantum' : 'Voyager',
    sailDate: `2026-${String(9 + (index % 2)).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
    returnDate: `2026-${String(9 + (index % 2)).padStart(2, '0')}-${String((index % 27) + 2).padStart(2, '0')}`,
    nights: 3 + (index % 8),
    departurePort: europe ? 'Barcelona, Spain' : index % 2 ? 'Miami, Florida' : 'Port Canaveral, Florida',
    destination: europe ? 'Europe' : 'Caribbean',
    destinationRegion: europe ? 'Europe' : 'Caribbean',
    itineraryName: europe ? 'Western Mediterranean' : 'Bahamas & Perfect Day',
    cabinType: cabin,
    guests: guestCount,
    guestsInfo: `${guestCount} guest${guestCount === 1 ? '' : 's'}`,
    nextCruiseBonus: index % 5 === 0 ? '$100 FreePlay' : '',
    ports: europe ? ['Barcelona', 'Palma', 'Marseille'] : ['Miami', 'Nassau', 'Perfect Day at CocoCay'],
  };
});

const accessors = {
  ship: (row) => row.shipName,
  shipClass: (row) => row.shipClass,
  cabin: (row) => row.cabinType,
  guestCount: (row) => row.guests,
  departurePort: (row) => row.departurePort,
  sailDate: (row) => row.sailDate,
  nights: (row) => row.nights,
  hasNextCruiseBonus: (row) => Boolean(row.nextCruiseBonus),
  searchParts: (row) => [row.offerCode, row.offerName, row.shipName, row.shipClass, row.departurePort, row.destination, row.itineraryName, row.cabinType, row.guestsInfo, row.ports],
  dateToTime: (date) => new Date(`${date}T12:00:00Z`).getTime(),
};

assert.equal(filterOfferSailingRows(rows, '', emptyFilters(), accessors).length, 3151, 'Clear filters must return all 3,151 offer-sailing rows');
assert.equal(new Set(rows.map((row) => row.offerCode)).size, 13, 'The acceptance inventory must retain 13 offers');
assert.equal(new Set(rows.map(getCruiseInventoryOptionKey)).size, 3151, 'Canonical row identity must not collapse eligible offer-sailing options');

const europeRows = filterOfferSailingRows(rows, 'europe mediterranean', emptyFilters(), accessors);
assert.ok(europeRows.length > 0 && europeRows.every((row) => row.destinationRegion === 'Europe'), 'Free-text itinerary search must return the matching Europe sailings');

const oneGuest = emptyFilters();
oneGuest.guestCounts = [1];
assert.ok(filterOfferSailingRows(rows, '', oneGuest, accessors).every((row) => row.guests === 1), 'One-guest eligibility must filter row by row');

const suites = emptyFilters();
suites.cabins = ['Junior Suite'];
assert.ok(filterOfferSailingRows(rows, '', suites, accessors).every((row) => row.cabinType === 'Junior Suite'), 'Cabin eligibility must filter row by row');

const bonusGty = emptyFilters();
bonusGty.gty = 'yes';
bonusGty.nextCruiseBonus = 'yes';
assert.ok(filterOfferSailingRows(rows, '', bonusGty, accessors).every((row) => /gty/i.test(row.cabinType) && row.nextCruiseBonus), 'GTY and NextCruise filters must compose');

const duration = emptyFilters();
duration.minNights = '7';
duration.maxNights = '9';
assert.ok(filterOfferSailingRows(rows, '', duration, accessors).every((row) => row.nights >= 7 && row.nights <= 9), 'Night-range filters must be inclusive and lossless');

const detailsSource = fs.readFileSync(path.join(root, 'app/offer-details.tsx'), 'utf8');
const overviewSource = fs.readFileSync(path.join(root, 'app/(tabs)/(overview)/index.tsx'), 'utf8');
const commandCenterSource = fs.readFileSync(path.join(root, 'app/war-room.tsx'), 'utf8');

assert.match(detailsSource, /status: 'used',[\s\S]*updatedAt: new Date\(\)\.toISOString\(\)/, 'Mark as Used must preserve the record as durable history');
assert.doesNotMatch(detailsSource, /Deleting used offer|removeCasinoOffer\(offer\.id\)/, 'Mark as Used must never delete its source offer');
for (const testID of ['offer-details-close', 'offer-mark-in-progress', 'offer-mark-used', 'offer-open-filter-sheet', 'offer-filter-apply']) {
  assert.ok(detailsSource.includes(`testID="${testID}"`), `Offer details action is missing a stable interaction id: ${testID}`);
}
assert.match(overviewSource, /Promise\.all\(\[[\s\S]*refreshData\(\)[\s\S]*refreshCounts\(\)[\s\S]*refreshFacets\(\)/, 'Offers pull-to-refresh must reload durable data and indexed inventory metadata');
for (const action of ['command-center-view-', 'command-center-decode-', 'command-center-compare-', 'command-center-archive-restore-']) {
  assert.ok(commandCenterSource.includes(action), `Command Center action is not wired for acceptance: ${action}`);
}

console.log(`PASS Build 444 offer/certificate acceptance: ${offerCodes.length} offers and ${rows.length.toLocaleString()} row-distinct sailings remain searchable, filterable, persistent, and actionable`);
