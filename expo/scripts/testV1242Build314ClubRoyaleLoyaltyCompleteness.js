const fs = require('fs');
const path = require('path');
const { root, loadTs } = require('./clubRoyaleTestBootstrap');
const {
  convertLoyaltyInfoToExtended,
  convertDomLoyaltyToExtended,
  mergeExtendedLoyaltyData,
  hasAuthoritativeClubRoyaleData,
  hasAuthoritativeCrownAndAnchorData,
  hasAuthoritativeLoyaltyField,
  buildDefinedLoyaltyStatePatch,
} = loadTs('lib/royalCaribbean/loyaltyConverter.ts');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const fixture = JSON.parse(fs.readFileSync(path.join(root, 'scripts/fixtures/clubRoyale/loyalty-signature-20941.json'), 'utf8'));
const converted = convertLoyaltyInfoToExtended(fixture.payload, fixture.accountId, {
  sourceType: 'api',
  sourceUrl: fixture.sourceUrl,
  accountId: fixture.accountId,
  capturedAt: '2026-07-15T12:00:00.000Z',
});

assert(converted.clubRoyaleTierFromApi === 'Signature', 'Casino tier must map to Club Royale Signature.');
assert(converted.clubRoyalePointsFromApi === 20941, 'individualPoints must map to 20,941 Club Royale points.');
assert(converted.clubRoyaleRelationshipPointsFromApi === 21125, 'relationshipPoints must map to Club Royale relationship points.');
assert(converted.clubRoyaleId === 'CASINO-TEST-001', 'casinoLoyaltyId must map to Club Royale ID.');
assert(converted.crownAndAnchorId === 'CA-TEST-001', 'cruiseLoyaltyId must map to Crown & Anchor ID.');
assert(converted.clubRoyaleEvaluationPeriodStartDate === '2026-04-01', 'Club Royale evaluation start date missing.');
assert(converted.clubRoyaleEvaluationPeriodEndDate === '2027-03-31', 'Club Royale evaluation end date missing.');
assert(converted.crownAndAnchorPointsFromApi === undefined, 'Casino points must never populate Crown & Anchor points.');
assert(converted.crownAndAnchorTier === undefined, 'Casino tier must never populate Crown & Anchor tier.');
assert(converted.loyaltyFieldAuthority?.clubRoyalePoints?.source === 'casino_api', 'Club Royale points source must be casino_api.');
assert(converted.loyaltyFieldAuthority?.clubRoyalePoints?.confidence === 'authoritative', 'Club Royale points must be authoritative.');
assert(hasAuthoritativeClubRoyaleData(converted), 'Club Royale lane should be authoritative.');
assert(!hasAuthoritativeCrownAndAnchorData(converted), 'C&A lane must remain incomplete without C&A tier and points.');

const unrelatedGeneric = convertLoyaltyInfoToExtended({ tier: 'Diamond', individualPoints: 20941 }, 'ACCOUNT-TEST-001', { sourceType: 'api' });
assert(unrelatedGeneric.clubRoyaleTierFromApi === undefined, 'Generic tier must not map without casino endpoint context.');
assert(unrelatedGeneric.clubRoyalePointsFromApi === undefined, 'Generic individualPoints must not map without casino endpoint context.');
assert(unrelatedGeneric.crownAndAnchorTier === undefined, 'Generic tier must not map to C&A.');
assert(unrelatedGeneric.crownAndAnchorPointsFromApi === undefined, 'Generic points must not map to C&A.');

const tierOnlyApi = convertLoyaltyInfoToExtended({ tier: 'Signature' }, fixture.accountId, {
  sourceType: 'api', sourceUrl: fixture.sourceUrl, accountId: fixture.accountId,
});
const domFallback = convertDomLoyaltyToExtended({ clubRoyaleTier: 'Signature', clubRoyalePoints: '20,941' }, fixture.accountId);
const partialMerged = mergeExtendedLoyaltyData(tierOnlyApi, domFallback);
assert(partialMerged.clubRoyaleTierFromApi === 'Signature', 'Tier-only API must retain Signature.');
assert(partialMerged.clubRoyalePointsFromApi === 20941, 'DOM fallback must fill omitted API points.');
assert(partialMerged.loyaltyFieldAuthority?.clubRoyaleTier?.confidence === 'authoritative', 'API tier authority must survive merge.');
assert(partialMerged.loyaltyFieldAuthority?.clubRoyalePoints?.confidence === 'fallback', 'DOM-filled points must retain fallback provenance.');

