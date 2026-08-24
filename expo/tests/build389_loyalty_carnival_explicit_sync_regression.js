const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const captain = loadTs('constants/celebrityCaptainsClub.ts');
const blueChip = loadTs('constants/celebrityBlueChipClub.ts');
const crownAnchor = loadTs('constants/crownAnchor.ts');

for (const [points, tier] of [
  [0, 'Pearl'], [1, 'Pearl'], [2499, 'Pearl'], [2500, 'Onyx'],
  [24999, 'Onyx'], [25000, 'Amethyst'], [99999, 'Amethyst'],
  [100000, 'Sapphire'], [499999, 'Sapphire'], [500000, 'Sapphire Plus'],
  [999999, 'Sapphire Plus'], [1000000, 'Ruby'],
]) assert.equal(blueChip.getCelebrityBlueChipTierByPoints(points), tier);

const retainedRuby = blueChip.getCelebrityBlueChipStatus(100000, 'Ruby');
assert.equal(retainedRuby.earnedTier, 'Sapphire');
assert.equal(retainedRuby.effectiveTier, 'Ruby');
assert.equal(retainedRuby.isReportedTierRetained, true);
assert.deepEqual(blueChip.getCelebrityBlueChipProgress(2500, 'Onyx'), {
  nextTier: 'Amethyst', pointsToNext: 22500, percentComplete: 0,
});

for (const [points, tier] of [
  [0, 'Preview'], [2, 'Classic'], [149, 'Classic'], [150, 'Select'],
  [300, 'Elite'], [750, 'Elite Plus'], [3000, 'Zenith'],
]) assert.equal(captain.getCelebrityCaptainsClubLevelByPoints(points), tier);
assert.equal(captain.getCelebrityCaptainsClubStatus(1150, 'Pinnacle').effectiveLevel, 'Zenith');

assert.equal(crownAnchor.CROWN_ANCHOR_LEVELS.Gold.cruiseNights, 3);
assert.equal(crownAnchor.getLevelByNights(699), 'Diamond Plus');
assert.equal(crownAnchor.getLevelByNights(700), 'Pinnacle');

const loyalty = read('state/LoyaltyProvider.tsx');
const profile = read('state/UserProvider.tsx');
const header = read('components/CompactDashboardHeader.tsx');
assert.ok(loyalty.includes('await updateUser(currentUser.id, allUpdates)'));
assert.ok(loyalty.includes('celebrityCaptainsClubTier = mergedData.captainsClubTier.trim()'));
assert.ok(profile.includes('celebrityCaptainsClubTier?: string'));
assert.ok(header.includes('const celebrityTier = blueChip.tier'));
assert.ok(header.includes('Pinnacle Reached:'));

const screen = read('app/carnival-sync.tsx');
const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.ok(screen.includes('Logged In — Ready to Sync'));
assert.ok(screen.includes('Press SYNC NOW once when you are ready'));
assert.ok(screen.includes('testID="carnival-run-ingestion-button"'));
assert.ok(screen.includes('All Carnival pages are verified. Saving the complete result to Easy Seas now...'));
assert.ok(screen.includes('const showConfirmation = false'));
assert.ok(!screen.includes('autoSyncStartedForLoginRef'));
assert.ok(!screen.includes('setInterval(attemptStart'));
assert.ok(provider.includes('const CARNIVAL_SEARCH_PAGE_SIZE = 200'));
assert.ok(provider.includes('if (pagesVisited === 0)'));
assert.ok(provider.includes('unique dated sailing(s)'));
assert.ok(provider.includes('expectedItineraryGroups'));

const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);
assert.equal(pkg.version, '13.0.44');

console.log('PASS Build 389 loyalty thresholds, live profile propagation, and explicit bounded Carnival sync');
