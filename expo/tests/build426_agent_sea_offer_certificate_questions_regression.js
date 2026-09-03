const assert = require('node:assert/strict');
const { loadTs } = require('../scripts/clubRoyaleTestBootstrap');

const ask = loadTs('lib/askMyData.ts');

assert.deepEqual(
  ask.getAskMyDataDateWindow('What offers are available next month?', new Date(2026, 7, 27)),
  { sailDateFrom: '2026-09-01', sailDateTo: '2026-09-30' },
);

const cruises = [
  {
    id: 'icon-europe-september', shipName: 'Icon of the Seas', sailDate: '2026-09-12', returnDate: '2026-09-19',
    departurePort: 'Barcelona, Spain', destination: 'Western Mediterranean Europe', destinationRegion: 'Europe',
    itineraryName: 'Spain, France & Italy', nights: 7, status: 'available', offerCode: '26EUROPE',
    offerName: 'European Casino Offer', offerCategory: 'Balcony', cabinType: 'Balcony', guests: 2,
  },
  {
    id: 'icon-bahamas-october', shipName: 'Icon of the Seas', sailDate: '2026-10-10', returnDate: '2026-10-17',
    departurePort: 'Miami, Florida', destination: 'Bahamas', nights: 7, status: 'available', offerCode: '26BAHAMAS', guests: 1,
  },
];

const certificates = [{
  id: 'cert-europe', type: 'instant', label: '2609C07', value: 0, status: 'available', certificateCode: '2609C07',
  parsedSailings: [{
    certificateCode: '2609C07', shipName: 'Icon of the Seas', sailingDate: '2026-09-12',
    departurePort: 'Barcelona, Spain', itinerary: 'Spain, France & Italy', cabinCategory: 'Balcony',
    occupancy: '2 Guests', guestCount: 2, pointRequirement: 4000, sourcePage: 3, sourceGroup: 'row-1',
  }],
}];

const iconAnswer = ask.askMyDataSearch({
  query: 'Is Icon a part of September 2026 offers?', offers: [], cruises, certificates, calendarEvents: [],
});
assert.match(iconAnswer.directAnswer || '', /^Yes\./);
assert.match(iconAnswer.directAnswer || '', /Icon of the Seas/);
assert.match(iconAnswer.directAnswer || '', /2 Guests/);
assert.doesNotMatch(iconAnswer.directAnswer || '', /2026-10-10/);

const europeAnswer = ask.askMyDataSearch({
  query: 'What Europe cruises are available September 2026 and at what points levels?',
  offers: [], cruises, certificates, calendarEvents: [],
});
assert.match(europeAnswer.directAnswer || '', /European offer\/certificate sailing option/);
assert.match(europeAnswer.directAnswer || '', /4,000 points/);
assert.match(europeAnswer.directAnswer || '', /Balcony/);
assert.match(europeAnswer.directAnswer || '', /2 Guests/);
assert.doesNotMatch(europeAnswer.directAnswer || '', /Bahamas/);

console.log('PASS Build 426 Agent SEA month, ship, Europe, certificate-points, cabin, and guest questions');
