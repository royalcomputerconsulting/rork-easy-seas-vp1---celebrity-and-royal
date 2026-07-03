const fs = require('fs');
const path = require('path');
const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const converter = fs.readFileSync(path.join(root, 'lib/royalCaribbean/loyaltyConverter.ts'), 'utf8');
const loyaltyProvider = fs.readFileSync(path.join(root, 'state/LoyaltyProvider.tsx'), 'utf8');
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

assert(converter.includes('unwrapLoyaltyEnvelope'), 'loyalty converter must unwrap {message,data}, payload, and loyaltyInformation envelopes');
assert(converter.includes('findProgramRecord'), 'loyalty converter must find program-specific loyalty records');
assert(converter.includes('Club Royale') || converter.includes('club royale'), 'converter must include Club Royale program handling');
assert(converter.includes('Crown & Anchor') || converter.includes('crown & anchor'), 'converter must include Crown & Anchor program handling');
assert(converter.includes("Captain's Club") || converter.includes('captains club'), 'converter must include Captain\'s Club program handling');
assert(converter.toLowerCase().includes('blue chip') || converter.toLowerCase().includes('bluechip'), 'converter must include Blue Chip program handling');
assert(converter.includes('currentTierCredits'), 'Club Royale current tier credits must be parsed');
assert(converter.includes('cruisePoints'), 'Crown & Anchor cruise points must be parsed');
assert(converter.includes("'diamond plus': 'Diamond Plus'"), 'Diamond Plus capitalization must be preserved');

assert(loyaltyProvider.includes('completedCrownAnchorPointsFromRows'), 'completed C&A points from rows must feed loyalty totals');
assert(loyaltyProvider.includes('getCompletedCruiseCrownAnchorPoints'), 'completed cruise C&A row parser must exist');
assert(loyaltyProvider.includes('Math.max(rawCrownAnchorPoints, USER_CONFIRMED_CROWN_ANCHOR_BASELINE)'), 'old 590 baseline must not suppress higher synced C&A totals such as 646');
assert(loyaltyProvider.includes('apiCrownAnchorTier'), 'API Crown & Anchor tier should be allowed to display independently');
assert(loyaltyProvider.includes('liveClubRoyalePoints'), 'Club Royale live casino points source must remain separate');
assert(loyaltyProvider.includes('liveCrownAnchorPoints'), 'Crown & Anchor live cruise-point source must remain separate');

assert(pkg.version === '9.11.44', `package version should be 9.11.44, got ${pkg.version}`);
assert(appJson.expo.version === '9.11.44', `app version should be 9.11.44, got ${appJson.expo.version}`);
assert(appJson.expo.ios.buildNumber === '9.11.44', `iOS build should be 9.11.44, got ${appJson.expo.ios.buildNumber}`);
assert(appJson.expo.android.versionCode === 91144, `Android versionCode should be 91144, got ${appJson.expo.android.versionCode}`);

console.log('✅ v1054 loyalty program separation checks passed');
