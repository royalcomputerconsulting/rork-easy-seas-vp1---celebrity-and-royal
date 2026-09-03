const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const sha256 = (relative) => crypto.createHash('sha256').update(read(relative)).digest('hex');

const app = JSON.parse(read('app.json')).expo;
assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);

// The Build 339 root provider/navigation structure must not move for this fix.
assert.equal(sha256('app/_layout.tsx'), '8feada8a189883c07b6180c090b4f021d750f50e50c7c88c1ab750869a45775d');
assert.equal(sha256('app/(tabs)/_layout.tsx'), '8370c9a38f5c0a81c6ed420c2291f25fa804d1889a3fcc9a3d21f00e6ffbec6d');

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
const screen = read('app/royal-caribbean-sync.tsx');
const authSource = read('lib/royalCaribbean/authDetection.ts');
const monitorSource = read('lib/royalCaribbean/networkMonitorScript.ts');
const offersSource = read('lib/royalCaribbean/step1_offers.ts');

// Execute the actual cruise-line loyalty guard/scoper in isolation. A Royal-only
// shared-account response must not complete or contaminate Celebrity loyalty.
const functionsStart = provider.indexOf('function hasLoyaltyForCruiseLine');
const functionsEnd = provider.indexOf('\nconst INITIAL_STATE', functionsStart);
assert.ok(functionsStart >= 0 && functionsEnd > functionsStart, 'Cruise-line loyalty guard is not locatable');
const loyaltyHarnessSource = `${provider.slice(functionsStart, functionsEnd)}\nmodule.exports = { hasLoyaltyForCruiseLine, scopeLoyaltyForCruiseLine };`;
const loyaltyHarnessJs = ts.transpileModule(loyaltyHarnessSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  fileName: 'loyaltyHarness.ts',
}).outputText;
const loyaltyModule = { exports: {} };
new Function('module', 'exports', 'require', 'hasMeaningfulExtendedLoyaltyData', loyaltyHarnessJs)(
  loyaltyModule,
  loyaltyModule.exports,
  require,
  () => true,
);
const { hasLoyaltyForCruiseLine, scopeLoyaltyForCruiseLine } = loyaltyModule.exports;
const royalOnly = {
  crownAndAnchorTier: 'Pinnacle Club',
  crownAndAnchorPointsFromApi: 688,
  clubRoyaleTierFromApi: 'Signature',
  clubRoyalePointsFromApi: 22149,
};
assert.equal(hasLoyaltyForCruiseLine(royalOnly, 'celebrity'), false);
assert.equal(scopeLoyaltyForCruiseLine(royalOnly, 'celebrity'), null);

const mixedSharedAccount = {
  ...royalOnly,
  captainsClubId: 'CC-1150',
  captainsClubTier: 'Zenith',
  captainsClubPoints: 1150,
  celebrityBlueChipTier: 'Sapphire',
  celebrityBlueChipPoints: 2500,
};
const celebrityOnly = scopeLoyaltyForCruiseLine(mixedSharedAccount, 'celebrity');
assert.equal(hasLoyaltyForCruiseLine(mixedSharedAccount, 'celebrity'), true);
assert.equal(celebrityOnly.captainsClubTier, 'Zenith');
assert.equal(celebrityOnly.captainsClubPoints, 1150);
assert.equal(celebrityOnly.celebrityBlueChipTier, 'Sapphire');
assert.equal(celebrityOnly.crownAndAnchorTier, undefined);
assert.equal(celebrityOnly.clubRoyaleTierFromApi, undefined);
assert.ok(provider.includes("if (syncSource === 'royal' && isPrimarySyncTarget && preview.loyalty)"));
assert.ok(provider.includes("another brand's loyalty fields; continuing to wait"));
assert.ok(provider.includes("config.loyaltyClubName.toUpperCase()"));

