const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function loadStandaloneTs(relativePath) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(compiled, filename);
  return mod.exports;
}

const integrity = loadStandaloneTs('lib/royalCaribbean/syncIntegrity.ts');
const certificates = loadStandaloneTs('lib/certificates/certificatePdfPipeline.ts');
const provider = fs.readFileSync(path.join(root, 'state/RoyalCaribbeanSyncProvider.tsx'), 'utf8');
const syncLogic = fs.readFileSync(path.join(root, 'lib/royalCaribbean/syncLogic.ts'), 'utf8');
const transformers = fs.readFileSync(path.join(root, 'lib/royalCaribbean/dataTransformers.ts'), 'utf8');
const apiTransformers = fs.readFileSync(path.join(root, 'lib/royalCaribbean/apiTransformers.ts'), 'utf8');
const upcoming = fs.readFileSync(path.join(root, 'lib/royalCaribbean/step2_upcoming.ts'), 'utf8');
const offers = fs.readFileSync(path.join(root, 'lib/royalCaribbean/step1_offers.ts'), 'utf8');
const healing = fs.readFileSync(path.join(root, 'lib/dataHealing.ts'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'app/(tabs)/settings.tsx'), 'utf8');
const availability = fs.readFileSync(path.join(root, 'lib/casinoAvailability.ts'), 'utf8');
const fallback = fs.readFileSync(path.join(root, 'lib/knownProfileFallback.ts'), 'utf8');

assert.equal(integrity.normalizeRoyalDateOnly('2026-04-02T18:30:00Z'), '2026-04-02');
assert.equal(integrity.getProviderRecordId('booking_0'), undefined);
assert.equal(integrity.getProviderRecordId('RC-72819'), 'RC-72819');

const baseOffer = {
  offerCode: 'RCL-1', offerName: 'April offer', offerExpirationDate: '2026-04-30', offerType: 'comped',
  shipName: 'Icon of the Seas', shipCode: 'IC', sailingDate: '2026-04-02', departurePort: 'Miami',
  itinerary: 'Western Caribbean', cabinType: 'Balcony', numberOfGuests: '2', perks: 'Free Play $500',
  interiorPrice: '$0', oceanviewPrice: '$0', balconyPrice: '$0', suitePrice: '$1500', taxesAndFees: '$250',
  portList: 'Miami|Cozumel', totalNights: 7, bookingLink: 'https://example.test/a',
};
const suiteOffer = { ...baseOffer, cabinType: 'Suite', numberOfGuests: '1', suitePrice: '$950', perks: 'Free Play $750' };
assert.notEqual(integrity.createRoyalOfferSailingIdentity(baseOffer), integrity.createRoyalOfferSailingIdentity(suiteOffer));
assert.equal(integrity.deduplicateExactRows([baseOffer, suiteOffer, { ...baseOffer }], integrity.createRoyalOfferSailingIdentity).retained.length, 2);
assert.equal(integrity.deduplicateExactRows([baseOffer, suiteOffer, { ...baseOffer }], integrity.createRoyalOfferSailingIdentity).exactDuplicates, 1);

const baseBooking = {
  bookingId: '', shipName: 'Icon of the Seas', shipCode: 'IC', sailingStartDate: '2026-04-02', sailingEndDate: '2026-04-09',
  departurePort: 'Miami', arrivalPort: 'Miami', cruiseTitle: 'Western Caribbean', itinerary: 'Western Caribbean',
  cabinType: 'Balcony', cabinCategory: '4D', cabinNumberOrGTY: '', numberOfGuests: '2', numberOfNights: 7,
  interiorPrice: '', oceanviewPrice: '', balconyPrice: '', suitePrice: '', taxesAndFees: '', portList: '',
};
assert.notEqual(
  integrity.createRoyalBookedCruiseIdentity(baseBooking),
  integrity.createRoyalBookedCruiseIdentity({ ...baseBooking, cabinType: 'Suite', numberOfGuests: '1' }),
  'same ship/date rows with distinct cabin or occupancy are variants, not duplicates',
);

const certificateRow = {
  certificateCode: '2607A05', certificateFamily: 'A', certificateFamilyCode: 'A', sourcePage: 1,
  sourceGroup: 'page-1-group-1-sailing-1', sourceReferences: [{ page: 1, group: 'page-1-group-1-sailing-1', pageAttribution: 'explicit' }],
  pageAttribution: 'explicit', shipName: 'Icon of the Seas', sailingDate: '2026-04-02', cabinCategory: 'Balcony',
  benefits: [{ kind: 'free_play', amount: 500 }], parserSource: 'device', parserVersion: 'certificate-parser-v2',
  validationStatus: 'accepted', documentHash: 'sha256:test', parsedAt: '2026-07-16T00:00:00.000Z',
};
assert.equal(certificates.dedupeCertificateSailings([certificateRow, { ...certificateRow }]).length, 1);
assert.equal(certificates.dedupeCertificateSailings([certificateRow, { ...certificateRow, sourceGroup: 'page-1-group-2-sailing-1' }]).length, 2);
assert.equal(certificates.getCertificateSailingGroupCount([certificateRow, { ...certificateRow, sourceGroup: 'page-1-group-2-sailing-1' }]), 2);

assert.match(provider, /createRoyalSyncHandoffEvidence/);
assert.match(provider, /recordRoyalHandoff\('offer'/);
assert.match(provider, /recordRoyalHandoff\('booked'/);
assert.doesNotMatch(provider, /existingShipDates/);
assert.doesNotMatch(provider, /booking_\$\{index\}/);
assert.doesNotMatch(provider, /cabinNumberOrGTY: stringifyValue\(row\.cabinNumberOrGTY\) \|\| 'GTY'/);
assert.match(syncLogic, /exactOfferDuplicates/);
assert.match(syncLogic, /unaccountedRows/);
assert.match(syncLogic, /createRoyalOfferSailingIdentity/);
assert.match(syncLogic, /createRoyalBookedCruiseIdentity/);
assert.match(transformers, /requiresCompletedReview/);
assert.match(transformers, /hasDurationConflict/);
assert.doesNotMatch(apiTransformers, /\?\? 7/);
assert.doesNotMatch(upcoming, /defaulting to 7/);
assert.doesNotMatch(offers, /\}\) \|\| sailings\[0\]/);
assert.match(healing, /findSingleMaterialOffer/);
assert.match(healing, /linkedCruises\.length === 1/);
assert.doesNotMatch(settings, /parseInt\(nightsRaw\) \|\| 7/);
assert.match(settings, /validationStatus: sailDate && returnDate && nights > 0 \? 'valid' : 'quarantined'/);
assert.doesNotMatch(availability, /BOOKED_CRUISES_DATA/);
assert.doesNotMatch(availability, /nights \|\| 7/);
assert.doesNotMatch(availability, /buildInferredSeaDay/);
assert.match(fallback, /return false/);
assert.match(fallback, /ANNUAL_CASINO_REPORT_FACTS/);
assert.match(fallback, /return \[\]/);

console.log('Royal sync integrity items 21-40 regression checks passed');