const missingLater = convertLoyaltyInfoToExtended({}, fixture.accountId, { sourceType: 'api', sourceUrl: fixture.sourceUrl });
const preserved = mergeExtendedLoyaltyData(converted, missingLater);
assert(preserved.clubRoyalePointsFromApi === 20941, 'Missing later payload must not erase good points.');
assert(preserved.clubRoyaleTierFromApi === 'Signature', 'Missing later payload must not erase good tier.');

const zero = convertLoyaltyInfoToExtended({ tier: 'Choice', individualPoints: 0 }, fixture.accountId, {
  sourceType: 'api', sourceUrl: fixture.sourceUrl, accountId: fixture.accountId,
});
assert(zero.clubRoyalePointsFromApi === 0, 'Authoritative numeric zero must be retained.');
const zeroMerged = mergeExtendedLoyaltyData(converted, zero);
assert(zeroMerged.clubRoyalePointsFromApi === 0, 'Authoritative zero must be able to replace an older authoritative value.');

const ca = convertLoyaltyInfoToExtended({
  crownAndAnchorSocietyLoyaltyTier: 'Diamond Plus',
  crownAndAnchorSocietyLoyaltyIndividualPoints: '660',
  crownAndAnchorSocietyLoyaltyRelationshipPoints: '660',
  crownAndAnchorSocietyNextTier: 'Pinnacle',
  crownAndAnchorSocietyRemainingPoints: 40,
}, fixture.accountId, {
  sourceType: 'api',
  sourceUrl: 'https://www.royalcaribbean.com/api/guestaccounts/loyalty/info',
  accountId: fixture.accountId,
});
assert(ca.crownAndAnchorTier === 'Diamond Plus', 'Dedicated C&A tier must map.');
assert(ca.crownAndAnchorPointsFromApi === 660, 'Dedicated C&A points must map.');
assert(ca.crownAndAnchorRelationshipPointsFromApi === 660, 'Dedicated C&A relationship points must map.');
assert(hasAuthoritativeCrownAndAnchorData(ca), 'Dedicated C&A payload should be authoritative.');
assert(hasAuthoritativeLoyaltyField(ca, 'crownAndAnchorPoints'), 'Dedicated C&A points must be independently authoritative.');
assert(hasAuthoritativeLoyaltyField(ca, 'crownAndAnchorRelationshipPoints'), 'Dedicated C&A relationship points must be independently authoritative.');
const caPointsOnly = convertLoyaltyInfoToExtended({
  crownAndAnchorSocietyLoyaltyIndividualPoints: '661',
}, fixture.accountId, {
  sourceType: 'api',
  sourceUrl: 'https://www.royalcaribbean.com/api/guestaccounts/loyalty/info',
  accountId: fixture.accountId,
});
assert(caPointsOnly.crownAndAnchorPointsFromApi === 661, 'A dedicated C&A points-only payload must retain the point value.');
assert(hasAuthoritativeLoyaltyField(caPointsOnly, 'crownAndAnchorPoints'), 'A dedicated C&A points-only payload must mark the points field authoritative.');
assert(!hasAuthoritativeCrownAndAnchorData(caPointsOnly), 'A points-only payload must not falsely mark the whole C&A lane complete.');
const combined = mergeExtendedLoyaltyData(converted, ca);
const patch = buildDefinedLoyaltyStatePatch(combined);
assert(patch.clubRoyalePoints === '20941', 'State patch must include captured Club Royale points.');
assert(patch.clubRoyaleTier === 'Signature', 'State patch must include captured Club Royale tier.');
assert(patch.crownAndAnchorPoints === '660', 'State patch must include only dedicated C&A points.');
assert(patch.crownAndAnchorLevel === 'Diamond Plus', 'State patch must include dedicated C&A tier.');

console.log('PASS testV1242Build314ClubRoyaleLoyaltyCompleteness');
