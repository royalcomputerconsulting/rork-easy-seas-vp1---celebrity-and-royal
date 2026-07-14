const fs = require('fs');
const path = require('path');
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
function assert(condition, message) { if (!condition) throw new Error(message); }
const appJson = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
assert(appJson.expo.version === '12.4.2', 'app.json expo.version must be 12.4.2');
assert(appJson.expo.ios.buildNumber === '311', 'iOS buildNumber must be 311');
assert(appJson.expo.android.versionCode === 120402, 'Android versionCode must be 120402');
assert(pkg.version === '12.4.2', 'package.json version must be 12.4.2');
const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert(provider.includes('hasMeaningfulExtendedLoyaltyData'), 'Provider must validate meaningful loyalty values.');
assert(provider.includes('isHistoryOnlyLoyaltyPayload'), 'Provider must detect loyalty/history-only payloads.');
assert(provider.includes('keeping loyalty capture open'), 'History-only loyalty payload must not close loyalty capture.');
assert(provider.includes('capturedPayloadHasTierOrPoints'), 'Direct loyalty fallback must ignore stale captured payloads without tier/points.');
assert(provider.includes('Existing captured loyalty payload has no tier/point values yet'), 'Fallback must continue after non-loyalty payloads.');
assert(provider.includes('Ignored extended loyalty payload because it did not contain tier or point values'), 'Extended loyalty handler must ignore empty payloads.');
const converter = read('lib/royalCaribbean/loyaltyConverter.ts');
for (const marker of ['currentTierCredits', 'tierCreditBalance', 'currentClubTier', 'currentTier', 'cruisePoints', 'cruiseCredits']) {
  assert(converter.includes(marker), `Converter missing Royal loyalty alias: ${marker}`);
}
assert(!converter.includes("'loyaltyTier',\n    'tierName'"), 'Generic tier aliases must not be mapped to Crown & Anchor.');
console.log('PASS testV1230LoyaltySyncRepair');
