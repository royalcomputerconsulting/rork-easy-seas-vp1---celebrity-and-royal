const fs = require('fs');
const path = require('path');
const { root } = require('./clubRoyaleTestBootstrap');
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
const loyaltyProvider = read('state/LoyaltyProvider.tsx');
const profileCard = read('components/ui/UserProfileCard.tsx');
const settings = read('app/(tabs)/settings.tsx');
const converter = read('lib/royalCaribbean/loyaltyConverter.ts');

assert(provider.includes("hasAuthoritativeLoyaltyField(effectiveExtendedLoyalty, 'clubRoyalePoints')"), 'Primary Club Royale point writes must require field authority.');
assert(provider.includes("hasAuthoritativeLoyaltyField(effectiveExtendedLoyalty, 'crownAndAnchorPoints')"), 'Primary C&A point writes must require field authority.');
assert(provider.includes('const authoritativeClubRoyalePoints = effectiveExtendedLoyalty?.clubRoyalePointsFromApi;'), 'Apply Sync must use the captured Club Royale API value directly.');
assert(provider.includes('await loyaltyContext.setManualClubRoyalePoints(authoritativeClubRoyalePoints);'), 'Authoritative Club Royale points must update the primary loyalty store.');
assert(provider.includes('profileUpdates.clubRoyalePoints = syncedClubRoyalePoints;'), 'Authoritative Club Royale points must update the selected profile.');
assert(provider.includes('profileUpdates.clubRoyaleRelationshipPoints'), 'Club Royale relationship points must update the selected profile.');
assert(provider.includes('profileUpdates.clubRoyaleEvaluationPeriodStartDate'), 'Club Royale evaluation start date must update the selected profile.');
assert(provider.includes('profileUpdates.clubRoyaleEvaluationPeriodEndDate'), 'Club Royale evaluation end date must update the selected profile.');
assert(provider.includes('profileUpdates.crownAnchorRelationshipPoints'), 'Authoritative C&A relationship points must update the selected profile.');
assert(provider.includes('Loyalty/profile readback mismatch'), 'Selected profile writes must be verified from storage.');
assert(provider.includes('reported past=${royalReportedPastCount'), 'Completed-history logs must use the count reported by the current extraction.');
assert(!provider.includes("cruiseLine === 'royal_caribbean' ? 57"), 'No user-specific hard-coded completed-cruise count may control reconciliation.');
assert(!provider.includes("-completed-${shipName}-${sailDate"), 'Completed history must not synthesize a ship/date booking ID.');
assert(provider.includes('completedRow.bookingId = bookingId || buildUnconfirmedBookingIdentifier(completedRow);'), 'Reservation-free completed rows need deterministic non-authoritative identities.');


assert(loyaltyProvider.includes("hasAuthoritativeLoyaltyField(data, 'clubRoyaleId')"), 'Club Royale ID profile writes must require current-sync field authority.');
assert(loyaltyProvider.includes("hasAuthoritativeLoyaltyField(data, 'clubRoyaleTier')"), 'Club Royale tier profile writes must require current-sync field authority.');
assert(loyaltyProvider.includes("hasAuthoritativeLoyaltyField(data, 'clubRoyalePoints') && data.clubRoyalePointsFromApi !== undefined"), 'Club Royale point storage/profile writes must require current-sync field authority.');
assert(loyaltyProvider.includes("hasAuthoritativeLoyaltyField(data, 'clubRoyaleRelationshipPoints')"), 'Club Royale relationship-point writes must require field authority.');
assert(provider.includes("hasAuthoritativeLoyaltyField(effectiveExtendedLoyalty, 'clubRoyaleTier')"), 'Final selected-profile Club Royale tier writes must require field authority.');
assert(provider.includes("hasAuthoritativeLoyaltyField(effectiveExtendedLoyalty, 'clubRoyaleId')"), 'Final selected-profile Club Royale ID writes must require field authority.');
assert(loyaltyProvider.includes("hasAuthoritativeLoyaltyField(data, 'crownAndAnchorPoints')"), 'LoyaltyProvider must persist C&A points by field authority.');
assert(loyaltyProvider.includes("hasAuthoritativeLoyaltyField(data, 'crownAndAnchorTier')"), 'LoyaltyProvider must persist C&A tier by field authority.');
assert(loyaltyProvider.includes("hasAuthoritativeLoyaltyField(data, 'crownAndAnchorRelationshipPoints')"), 'LoyaltyProvider must persist C&A relationship points by field authority.');
assert(loyaltyProvider.includes('await syncUserProfilesFromStorage();'), 'Verified loyalty storage must rehydrate the UserProvider immediately.');
assert(loyaltyProvider.includes('State is committed only after every storage/profile readback succeeds.'), 'UI state must not commit before readback succeeds.');

