const fs = require('fs');
const path = require('path');
const { root, loadTs } = require('./clubRoyaleTestBootstrap');
const {
  buildUnconfirmedBookingIdentifier,
  getExtractedBookedCruiseIdentity,
  getRealBookingIdentifier,
  isPlaceholderBookingIdentifier,
  mergeExtractedBookedCruiseRows,
} = loadTs('lib/royalCaribbean/bookedExtractionIdentity.ts');

function assert(condition, message) { if (!condition) throw new Error(message); }

assert(isPlaceholderBookingIdentifier('booking_0'), 'Per-batch booking_0 must be treated as a placeholder.');
assert(isPlaceholderBookingIdentifier('rc_12'), 'Generated rc_12 must be treated as a placeholder.');
assert(isPlaceholderBookingIdentifier('unconfirmed:abc'), 'Unconfirmed hashes must not become authoritative reservation IDs.');
assert(!isPlaceholderBookingIdentifier('ABC12345'), 'A real reservation locator must remain authoritative.');
assert(getRealBookingIdentifier({ bookingId: 'booking_0', reservationNumber: 'ABC12345' }) === 'abc12345', 'Reservation number must outrank a generated booking placeholder.');

const sameDateDifferentReservations = mergeExtractedBookedCruiseRows([
  { bookingId: 'RES-A', shipName: 'Odyssey of the Seas', sailingStartDate: '2026-09-01', cabinNumberOrGTY: '8210', passengers: [{ firstName: 'Alpha', lastName: 'Guest' }] },
  { bookingId: 'RES-B', shipName: 'Odyssey of the Seas', sailingStartDate: '2026-09-01', cabinNumberOrGTY: '8210', passengers: [{ firstName: 'Alpha', lastName: 'Guest' }] },
]);
assert(sameDateDifferentReservations.rows.length === 2, 'Same ship/date with different reservations must preserve both bookings.');

const sameDateDifferentCabins = mergeExtractedBookedCruiseRows([
  { bookingId: 'booking_0', shipName: 'Wonder of the Seas', sailingStartDate: '2026-10-01', cabinNumberOrGTY: '8210', passengers: [{ firstName: 'Alpha', lastName: 'Guest' }] },
  { bookingId: 'booking_0', shipName: 'Wonder of the Seas', sailingStartDate: '2026-10-01', cabinNumberOrGTY: '9220', passengers: [{ firstName: 'Beta', lastName: 'Guest' }] },
]);
assert(sameDateDifferentCabins.rows.length === 2, 'Placeholder IDs repeated across batches must not collapse different cabin/guest bookings.');
assert(new Set(sameDateDifferentCabins.rows.map(row => row.bookingId)).size === 2, 'Different unconfirmed bookings need distinct deterministic IDs.');
assert(sameDateDifferentCabins.rows.every(row => row.bookingId.startsWith('unconfirmed:')), 'Placeholder IDs must be replaced with non-authoritative deterministic IDs.');

const exactRepeat = {
  bookingId: 'booking_0', shipName: 'Icon of the Seas', sailingStartDate: '2027-01-01', sailingEndDate: '2027-01-08',
  cabinNumberOrGTY: 'GTY', itinerary: 'Eastern Caribbean', rawBooking: { voyageId: 'VOY-1', status: 'BOOKED' },
};
const repeated = mergeExtractedBookedCruiseRows([exactRepeat, JSON.parse(JSON.stringify(exactRepeat))]);
assert(repeated.rows.length === 1, 'An exact repeated payload must merge once.');
assert(repeated.mergedCount === 1, 'The exact repeated payload must be ledgered as one merge.');

const ambiguousDistinct = mergeExtractedBookedCruiseRows([
  { bookingId: 'booking_0', shipName: 'Icon of the Seas', sailingStartDate: '2027-01-01', rawBooking: { voyageId: 'VOY-1', sequence: 'A' } },
  { bookingId: 'booking_0', shipName: 'Icon of the Seas', sailingStartDate: '2027-01-01', rawBooking: { voyageId: 'VOY-1', sequence: 'B' } },
]);
assert(ambiguousDistinct.rows.length === 2, 'Ship/date alone must not collapse opaque rows with distinct payload detail.');
assert(getExtractedBookedCruiseIdentity(ambiguousDistinct.rows[0]) !== getExtractedBookedCruiseIdentity(ambiguousDistinct.rows[1]), 'Opaque identities must reflect complete stable payload detail.');

const completedSameDate = mergeExtractedBookedCruiseRows([
  { bookingId: '', shipName: 'Liberty of the Seas', sailingStartDate: '2025-05-01', status: 'Completed', cabinNumberOrGTY: '6310', passengers: [{ firstName: 'Alpha', lastName: 'Guest' }] },
  { bookingId: '', shipName: 'Liberty of the Seas', sailingStartDate: '2025-05-01', status: 'Completed', cabinNumberOrGTY: '7320', passengers: [{ firstName: 'Beta', lastName: 'Guest' }] },
]);
assert(completedSameDate.rows.length === 2, 'Completed history must preserve same-date rows with different cabin/guest identities.');

const stableUnconfirmed = buildUnconfirmedBookingIdentifier(exactRepeat);
assert(stableUnconfirmed === buildUnconfirmedBookingIdentifier(JSON.parse(JSON.stringify(exactRepeat))), 'Unconfirmed IDs must be deterministic across equivalent payloads.');

const provider = fs.readFileSync(path.join(root, 'state/RoyalCaribbeanSyncProvider.tsx'), 'utf8');
assert(!provider.includes('existingShipDates'), 'Extraction state machine must not dedupe bookings by ship/date.');
assert(!provider.includes('const completedKey ='), 'Completed-history extraction must use the shared robust identity helper.');
assert(!provider.includes('`booking_${index}`'), 'Per-batch array indexes must not become booking identities.');
assert(provider.includes('mergeExtractedBookedCruiseRows([...prev.extractedBookedCruises, ...incoming])'), 'Cruise batches must use robust extraction reconciliation.');
assert(provider.includes('mergeExtractedBookedCruiseRows([...prev.extractedBookedCruises, ...completedFromHistory])'), 'Completed history must use robust extraction reconciliation.');

console.log('PASS testV1242Build314ClubRoyaleExtractionIdentity');
