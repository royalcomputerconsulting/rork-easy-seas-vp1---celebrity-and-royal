const fs = require('fs');
const path = require('path');
const { root, loadTs } = require('./clubRoyaleTestBootstrap');
const { dedupeBookedCruises, dedupeBookedCruisesWithLedger, getBookedCruiseIdentityKey } = loadTs('lib/dataIdentity.ts');
const { applyUserConfirmedBookedCruiseManifestWithLedger } = loadTs('lib/cruiseOverlapGuards.ts');
const { createSyncPreview, calculateSyncCounts, applySyncPreview } = loadTs('lib/royalCaribbean/syncLogic.ts');

function assert(condition, message) { if (!condition) throw new Error(message); }
const storageLoaders = fs.readFileSync(path.join(root, 'state/coreData/storageLoaders.ts'), 'utf8');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'scripts/fixtures/clubRoyale/cruise-12-upcoming-60-completed.json'), 'utf8'));
const authoritative = [...fixture.upcoming, ...fixture.completed];
assert(authoritative.length === 72, 'Fixture must contain 72 authoritative cruise rows.');

const overlay = applyUserConfirmedBookedCruiseManifestWithLedger(authoritative);
assert(overlay.activated, 'Fixture must activate the bounded manifest overlay.');
const outputKeys = new Set(overlay.cruises.map(row => row.reservationNumber || row.id));
for (const row of authoritative) {
  assert(outputKeys.has(row.reservationNumber || row.id), `Manifest overlay lost authoritative row ${row.reservationNumber || row.id}.`);
}
assert(overlay.cruises.length >= authoritative.length, 'Manifest overlay must never reduce authoritative rows.');
const activatedCompleted = overlay.cruises.find(row => row.reservationNumber === 'TEST-DONE-001');
assert(activatedCompleted?.completionState === 'completed', 'Manifest overlay must preserve authoritative completed lifecycle.');
assert(activatedCompleted?.status === 'completed', 'Manifest overlay must preserve authoritative completed status.');

const exactDuplicate = { ...authoritative[5], id: 'duplicate-copy', notes: 'supplemental detail' };
const deduped = dedupeBookedCruises([...authoritative, exactDuplicate], 'Club Royale cruise completeness fixture');
assert(deduped.length === 72, 'Only the one exact duplicate should merge.');
assert(deduped.filter(row => row.sailDate === '2026-09-01' && row.shipName === 'Odyssey of the Seas').length === 2, 'Same-date distinct reservations must remain separate.');
assert(deduped.filter(row => row.sailDate === '2026-10-01' && row.shipName === 'Wonder of the Seas').length === 2, 'Reservation-free same-date rows with different cabin/guests must remain separate.');
assert(new Set(deduped.map(getBookedCruiseIdentityKey)).size === deduped.length, 'Canonical booked identities must be unique after dedupe.');
assert(deduped.some(row => row.reservationNumber === 'TEST-DONE-011'), 'Completed row with partial detail must remain present.');

// A partial row may legitimately gain a reservation number from a stronger duplicate. That
// identity upgrade must be recorded, not treated as data loss by CoreData persistence checks.
const partialWithoutReservation = {
  id: 'partial-upgrade-row', shipName: 'Utopia of the Seas', sailDate: '2026-12-01', returnDate: '2026-12-05',
  cabinNumber: '8210', guestNames: ['Test Guest'], status: 'upcoming', completionState: 'upcoming', cruiseSource: 'royal',
};
const completeWithReservation = {
  ...partialWithoutReservation, id: 'complete-upgrade-row', reservationNumber: 'UPGRADE-001', notes: 'authoritative booking payload',
};
const upgraded = dedupeBookedCruisesWithLedger([partialWithoutReservation, completeWithReservation], 'identity-upgrade fixture');
assert(upgraded.cruises.length === 1, 'Matching partial and authoritative booking rows should merge once.');
assert(upgraded.cruises[0].reservationNumber === 'UPGRADE-001', 'The canonical row must retain the authoritative reservation number.');
assert(upgraded.ledger.length === 2, 'Every identity-upgrade input must have a ledger entry.');
assert(upgraded.ledger.every(entry => entry.outputIdentity.includes('upgrade-001')), 'Every input must resolve to the upgraded final reservation identity.');

const distinctReservations = dedupeBookedCruisesWithLedger([
  { ...completeWithReservation, id: 'reservation-a', reservationNumber: 'RES-A' },
  { ...completeWithReservation, id: 'reservation-b', reservationNumber: 'RES-B' },
], 'distinct reservation fixture');
assert(distinctReservations.cruises.length === 2, 'Different reservation numbers must never collapse even with the same ship/date/cabin/guest.');
assert(new Set(distinctReservations.ledger.map(entry => entry.outputIndex)).size === 2, 'Distinct reservations must map to distinct canonical outputs.');

const noDiscriminatorRows = dedupeBookedCruises([
  { id: 'no-disc-a', shipName: 'Icon of the Seas', sailDate: '2027-01-01', returnDate: '2027-01-08', status: 'upcoming', completionState: 'upcoming', cruiseSource: 'royal' },
  { id: 'no-disc-b', shipName: 'Icon of the Seas', sailDate: '2027-01-01', returnDate: '2027-01-08', status: 'upcoming', completionState: 'upcoming', cruiseSource: 'royal' },
], 'no discriminator fixture');
assert(noDiscriminatorRows.length === 2, 'Ship/date alone must never merge reservation-free bookings.');