assert(profileCard.includes('const displayedCrownAnchorLevel = currentValues.crownAnchorLevel || enrichmentData?.crownAndAnchorTier || calculatedLevel;'), 'The verified selected profile must outrank stale enrichment for C&A level display.');
assert(profileCard.includes("currentValues.crownAnchorNumber || enrichmentData?.crownAndAnchorId"), 'The verified selected profile must outrank stale enrichment for C&A number display.');
assert(profileCard.includes('currentValues.clubRoyaleTier || enrichmentData?.clubRoyaleTierFromApi || calculatedTier'), 'The verified selected profile must drive Club Royale tier display.');
assert(profileCard.includes('currentValues.clubRoyalePoints ?? enrichmentData?.clubRoyalePointsFromApi'), 'The verified selected profile, including an authoritative zero, must drive Club Royale points display.');

assert(settings.includes('Primary-profile loyalty is rendered from LoyaltyProvider because that provider commits only'), 'Settings must explain why verified LoyaltyProvider values drive the primary profile immediately after sync.');
assert(settings.includes('isPrimaryProfileSelected ? loyaltyClubRoyalePoints'), 'Primary Settings display must use verified Club Royale points from LoyaltyProvider.');
assert(settings.includes('isPrimaryProfileSelected ? loyaltyClubRoyaleTier'), 'Primary Settings display must use verified Club Royale tier from LoyaltyProvider.');
assert(settings.includes('isPrimaryProfileSelected ? loyaltyCrownAnchorPoints'), 'Primary Settings display must use verified C&A points from LoyaltyProvider.');
assert(settings.includes('isPrimaryProfileSelected ? loyaltyCrownAnchorLevel'), 'Primary Settings display must use verified C&A tier from LoyaltyProvider.');
assert(settings.includes('profileDisplayUser?.clubRoyalePoints'), 'Secondary profiles must retain profile-scoped Club Royale points.');
assert(settings.includes('profileDisplayUser?.loyaltyPoints'), 'Secondary profiles must retain profile-scoped C&A points.');
assert(converter.includes('export function hasAuthoritativeLoyaltyField'), 'Per-field loyalty authority helper must be available to every persistence layer.');


assert(!loyaltyProvider.includes('CONFIRMED_CLUB_ROYALE_2025_POINTS'), 'Settings loyalty must not be repopulated from a user-specific hardcoded Club Royale total.');
assert(!loyaltyProvider.includes('USER_CONFIRMED_CROWN_ANCHOR_BASELINE'), 'Settings loyalty must not invent a user-specific C&A balance when the C&A lane is absent.');
assert(provider.includes("hasAuthoritativeCrownAndAnchorData(extendedLoyaltyDataRef.current)"), 'Step 3 may skip the dedicated C&A fetch only after authoritative C&A tier and points are captured.');
assert(provider.includes('continuing to fetch dedicated loyalty/info'), 'A partial casino/history loyalty capture must keep the dedicated C&A fetch open.');


const requiredLoyaltyMarker = provider.indexOf('function capturedPayloadHasRequiredLoyalty');
assert(requiredLoyaltyMarker >= 0, 'Dedicated loyalty capture script is missing.');
const loyaltyScriptOpen = provider.lastIndexOf('webViewRef.current.injectJavaScript(`', requiredLoyaltyMarker);
const loyaltyScriptStart = loyaltyScriptOpen + 'webViewRef.current.injectJavaScript(`'.length;
const loyaltyScriptEnd = provider.indexOf('\n          `);', requiredLoyaltyMarker);
assert(loyaltyScriptOpen >= 0 && loyaltyScriptEnd > loyaltyScriptStart, 'Could not isolate dedicated loyalty capture script.');
const loyaltyScript = provider.slice(loyaltyScriptStart, loyaltyScriptEnd)
  .replace(/\$\{[^}]+\}/g, 'https://example.invalid/loyalty');
new Function(loyaltyScript);
assert(loyaltyScript.includes("void attemptManualFetch('Initial attempt')"), 'Dedicated C&A fetch must run immediately in the current authenticated page context.');
assert(!loyaltyScript.includes('window.location.href = next'), 'Dedicated C&A fetch must not navigate away and destroy its own retry timer.');
assert(loyaltyScript.includes('return hasCrownAnchorTier && hasCrownAnchorPoints'), 'Royal Step 3 must require both dedicated C&A tier and points before closing.');
assert(loyaltyScript.includes("credentials: 'include'"), 'Dedicated loyalty fetch must retain the authenticated web session.');

console.log('PASS testV1242Build314ClubRoyaleEndToEndStateUI');
