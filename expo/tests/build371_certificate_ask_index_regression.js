const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const sailingIndex = loadTs('lib/certificates/certificateSailingIndex.ts');
const askMyData = loadTs('lib/askMyData.ts');

const parsedSailing = {
  certificateCode: '2608C09',
  certificateFamily: 'C',
  certificateFamilyCode: 'C',
  sourcePage: 2,
  sourceGroup: 'page-2-group-1',
  sourceReferences: [],
  pageAttribution: 'explicit',
  shipName: 'Icon Of The Seas',
  sailingDate: '2026-09-26',
  departurePort: 'Miami, Florida',
  itinerary: '7 Night Eastern Caribbean & Perfect Day Cruise',
  offerTypeLabel: 'Cruise Fare For 1 Guest',
  cabinCategory: 'Interior - GTY',
  occupancy: '1 guest',
  guestCount: 1,
  onboardCredit: 50,
  pointRequirement: 600,
  benefits: [{ kind: 'onboard_credit', amount: 50, evidence: '$50 Next Cruise OBC' }],
  parserSource: 'device',
  parserVersion: 'fixture',
  parsedAt: '2026-08-17T00:00:00.000Z',
  validationStatus: 'accepted',
};

const certificate = {
  id: 'document-test',
  type: 'freeplay',
  label: '2608C09 Instant Cruise Reward',
  value: 50,
  status: 'available',
  certificateCode: '2608C09',
  sourcePdfUrl: 'https://www.royalcaribbean.com/2608C09.pdf',
  parserStatus: 'parsed_successfully',
  parserVersion: 'fixture',
  parsedSailings: [parsedSailing],
};

const localIndex = sailingIndex.buildLocalCertificateSailingIndex([certificate]);
assert.equal(localIndex.length, 1);
assert.equal(localIndex[0].levels[0].departurePort, 'Miami, Florida');
assert.equal(localIndex[0].levels[0].itinerary, '7 Night Eastern Caribbean & Perfect Day Cruise');
assert.equal(localIndex[0].levels[0].guestCount, 1);

const response = askMyData.askMyDataSearch({
  query: 'Which certificate has Icon of the Seas from Miami on September 26 2026?',
  offers: [],
  cruises: [],
  certificates: [certificate],
  calendarEvents: [],
});
const match = response.results.find((result) => result.id.startsWith('certificate-sailing-'));
assert.ok(match, 'Ask My Data must return the parsed certificate sailing');
assert.equal(match.source, 'certificates');
assert.match(match.actionRoute, /^\/certificate-lookup\?query=/);
assert.match(match.detail, /Departs Miami, Florida/);
assert.match(match.detail, /Eastern Caribbean/);

const indexSource = fs.readFileSync(path.join(root, 'lib/certificates/certificateSailingIndex.ts'), 'utf8');
assert.match(indexSource, /never merged into CoreData\/Available Cruises/i);

console.log('PASS Build 371 certificate sailing browse/index and Ask My Data isolation regression');