const sameSailingRawRows = [
  { sourcePage: 'Upcoming Cruises', shipName: 'Wonder of the Seas', sailingStartDate: '2027-02-01', sailingEndDate: '2027-02-08', sailingDates: '2027-02-01 - 2027-02-08', itinerary: 'Caribbean', departurePort: 'Miami', cabinType: 'Balcony', cabinNumberOrGTY: '8210', bookingId: 'unconfirmed:first', numberOfGuests: '1', status: 'Upcoming', loyaltyLevel: '', loyaltyPoints: '', passengers: [{ firstName: 'Alpha', lastName: 'Guest' }] },
  { sourcePage: 'Upcoming Cruises', shipName: 'Wonder of the Seas', sailingStartDate: '2027-02-01', sailingEndDate: '2027-02-08', sailingDates: '2027-02-01 - 2027-02-08', itinerary: 'Caribbean', departurePort: 'Miami', cabinType: 'Balcony', cabinNumberOrGTY: '9220', bookingId: 'unconfirmed:second', numberOfGuests: '1', status: 'Upcoming', loyaltyLevel: '', loyaltyPoints: '', passengers: [{ firstName: 'Beta', lastName: 'Guest' }] },
];
const sameSailingPreview = createSyncPreview(
  [], sameSailingRawRows, null, [], [], [],
  { clubRoyalePoints: 0, clubRoyaleTier: '', crownAndAnchorPoints: 0, crownAndAnchorLevel: '' },
  'royal', { includeUnownedRecords: true },
);
assert(sameSailingPreview.bookedCruises.new.length === 2, 'Raw preview dedupe must preserve same-ship/same-date rows with different cabin/guest identity.');
assert(sameSailingPreview.bookedCruises.new.every(row => !String(row.reservationNumber || '').startsWith('unconfirmed:')), 'Generated unconfirmed IDs must not be stored as real reservation numbers.');

const conflictingStableIds = dedupeBookedCruisesWithLedger([
  { ...completeWithReservation, id: 'same-stable-id', reservationNumber: 'CONFLICT-A' },
  { ...completeWithReservation, id: 'same-stable-id', reservationNumber: 'CONFLICT-B' },
], 'conflicting stable id fixture');
assert(conflictingStableIds.cruises.length === 2, 'A recycled stable ID must never collapse two different reservation numbers.');

const unchangedExisting = Array.from({ length: 5 }, (_, index) => ({
  id: `old-${index}`,
  reservationNumber: `OLD-${index}`,
  shipName: 'Old Ship', sailDate: `2025-0${index + 1}-01`, returnDate: `2025-0${index + 1}-08`,
  departurePort: 'Old Port', destination: 'Old', nights: 7, status: 'completed', completionState: 'completed', cruiseSource: 'royal',
}));
const preview = {
  offers: { new: [], updates: [], unchanged: [] },
  cruises: { new: [], updates: [], unchanged: [] },
  bookedCruises: { new: authoritative, updates: [], unchanged: unchangedExisting },
  loyalty: null,
};
const counts = calculateSyncCounts(preview);
assert(counts.totalBookedCruises === 72, 'Review count must describe the canonical incoming dataset only.');
assert(counts.upcomingCruises === 12, 'Review must report exactly 12 upcoming rows.');
assert(counts.bookedCruisesUnchanged === 5, 'Preserved existing rows must remain separately reported.');

const originalLog = console.log;
console.log = () => {};
let firstApply;
try {
firstApply = applySyncPreview(preview, [], [], [], 'royal', {
  allowOfferRemoval: true,
  allowCruiseRemoval: true,
  allowBookedCruiseRemoval: true,
  allowActiveBookedCruiseRemoval: true,
  allowCompletedCruiseRemoval: true,
});
} finally { console.log = originalLog; }
assert(firstApply.bookedCruises.length === 72, 'Apply Sync must persist all 72 canonical incoming booked/history rows.');
assert(firstApply.bookedCruises.filter(row => row.completionState === 'upcoming').length === 12, 'Apply Sync must retain 12 upcoming rows.');
assert(firstApply.bookedCruises.filter(row => row.completionState === 'completed').length === 60, 'Apply Sync must retain 60 completed rows.');
assert(firstApply.bookedCruises.filter(row => row.sailDate === '2026-10-01' && row.shipName === 'Wonder of the Seas').length === 2, 'Final SyncLogic dedupe must preserve distinct reservation-free same-date bookings.');

console.log = () => {};
let secondApply;
try {
secondApply = applySyncPreview(preview, [], [], firstApply.bookedCruises, 'royal', {
  allowOfferRemoval: true,
  allowCruiseRemoval: true,
  allowBookedCruiseRemoval: true,
  allowActiveBookedCruiseRemoval: true,
  allowCompletedCruiseRemoval: true,
});
} finally { console.log = originalLog; }
const identity = row => row.reservationNumber || `${row.shipName}|${row.sailDate}|${row.cabinNumber}|${(row.guestNames || []).join('|')}`;
assert(secondApply.bookedCruises.length === firstApply.bookedCruises.length, 'Second identical Apply Sync must not drift in count.');
assert(JSON.stringify(secondApply.bookedCruises.map(identity).sort()) === JSON.stringify(firstApply.bookedCruises.map(identity).sort()), 'Second identical Apply Sync must be identity-idempotent.');


assert(!storageLoaders.includes('getKnownCasinoProfileCruises'), 'Storage hydration must not merge account-specific mock cruise fallbacks into authenticated sync results.');
assert(storageLoaders.includes('Persisted authenticated sync data is the only production source'), 'Storage hydration must document live persisted data as the production source of truth.');

console.log('PASS testV1242Build314ClubRoyaleCruiseCompleteness');
