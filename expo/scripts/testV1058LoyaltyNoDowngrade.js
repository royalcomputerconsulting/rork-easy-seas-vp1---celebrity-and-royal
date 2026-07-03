#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const must = (condition, message) => {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
};

const provider = read('state/LoyaltyProvider.tsx');
const sync = read('state/RoyalCaribbeanSyncProvider.tsx');
const syncLogic = read('lib/royalCaribbean/syncLogic.ts');
const converter = read('lib/royalCaribbean/loyaltyConverter.ts');
const profileCard = read('components/ui/UserProfileCard.tsx');
const monitor = read('lib/royalCaribbean/networkMonitorScript.ts');
const pkg = JSON.parse(read('package.json'));
const app = JSON.parse(read('app.json'));

must(pkg.version === '9.11.48', 'package version should be 9.11.48');
must(app.expo.version === '9.11.48', 'app version should be 9.11.48');
must(app.expo.ios.buildNumber === '9.11.48', 'iOS buildNumber should be 9.11.48');
must(app.expo.android.versionCode === 91148, 'Android versionCode should be 91148');

must(provider.includes('profileClubRoyalePoints'), 'LoyaltyProvider should include profile Club Royale points as an authoritative candidate');
must(!provider.includes('const profileCrownAnchorPoints = typeof currentUser?.loyaltyPoints === \'number\' ? currentUser.loyaltyPoints : 0;\n    const profileCrownAnchorPoints'), 'LoyaltyProvider should not have duplicate profileCrownAnchorPoints declarations');
must(provider.includes('royalUpdates.clubRoyalePoints = mergedData.clubRoyalePointsFromApi'), 'Extended loyalty sync should update the user profile Club Royale points');
must(provider.includes('royalUpdates.loyaltyPoints = mergedData.crownAndAnchorPointsFromApi'), 'Extended loyalty sync should update the user profile Crown & Anchor points');

must(sync.includes("isHistoryOnlyPayload") && sync.includes("not using it as Crown & Anchor profile totals"), 'loyalty/history must be completed history only, not profile totals');
must(syncLogic.includes('rawSyncedClubRoyalePoints') && syncLogic.includes('Math.max(currentLoyalty.clubRoyalePoints'), 'sync preview should prevent Club Royale downgrades');
must(sync.includes('const rawLoyalty = ((msg as any).loyalty ?? (msg as any).data)'), 'loyalty_data handler should process DOM fallback data payloads');
must(sync.includes('mergeAndStoreExtendedLoyaltyData(converted)'), 'DOM/API loyalty data should merge into extended loyalty state');

must(converter.includes("key === 'clubRoyalePointsFromApi'") && converter.includes('incomingNum < existingNum'), 'converter should preserve higher Club Royale/C&A values when merging');
must(converter.includes('clubRoyaleLoyaltyIndividualPoints') && converter.includes('currentTierCredits'), 'converter should parse older and current Club Royale point field names');

must(profileCard.includes('Math.max(') && profileCard.includes('formData.clubRoyalePoints'), 'Profile card should not let stale enrichment suppress manually entered Club Royale points');
must(profileCard.includes('formDisplayClubRoyaleTier'), 'Profile edit modal should preserve explicit Club Royale tier display');
must(profileCard.includes('clubRoyaleTier: enrichmentData?.clubRoyaleTierFromApi || formData.clubRoyaleTier'), 'Profile save should preserve API/manual tier instead of deriving Prime from 19,363 points');

must(monitor.includes('__easySeasVisibleText'), 'Network monitor should include visible page text for loyalty fallback parsing');
must(monitor.includes('api/casino/v1/loyalty-data'), 'Network monitor should capture Club Royale loyalty endpoint');
must(monitor.includes('guestAccounts/loyalty/info') && monitor.includes('guestAccounts/loyalty/history'), 'Network monitor should observe both C&A profile and history endpoints');

console.log('✅ v1058 loyalty no-downgrade checks passed');
