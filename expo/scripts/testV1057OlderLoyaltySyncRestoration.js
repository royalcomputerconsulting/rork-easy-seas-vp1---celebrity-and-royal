const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
};

const converter = read('lib/royalCaribbean/loyaltyConverter.ts');
const syncProvider = read('state/RoyalCaribbeanSyncProvider.tsx');
const packageJson = JSON.parse(read('package.json'));
const appJson = JSON.parse(read('app.json'));

assert(converter.includes('findNumberNearText'), 'loyalty converter should include loose visible-text number parser');
assert(converter.includes('current\\s*tier\\s*credits'), 'converter should parse Club Royale current tier credits from visible/offers text');
assert(converter.includes('cruise\\s*points'), 'converter should parse Crown & Anchor cruise points from My Account text');
assert(converter.includes('findTierNearText(raw, [/club'), 'converter should parse Club Royale tier from nearby text');
assert(converter.includes('findTierNearText(raw, [/crown'), 'converter should parse Crown & Anchor tier from nearby text');

assert(syncProvider.includes('extendedLoyaltyDataRef'), 'sync provider should keep a synchronous extended loyalty ref');
assert(syncProvider.includes('mergeAndStoreExtendedLoyaltyData'), 'sync provider should merge captured loyalty synchronously');
assert(syncProvider.includes('hasProfileLoyaltyFields'), 'sync provider should detect profile loyalty fields');
assert(syncProvider.includes('Loyalty/history payload captured completed sailings only'), 'loyalty/history should not masquerade as profile loyalty totals');
assert(syncProvider.includes("providedExtendedLoyalty ?? extendedLoyaltyDataRef.current ?? extendedLoyaltyData"), 'Apply Sync should use the ref-backed captured loyalty payload');
assert(syncProvider.includes('not using it as Crown & Anchor profile totals') || syncProvider.includes('loyalty/info fallback'), 'sync should continue to profile loyalty fallback when only history is captured');

assert(packageJson.version === '9.11.48', 'package version should be 9.11.47');
assert(appJson.expo.version === '9.11.48', 'app version should be 9.11.47');
assert(appJson.expo.ios.buildNumber === '9.11.48', 'iOS buildNumber should be 9.11.47');
assert(appJson.expo.android.versionCode === 91148, 'Android versionCode should be 91148');

console.log('✅ v1057 older loyalty sync restoration checks passed');
