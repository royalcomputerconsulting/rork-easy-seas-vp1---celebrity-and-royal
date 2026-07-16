const fs = require('fs');
const path = require('path');
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
function assert(condition, message) { if (!condition) throw new Error(message); }
const appJson = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
assert(appJson.expo.version === '12.4.2', 'app.json expo.version must be 12.4.2');
assert(appJson.expo.ios.buildNumber === '314', 'iOS buildNumber must be 314');
assert(appJson.expo.android.versionCode === 120405, 'Android versionCode must be 120405');
assert(pkg.version === '12.4.2', 'package.json version must be 12.4.2');
const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert(provider.includes('hasMeaningfulExtendedLoyaltyData'), 'Provider must validate meaningful loyalty values.');
assert(provider.includes('isHistoryOnlyLoyaltyPayload'), 'Provider must detect loyalty/history-only payloads.');
assert(provider.includes('keeping loyalty capture open'), 'History-only loyalty payload must not close loyalty capture.');
assert(provider.includes('capturedPayloadHasRequiredLoyalty'), 'Direct loyalty fallback must ignore stale/partial captured payloads without the required tier and points.');
assert(provider.includes('Existing loyalty payload is partial (casino/history only); continuing to fetch dedicated loyalty/info'), 'Fallback must continue after casino-only or history-only payloads.');
assert(provider.includes('Extended loyalty payload contained no usable fields; preserving prior values'), 'Extended loyalty handler must preserve prior values when a payload is empty.');
const converter = read('lib/royalCaribbean/loyaltyConverter.ts');
for (const marker of ['currentTierCredits', 'tierCreditBalance', 'currentClubTier', 'currentTier', 'cruisePoints', 'cruiseCredits']) {
  assert(converter.includes(marker), `Converter missing Royal loyalty alias: ${marker}`);
}
assert(!converter.includes("'loyaltyTier',\n    'tierName'"), 'Generic tier aliases must not be mapped to Crown & Anchor.');
console.log('PASS testV1230LoyaltySyncRepair');
