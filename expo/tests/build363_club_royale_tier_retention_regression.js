const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const app = JSON.parse(read('app.json')).expo;

assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);

const clubRoyale = loadTs('constants/clubRoyaleTiers.ts');
const reportedDate = new Date(2026, 7, 2, 12, 0, 0);

// Reported case: 23,963 current-cycle points are Prime pace, but Signature
// earned in the prior casino year remains the effective status through 4/1/27.
const retainedSignature = clubRoyale.resolveClubRoyaleStatus({
  currentSeasonPoints: 23963,
  confirmedTier: 'Signature',
  confirmedValidThrough: '04/01/2027',
  asOf: reportedDate,
});
assert.equal(retainedSignature.pointsTier, 'Prime');
assert.equal(retainedSignature.effectiveTier, 'Signature');
assert.equal(retainedSignature.validThrough, '2027-04-01');
assert.equal(retainedSignature.isProtected, true);

// A missing legacy validity date is migrated deterministically from the
// confirmation date instead of demoting the member from points alone.
assert.equal(
  clubRoyale.inferClubRoyaleTierValidThrough('Signature', 23963, reportedDate),
  '2027-04-01',
);
assert.equal(
  clubRoyale.resolveClubRoyaleStatus({
    currentSeasonPoints: 23963,
    confirmedTier: 'Signature',
    confirmedValidThrough: '2027-04-01',
    asOf: new Date(2027, 3, 1, 12, 0, 0),
  }).effectiveTier,
  'Signature',
);
assert.equal(
  clubRoyale.resolveClubRoyaleStatus({
    currentSeasonPoints: 23963,
    confirmedTier: 'Signature',
    confirmedValidThrough: '2027-04-01',
    asOf: new Date(2027, 3, 2, 12, 0, 0),
  }).effectiveTier,
  'Prime',
);

// A tier actually earned from this casino year's points is retained through
// the following full casino year; higher earned points always win.
assert.equal(
  clubRoyale.inferClubRoyaleTierValidThrough('Signature', 26000, reportedDate),
  '2028-04-01',
);
assert.equal(
  clubRoyale.resolveClubRoyaleStatus({
    currentSeasonPoints: 100001,
    confirmedTier: 'Signature',
    confirmedValidThrough: '2027-04-01',
    asOf: reportedDate,
  }).effectiveTier,
  'Masters',
);

const userProvider = read('state/UserProvider.tsx');
const loyaltyProvider = read('state/LoyaltyProvider.tsx');
const profileCard = read('components/ui/UserProfileCard.tsx');
const loyaltyCard = read('components/CompactDashboardHeader.tsx');
const settings = read('app/(tabs)/settings.tsx');
const offers = read('app/(tabs)/(overview)/index.tsx');
const royalSync = read('state/RoyalCaribbeanSyncProvider.tsx');

for (const marker of ['clubRoyaleTierValidThrough', 'clubRoyaleTierConfirmedAt']) {
  assert.ok(userProvider.includes(marker), `User profile persistence missing ${marker}`);
  assert.ok(settings.includes(marker), `Settings persistence missing ${marker}`);
}
assert.ok(loyaltyProvider.includes('resolveClubRoyaleStatus({'));
assert.ok(loyaltyProvider.includes('clubRoyaleTierIsProtected: resolvedClubRoyaleStatus.isProtected'));
assert.ok(profileCard.includes('Confirmed Club Royale Status'));
assert.ok(profileCard.includes('Status Retained Through'));
assert.ok(profileCard.includes('currentSeasonPoints: currentValues.clubRoyalePoints'));
assert.ok(!profileCard.includes('clubRoyaleTier: formClubRoyaleTier,'));
assert.ok(loyaltyCard.includes('clubRoyaleTierIsProtected && clubRoyaleTierValidThrough'));
assert.ok(loyaltyCard.includes('status retained through'));
assert.ok(offers.includes('effectiveClubRoyaleTier || clubRoyaleProfile?.tier'));
assert.ok(royalSync.includes('profileUpdates.clubRoyaleTierValidThrough = inferClubRoyaleTierValidThrough'));

console.log('PASS Build 366: Club Royale effective tier, April 1 retention, profile persistence, offers theme, and loyalty card are unified');
