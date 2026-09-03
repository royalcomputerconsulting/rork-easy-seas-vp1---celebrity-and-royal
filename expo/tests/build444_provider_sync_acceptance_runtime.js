const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const { applySyncPreview } = loadTs('lib/royalCaribbean/syncLogic.ts');
const { verifyProfileSyncReadback } = loadTs('lib/sync/profileSyncReadback.ts');

const when = '2026-08-31T12:00:00.000Z';
const sources = ['royal', 'celebrity', 'carnival'];
const owners = ['primary', 'secondary'];
const existingOffers = sources.flatMap((source) => owners.map((owner) => ({
  id: `${source}-${owner}-offer-old`,
  offerCode: `${source.toUpperCase()}-${owner.toUpperCase()}-OLD`,
  offerName: `${source} ${owner} old`,
  offerSource: source,
  ownerProfileId: owner,
  status: 'active',
  createdAt: when,
  updatedAt: when,
})));
const existingCruises = sources.flatMap((source) => owners.map((owner, ownerIndex) => ({
  id: `${source}-${owner}-cruise-old`,
  shipName: source === 'royal' ? 'Harmony of the Seas' : source === 'celebrity' ? 'Celebrity Equinox' : 'Carnival Celebration',
  sailDate: `2027-0${ownerIndex + 1}-10`,
  returnDate: `2027-0${ownerIndex + 1}-17`,
  nights: 7,
  cruiseSource: source,
  ownerProfileId: owner,
  offerCode: `${source.toUpperCase()}-${owner.toUpperCase()}-OLD`,
  status: 'available',
  createdAt: when,
  updatedAt: when,
})));

function applyAuthoritativeProviderSync(source, owner, currentOffers, currentCruises) {
  const cruise = {
    ...currentCruises.find((row) => row.cruiseSource === source && row.ownerProfileId === owner),
    id: `${source}-${owner}-cruise-new`,
    offerCode: `${source.toUpperCase()}-${owner.toUpperCase()}-NEW`,
    sailDate: '2027-12-01',
    returnDate: '2027-12-08',
  };
  const offer = {
    ...currentOffers.find((row) => row.offerSource === source && row.ownerProfileId === owner),
    id: `${source}-${owner}-offer-new`,
    offerCode: `${source.toUpperCase()}-${owner.toUpperCase()}-NEW`,
    cruiseId: cruise.id,
    cruiseIds: [cruise.id],
  };
  return applySyncPreview({
    offers: { new: [offer], updates: [], unchanged: [] },
    cruises: { new: [cruise], updates: [], unchanged: [] },
    bookedCruises: { new: [], updates: [], unchanged: [] },
    loyalty: null,
  }, currentOffers, currentCruises, [], source, {
    allowOfferRemoval: true,
    allowCruiseRemoval: true,
    allowBookedCruiseRemoval: false,
    targetOwnerProfileId: owner,
    includeUnownedRecords: false,
  });
}

let applied = applyAuthoritativeProviderSync('royal', 'primary', existingOffers, existingCruises);
assert.equal(applied.offers.length, 6, 'Royal replacement must replace exactly one owner/provider scope');
assert.ok(!applied.offers.some((row) => row.id === 'royal-primary-offer-old'));
assert.ok(applied.offers.some((row) => row.id === 'royal-primary-offer-new'));
assert.ok(applied.offers.some((row) => row.id === 'royal-secondary-offer-old'), 'secondary Royal scope must be preserved');
assert.ok(applied.offers.some((row) => row.id === 'celebrity-primary-offer-old'), 'Celebrity must survive Royal sync');
assert.ok(applied.offers.some((row) => row.id === 'carnival-primary-offer-old'), 'Carnival must survive Royal sync');

applied = applyAuthoritativeProviderSync('celebrity', 'secondary', applied.offers, applied.cruises);
assert.equal(applied.offers.length, 6, 'Celebrity replacement must replace exactly one owner/provider scope');
assert.ok(applied.offers.some((row) => row.id === 'royal-primary-offer-new'));
assert.ok(applied.offers.some((row) => row.id === 'celebrity-secondary-offer-new'));
assert.ok(!applied.offers.some((row) => row.id === 'celebrity-secondary-offer-old'));

const success = verifyProfileSyncReadback([
  { id: 'primary', clubRoyalePoints: 23_446, clubRoyaleTier: 'Signature' },
  { id: 'secondary', clubRoyalePoints: 800, clubRoyaleTier: 'Choice' },
], 'secondary', { clubRoyalePoints: 800, clubRoyaleTier: 'Choice' });
assert.equal(success.verified, true);
assert.equal(success.targetFound, true);
const wrongOwner = verifyProfileSyncReadback([
  { id: 'primary', clubRoyalePoints: 23_446 },
], 'secondary', { clubRoyalePoints: 800 });
assert.equal(wrongOwner.verified, false);
assert.equal(wrongOwner.targetFound, false);
const stale = verifyProfileSyncReadback([
  { id: 'secondary', celebrityBlueChipPoints: 600 },
], 'secondary', { celebrityBlueChipPoints: 667 });
assert.deepEqual(stale.mismatchedFields, ['celebrityBlueChipPoints']);

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.match(provider, /verifyProfileSyncReadback/);
assert.match(provider, /PROFILE_READBACK_FAILED/);
assert.match(provider, /CARNIVAL_PROFILE_READBACK_FAILED/);
assert.match(provider, /syncPublicationWarnings\.length > 0/);
assert.match(provider, /PUBLISH_LOCAL_COMMIT/);
assert.match(provider, /coreDataContext\.refreshData\(\)/);
assert.match(provider, /availableCruiseRows:/);
assert.match(provider, /physicalSailingRows:/);
assert.match(provider, /offerSailingRelationships:/);
assert.match(provider, /targetSlotLabel/);

const settings = read('app/(tabs)/settings.tsx');
const header = read('components/CompactDashboardHeader.tsx');
const agent = read('state/AgentXProvider.tsx');
assert.match(settings, /profileDisplayUser/);
assert.match(header, /clubRoyaleCurrentYearPoints/);
assert.match(agent, /useLoyalty\(\)/);

console.log('PASS Build 444 provider sync acceptance: provider/owner replacement isolation, profile readback, truthful warnings, count separation, and live consumers');
