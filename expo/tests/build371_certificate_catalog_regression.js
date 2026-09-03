const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const parser = loadTs('lib/certificates/certificatePdfParserCore.ts');

// Rows copied from Royal's public 2608C09 PDF layout. This is the material
// row format that previously downloaded successfully but parsed as zero.
const officialRowExcerpt = [
  'Offer Code Ship Departure Port Sail Date Itinerary Next Cruise Bonus Stateroom Type Offer Type Next Cruise OBC',
  '2608C09 Freedom Of The Seas® Miami, Florida August 27, 2026 4 Night Bahamas & Perfect Day Cruise Interior - GTY Cruise Fare For 1 Guest $25',
  '2608C09 Navigator Of The Seas® Los Angeles, California August 28, 2026 7 Night Cabo, Vallarta & Mazatlan Interior - GTY Cruise Fare For 1 Guest $50',
  '2608C09 Quantum Of The Seas® Los Angeles, California September 4, 2026 7 Night Cabo Overnight & Ensenada Interior - GTY Cruise Fare For 1 Guest $50',
].join(' ');
const rows = parser.parseCertificateSailingsFromText({
  certificateCode: '2608C09',
  certificateType: 'C',
  points: 600,
  pdfUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2608C09.pdf',
  monthlyIndexUrl: 'https://www.royalcaribbean.com/content/dam/royal/resources/pdf/casino/offers/2608C.pdf',
}, officialRowExcerpt);
assert.equal(rows.length, 3, 'Royal material certificate rows must parse one sailing per ship/date row');
assert.deepEqual(rows.map((row) => row.sailDate), ['2026-08-27', '2026-08-28', '2026-09-04']);

const lookup = read('app/certificate-lookup.tsx');
assert.match(lookup, /initialMonth \?\? 'thisMonth'/, 'View Certificates must open on the current month');
assert.match(lookup, /displayedCertificateCatalog/, 'The current certificate catalog must render before a download');
assert.match(lookup, /full A\/C certificate catalog for the selected month/, 'The UI must explain full-catalog local persistence');

const batch = read('lib/certificates/certificateBatchDownload.ts');
assert.match(batch, /const groups = chunk\(entries, 2\)/, 'Download All must use bounded two-PDF concurrency');
assert.match(batch, /documentKind: 'monthly_index'/, 'Monthly indexes must not be indexed as owned certificates');
assert.match(batch, /onProgress\?\.\(skippedCompletedCodes\.length \+ completedCodes, discoveredEntries\.length\)/, 'Download All must expose whole-library per-code progress');

const store = read('lib/certificates/certificateDocumentStore.ts');
assert.match(store, /certificateStoreQueues/, 'Certificate storage updates must remain serialized per profile');
assert.match(store, /input\.metadata/, 'Archive metadata must be persisted with the retained document');

const engine = read('lib/certificates/clientCertificatePdfEngine.ts');
assert.match(engine, /PDF_TEXT_CACHE_MAX_ENTRIES = 6/, 'PDF byte/text cache must be bounded');

console.log('PASS Build 371 certificate catalog, parser, Download All queue, and local persistence regression');
