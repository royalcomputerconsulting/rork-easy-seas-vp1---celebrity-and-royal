const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const loyalty = read('state/LoyaltyProvider.tsx');
const settings = read('app/(tabs)/settings.tsx');
const sync = read('state/RoyalCaribbeanSyncProvider.tsx');
const header = read('components/CompactDashboardHeader.tsx');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(sync.includes("profileUpdates.clubRoyalePoints = syncedClubRoyalePoints"), 'Royal sync must publish Club Royale points to the selected user profile');
assert(sync.includes("profileUpdates.celebrityBlueChipPoints = effectiveExtendedLoyalty.celebrityBlueChipPoints"), 'Celebrity sync must publish Blue Chip points to the selected profile');
assert(sync.includes("profileUpdates.celebrityCaptainsClubPoints = effectiveExtendedLoyalty.captainsClubPoints"), 'Celebrity sync must publish Captain\'s Club points to the selected profile');
assert(sync.includes("coreDataContext.setCasinoOffers(finalOffers"), 'Individual synchronized offers must be committed to CoreData');
assert(sync.includes("coreDataContext.refreshData()"), 'Successful sync must republish committed offers to Settings and Offers subscribers');

assert(loyalty.includes('Published synced Club Royale points'), 'Provider sync must publish points into live loyalty state');
assert(!loyalty.includes('await setManualClubRoyalePoints(mergedData.clubRoyalePointsFromApi)'), 'Provider sync must not masquerade as a manual edit');
assert(loyalty.includes('hasProfileProviderSync'), 'A secondary profile provider snapshot must outrank initialized zero storage');
assert(loyalty.includes('typeof syncedCaptainPoints'), 'Captain\'s Club must use the newest synchronized snapshot instead of Math.max');

assert(settings.includes('? (captainsClub?.points ?? profileDisplayUser?.celebrityCaptainsClubPoints ?? 0)'), 'Settings must display canonical Captain\'s Club points');
assert(settings.includes('? (blueChip?.points ?? profileDisplayUser?.celebrityBlueChipPoints ?? 0)'), 'Settings must display canonical Blue Chip points');
assert(header.includes('clubRoyaleCurrentYearPoints') && header.includes('captainsClub') && header.includes('blueChip'), 'The loyalty cruise card must subscribe to the canonical LoyaltyProvider');

console.log('Build 434 loyalty sync publication regression passed');
