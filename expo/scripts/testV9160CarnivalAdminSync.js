const fs = require('fs');
const path = require('path');
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
function assert(condition, message) { if (!condition) throw new Error(message); }

const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
assert(app.expo.version === '12.4.2', 'Expo app version must be 12.4.2');
assert(app.expo.ios.buildNumber === '311', 'iOS build number must be 311');
assert(app.expo.android.versionCode === 120402, 'Android versionCode must be 120402');
assert(pkg.version === '12.4.2', 'package version must be 12.4.2');

const carnivalScreen = read('app/carnival-sync.tsx');
assert(carnivalScreen.includes("import { useAuth } from '@/state/AuthProvider';"), 'Carnival screen must use AuthProvider');
assert(carnivalScreen.includes('Administrator access required'), 'Direct Carnival route must block non-admin users');
assert(carnivalScreen.includes('No Carnival browser or sync process has been started'), 'Admin gate must confirm no sync has started');
assert(carnivalScreen.includes('MAX_WEBVIEW_MESSAGE_SIZE'), 'Carnival WebView message size guard is missing');
assert(carnivalScreen.includes('onContentProcessDidTerminate'), 'iOS WebContent crash recovery is missing');
assert(carnivalScreen.includes('onRenderProcessGone'), 'Android WebView render-process recovery is missing');

const settings = read('app/(tabs)/settings.tsx');
assert(settings.includes('settings-admin-carnival-sync'), 'Admin-only Carnival Settings action is missing');
assert(settings.includes('{isAdmin && ('), 'Carnival Settings entry must be hidden from non-admin users');

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
for (const marker of [
  'v12.4.2-carnival-safe-isolated-sync active',
  'runCarnivalSafeIngestion',
  'await runCarnivalSafeIngestion();',
  'Carnival data is isolated from Royal Caribbean and Celebrity',
  'catalogVisibleOfferCodes',
  'catalogZeroRowOfferCodes',
  'carnivalLaneAuthorityRef',
  'CARNIVAL_PROFILE_OFFERS_URL',
  'CARNIVAL_CRUISES_URL',
  'CARNIVAL_PROFILE_URL',
]) assert(provider.includes(marker), `Provider missing Carnival safety marker: ${marker}`);

const safeSync = read('lib/carnival/carnivalSafeSync.ts');
for (const marker of [
  "url.searchParams.set('numadults', '2')",
  "url.searchParams.set('ratecodes', normalizeCode(rateCode))",
  "if (catalog.tgo) url.searchParams.set('tgo', catalog.tgo)",
  "if (catalog.vifp) url.searchParams.set('vifp', catalog.vifp)",
  'Carnival displayed price converted to total for 2 guests',
  "sourcePage: 'Completed'",
]) assert(safeSync.includes(marker), `Carnival safe-sync helper missing: ${marker}`);
assert(provider.includes('while (pageNumber <= 100)'), 'Mobile Carnival sync must paginate every offer page');

const syncLogic = read('lib/royalCaribbean/syncLogic.ts');
assert(syncLogic.includes("syncSource === 'carnival'"), 'Sync logic must support Carnival source isolation');
assert(syncLogic.includes("resolveCruiseSource(c) === 'carnival'"), 'Carnival cruises must be isolated during apply');
assert(syncLogic.includes('zeroRowOfferCodes'), 'Zero-row visible Carnival offers must be preserved safely');

const offersParser = read('lib/csv/offersParser.ts');
const bookedParser = read('lib/csv/bookedParser.ts');
for (const parser of [offersParser, bookedParser]) {
  assert(parser.includes("parsedSource === 'carnival' ? 'playersClub'"), 'Carnival CSV rows must be tagged Players Club');
  assert(parser.includes("return 'carnival'"), 'Carnival CSV rows must be tagged with Carnival source');
}

const manifest = JSON.parse(read('assets/easy-seas-extension/manifest.json'));
assert(manifest.version === '3.4.0', 'Embedded sync extension version must be 3.4.0');
assert(manifest.content_scripts[0].js.includes('carnival-sync.js'), 'Extension must load Carnival sync helper before content.js');
assert(manifest.host_permissions.includes('https://*.carnival.com/*'), 'Extension must have Carnival host permission');
const extensionCarnival = read('assets/easy-seas-extension/carnival-sync.js');
const extensionContent = read('assets/easy-seas-extension/content.js');
assert(extensionCarnival.includes("var VERSION = '12.4.2'"), 'Carnival extension helper must identify 12.4.2');
assert(extensionCarnival.includes("sourcePage: 'Carnival Cruise History'"), 'Extension must label Carnival completed history explicitly');
assert(extensionCarnival.includes('scrapeAllOffers'), 'Extension must enumerate all personalized Carnival offers');
assert(extensionCarnival.includes('MAX_PAGES_PER_OFFER = 100'), 'Extension must paginate Carnival offers');
assert(extensionContent.includes('Starting Carnival sync'), 'Extension Carnival orchestration is missing');
assert(extensionContent.includes('Discovered '), 'Extension must log discovered Carnival rate codes');
assert(extensionContent.includes('Carnival sync complete:'), 'Extension must emit final Carnival sync summary');

const userProvider = read('state/UserProvider.tsx');
for (const marker of ['carnivalVifpNumber', 'carnivalVifpTier', 'carnivalVifpPoints', 'carnivalPlayersClubTier', 'carnivalPlayersClubPoints']) {
  assert(userProvider.includes(marker), `User profile model/storage missing Carnival field: ${marker}`);
}

console.log('PASS testV9160CarnivalAdminSync');
