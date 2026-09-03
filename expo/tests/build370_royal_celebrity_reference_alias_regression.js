const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const app = JSON.parse(read('app.json')).expo;
assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);

const { applySyncPreview } = loadTs('lib/royalCaribbean/syncLogic.ts');
const { validateOfferCruiseReferences } = loadTs('lib/royalCaribbean/syncIntegrity.ts');

function verifyExactReferenceAliases(syncSource) {
  // Reproduce the device failure at its reported size. The public offer code
  // is intentionally shared and provider instance metadata is intentionally
  // absent, so neither code nor instance heuristics can repair these edges.
  const existingCruises = Array.from({ length: 222 }, (_, index) => ({
    id: `${syncSource}-stable-${index}`,
    shipName: `Ship ${index}`,
    sailDate: `2027-01-${String((index % 28) + 1).padStart(2, '0')}`,
    returnDate: `2027-02-${String((index % 28) + 1).padStart(2, '0')}`,
    departurePort: 'Miami',
    destination: 'Caribbean',
    nights: 7,
    offerCode: 'SHARED-CODE',
    cruiseSource: syncSource,
    status: 'available',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }));
  const updatedCruises = existingCruises.map((cruise) => ({ ...cruise }));
  const offers = existingCruises.map((_, index) => ({
    id: `${syncSource}-offer-${index}`,
    offerCode: 'SHARED-CODE',
    offerName: `Provider offer ${index}`,
    cruiseId: `${syncSource}-temporary-${index}`,
    cruiseIds: [`${syncSource}-temporary-${index}`],
    offerSource: syncSource,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }));
  const cruiseIdAliases = Object.fromEntries(
    existingCruises.map((cruise, index) => [`${syncSource}-temporary-${index}`, cruise.id]),
  );

  const applied = applySyncPreview({
    offers: { new: offers, updates: [], unchanged: [] },
    cruises: {
      new: [],
      updates: existingCruises.map((existing, index) => ({ existing, updated: updatedCruises[index] })),
      unchanged: [],
    },
    cruiseIdAliases,
    bookedCruises: { new: [], updates: [], unchanged: [] },
    loyalty: null,
  }, [], existingCruises, [], syncSource);

  const validation = validateOfferCruiseReferences(applied.offers, applied.cruises);
  assert.equal(validation.valid, true, `${syncSource} must not retain dangling transform-time IDs`);
  assert.equal(validation.danglingCruiseIds.length, 0);
  assert.equal(applied.offers.length, 222);
  assert.ok(applied.offers.every((offer, index) => offer.cruiseIds[0] === `${syncSource}-stable-${index}`));
}

verifyExactReferenceAliases('royal');
verifyExactReferenceAliases('celebrity');

const syncLogic = read('lib/royalCaribbean/syncLogic.ts');
assert.match(syncLogic, /cruiseIdAliases\[cruise\.id\] = merged\.id/);
assert.match(syncLogic, /directCruiseIdAliases\.get\(id\) \?\? id/);
assert.match(syncLogic, /directlyRemappedLinks/);

console.log('PASS Build 370: all 222 Royal and Celebrity transform-time references remap to exact retained sailing IDs');