// Celebrity UI must use Captain's Club labels and can fall back to the selected
// local profile's 1,150 points when the website exposes only reciprocal Royal data.
assert.ok(screen.includes("loyalty.captainsClub.tier || extendedLoyaltyData?.captainsClubTier"));
assert.ok(screen.includes('syncProfiles.effectiveProfile?.celebrityCaptainsClubPoints'));
assert.ok(screen.includes("<Text style={styles.successLoyaltyText}>{\"Captain's Club:\"}</Text>"));
assert.ok(screen.includes("!isCelebrity && (extendedLoyaltyData?.clubRoyaleTierFromApi"));
assert.ok(screen.includes("!isCelebrity && (extendedLoyaltyData?.crownAndAnchorTier"));

// Back closes the browser/sync work first, then changes routes on the next frame.
const leaveStart = screen.indexOf('const handleLeaveScreen = useCallback');
const leaveEnd = screen.indexOf('\n  const onMessage', leaveStart);
const leaveHandler = screen.slice(leaveStart, leaveEnd);
assert.ok(leaveStart >= 0 && leaveEnd > leaveStart, 'Custom sync-screen exit handler is not locatable');
assert.ok(leaveHandler.includes('webViewRef.current?.stopLoading()'));
assert.ok(leaveHandler.includes('setWebViewVisible(false)'));
assert.ok(leaveHandler.includes('cancelSync()'));
assert.ok(leaveHandler.includes('setTimeout(() =>'));
assert.ok(leaveHandler.indexOf('stopLoading()') < leaveHandler.indexOf('setWebViewVisible(false)'));
assert.ok(leaveHandler.indexOf('setWebViewVisible(false)') < leaveHandler.indexOf('router.back()'));
assert.ok(screen.includes('testID="royal-celebrity-sync-back-button"'));
assert.ok(screen.includes('headerBackVisible: false'));
assert.ok(screen.includes('gestureEnabled: false'));
assert.equal((screen.match(/Animated\.loop\(/g) || []).length, 1);
assert.ok(screen.includes('activeLoop?.stop()'));
assert.ok(provider.includes("throw new Error(isCarnivalMode ? 'CARNIVAL_SYNC_CANCELLED' : 'SYNC_SCREEN_CLOSED')"));
assert.ok(provider.includes('Object.values(stepCompleteResolvers.current).forEach((resolve) => resolve())'));

function loadStandaloneTs(relative) {
  const compiled = ts.transpileModule(read(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: relative,
  }).outputText;
  const loaded = { exports: {} };
  const standaloneRequire = (specifier) => specifier === '@/lib/carnival/carnivalInventoryRuntime'
    ? loadStandaloneTs('lib/carnival/carnivalInventoryRuntime.ts')
    : require(specifier);
  new Function('module', 'exports', 'require', compiled)(loaded, loaded.exports, standaloneRequire);
  return loaded.exports;
}

const { AUTH_DETECTION_SCRIPT } = loadStandaloneTs('lib/royalCaribbean/authDetection.ts');
const { NETWORK_MONITOR_SCRIPT } = loadStandaloneTs('lib/royalCaribbean/networkMonitorScript.ts');
const { STEP1_OFFERS_SCRIPT, injectOffersExtraction } = loadStandaloneTs('lib/royalCaribbean/step1_offers.ts');
for (const script of [AUTH_DETECTION_SCRIPT, NETWORK_MONITOR_SCRIPT, STEP1_OFFERS_SCRIPT, injectOffersExtraction(true)]) {
  new Function(script);
}
assert.ok(authSource.includes("normalizedUrl.includes('celebritycruises.com')"));
assert.ok(authSource.includes("normalizedUrl.includes('/i18n/') || normalizedUrl.includes('/translations/')"));
assert.ok(monitorSource.includes("loyaltyUrl.includes('celebritycruises.com') || loyaltyUrl.includes('/celebrity/')"));
assert.ok(offersSource.includes("const PROGRAM_NAME = IS_CELEBRITY ? 'Blue Chip Club' : 'Club Royale'"));
assert.ok(offersSource.includes("PROGRAM_NAME + ' offers list'"));

console.log('PASS Build 356 Celebrity labels, brand-scoped loyalty, cancellable back navigation, and embedded-browser syntax regression');
