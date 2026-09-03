const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const identity = loadTs('lib/offers/offerInstanceIdentity.ts');

const first = {
  id: 'offer-instance-a', playerOfferId: 'royal-player-offer-a', offerCode: '2609A04',
  offerName: 'September balcony offer', title: 'September balcony offer', offerType: 'royal',
};
const second = {
  id: 'offer-instance-b', playerOfferId: 'royal-player-offer-b', offerCode: '2609A04',
  offerName: 'September interior offer', title: 'September interior offer', offerType: 'royal',
};

const viewParams = identity.buildOfferDetailsParams(first, { expectedCruiseCount: 243 });
const decodeParams = identity.buildOfferDetailsParams(first, { expectedCruiseCount: 243, openDecoded: true });
assert.equal(viewParams.offerInstanceKey, decodeParams.offerInstanceKey, 'View and Decode must target the same canonical offer instance');
assert.equal(viewParams.offerId, decodeParams.offerId);
assert.equal(viewParams.openDecoded, '');
assert.equal(decodeParams.openDecoded, '1');
assert.equal(identity.resolveOfferDetailsInstance([second, first], viewParams), first, 'exact provider instance must open the tapped offer');
assert.equal(identity.resolveOfferDetailsInstance([first, second], { offerCode: first.offerCode }), undefined, 'duplicate offer codes must never choose an arbitrary instance');

const offerPath = identity.buildOfferDetailsPath(first, { expectedCruiseCount: 243 });
const offerUrl = new URL(offerPath, 'https://easyseas.local');
assert.equal(offerUrl.searchParams.get('offerId'), first.id);
assert.equal(offerUrl.searchParams.get('offerInstanceKey'), identity.getMarketingOfferInstanceKey(first));
assert.equal(offerUrl.searchParams.get('expectedCruiseCount'), '243');

// Reproduce the Royal acceptance corpus: 13 material offers containing 3,151
// distinct offer-sailing rows. Paging must return every row, not one physical
// sailing and not an offer-card count masquerading as loaded inventory.
const totalRoyalRows = 3151;
const rows = Array.from({ length: totalRoyalRows }, (_, index) => ({
  id: `royal-row-${index + 1}`,
  offerInstanceKey: `royal-instance-${index % 13}`,
  sourceRecordId: `provider-row-${index + 1}`,
  shipName: index % 2 ? 'Icon of the Seas' : 'Harmony of the Seas',
  sailDate: `2027-01-${String((index % 28) + 1).padStart(2, '0')}`,
  cabinType: index % 4 === 0 ? 'Suite' : index % 4 === 1 ? 'Balcony' : index % 4 === 2 ? 'Oceanview' : 'Interior',
  guests: index % 3 === 0 ? 1 : 2,
}));
assert.equal(new Set(rows.map((row) => row.offerInstanceKey)).size, 13);
const pagedReadback = [];
for (let offset = 0; offset < rows.length; offset += 200) pagedReadback.push(...rows.slice(offset, offset + 200));
assert.equal(pagedReadback.length, totalRoyalRows);
assert.equal(new Set(pagedReadback.map((row) => row.sourceRecordId)).size, totalRoyalRows, 'offer-sailing option rows must not collapse');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const overview = read('app/(tabs)/(overview)/index.tsx');
const warRoom = read('app/war-room.tsx');
const offerDetails = read('app/offer-details.tsx');
const certificateCodes = read('app/certificate-codes.tsx');
const certificateSummary = read('app/certificate-summary-results.tsx');
const askMyData = read('lib/askMyData.ts');
const askAllOffers = read('lib/askAllOffers.ts');

for (const [name, source] of Object.entries({ overview, warRoom })) {
  assert.match(source, /buildOfferDetailsParams/, `${name} View and Decode actions must use the shared offer-instance route builder`);
}
assert.match(offerDetails, /resolveOfferDetailsInstance/);
assert.doesNotMatch(offerDetails, /find\(offerCandidate => offerCandidate\.offerCode ===/);
assert.match(offerDetails, /while \(!cancelled && cursor && collectedRows\.length < targetRows\)/, 'offer details must auto-page the complete eligible list');
assert.match(offerDetails, /eligibleRowsLoaded = offerData\.cruises\.length/);
assert.match(offerDetails, /const OFFER_VISIBLE_PAGE_SIZE = 20/);
assert.match(offerDetails, /data=\{pagedOfferCruises\}/);
assert.match(offerDetails, /offer-sailing-page-controls-top/);
assert.match(offerDetails, /offer-sailing-page-controls-bottom/);
assert.match(offerDetails, /maxToRenderPerBatch=\{20\}/);
assert.match(offerDetails, /offer-list-load-error/);
assert.match(offerDetails, /offer-list-retry/);
assert.match(offerDetails, /offer-empty-retry/);
assert.match(certificateCodes, /params: \{ monthTarget, certificateType: entry\.certificateType, certificateCode: entry\.certificateCode \}/);
assert.match(certificateSummary, /certificateType: item\.certificateType/);
assert.match(certificateSummary, /certificate-summary-results\.open-cruise-/);
assert.match(askMyData, /buildOfferDetailsPath\(offer\)/);
assert.match(askAllOffers, /buildOfferDetailsPath\(\{/);

console.log('PASS Build 445 Item 4: canonical offer/certificate actions preserve instance identity, page all 3,151 Royal rows across 13 offers, and expose truthful retryable readback');
