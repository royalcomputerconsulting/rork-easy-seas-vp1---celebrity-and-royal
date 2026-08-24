const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { loadTs, root } = require('../scripts/clubRoyaleTestBootstrap');

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const sha256 = (relative) => crypto.createHash('sha256').update(read(relative)).digest('hex');
const app = JSON.parse(read('app.json')).expo;
assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);

assert.equal(sha256('app/_layout.tsx'), '8feada8a189883c07b6180c090b4f021d750f50e50c7c88c1ab750869a45775d');
assert.equal(sha256('app/(tabs)/_layout.tsx'), '8370c9a38f5c0a81c6ed420c2291f25fa804d1889a3fcc9a3d21f00e6ffbec6d');

const captain = loadTs('constants/celebrityCaptainsClub.ts');
const mappings = [
  ['Gold', 'Classic'],
  ['Platinum', 'Select'],
  ['Emerald', 'Select'],
  ['Diamond', 'Elite'],
  ['Diamond Plus', 'Elite Plus'],
  ['Pinnacle', 'Zenith'],
  ['Pinnacle Club', 'Zenith'],
];
for (const [royalLevel, celebrityLevel] of mappings) {
  assert.equal(captain.getCelebrityStatusMatchForCrownAnchor(royalLevel), celebrityLevel);
}

const pinnacleWith1150 = captain.getCelebrityCaptainsClubStatus(1150, 'Pinnacle');
assert.equal(pinnacleWith1150.earnedLevel, 'Elite Plus');
assert.equal(pinnacleWith1150.statusMatchLevel, 'Zenith');
assert.equal(pinnacleWith1150.effectiveLevel, 'Zenith');
assert.equal(pinnacleWith1150.isStatusMatched, true);
assert.equal(captain.getEffectiveCelebrityCaptainsClubLevel(1150, null), 'Elite Plus');

// Never downgrade a genuinely earned/reported Celebrity tier because the Royal
// match is lower.
assert.equal(captain.getEffectiveCelebrityCaptainsClubLevel(3000, 'Gold'), 'Zenith');
assert.equal(captain.getEffectiveCelebrityCaptainsClubLevel(0, 'Gold', 'Elite Plus'), 'Elite Plus');

const loyaltyProvider = read('state/LoyaltyProvider.tsx');
const profileCard = read('components/ui/UserProfileCard.tsx');
const header = read('components/CompactDashboardHeader.tsx');
const booked = read('app/(tabs)/booked.tsx');
const warRoom = read('app/war-room.tsx');
assert.ok(loyaltyProvider.includes('getCelebrityCaptainsClubStatus('));
assert.ok(loyaltyProvider.includes('tier: captainStatus.effectiveLevel'));
assert.ok(loyaltyProvider.includes('earnedTier: captainStatus.earnedLevel'));
assert.ok(profileCard.includes("renderValueCard('Status Match'"));
assert.ok(profileCard.includes("renderValueCard('Earned from Club Points'"));
assert.ok(profileCard.includes('savedCelebrityStatus.effectiveLevel'));
assert.ok(header.includes('STATUS MATCH'));
assert.ok(header.includes('Effective tier: ${celebrityLevel}. Earned tier: ${celebrityEarnedLevel}'));
assert.ok(booked.includes('getEffectiveCelebrityCaptainsClubLevel('));
assert.ok(warRoom.includes('getEffectiveCelebrityCaptainsClubLevel('));
assert.ok(!header.includes('hasRoyalPinnacleReciprocity'));

console.log('PASS Build 357 complete Royal-to-Celebrity status match and earned-versus-effective tier regression');
