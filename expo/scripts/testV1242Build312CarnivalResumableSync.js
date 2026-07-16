const fs = require('fs');
const path = require('path');
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
function assert(condition, message) { if (!condition) throw new Error(message); }

const app = JSON.parse(read('app.json'));
assert(app.expo.version === '12.4.2', 'Marketing version must remain 12.4.2');
assert(app.expo.ios.buildNumber === '314', 'iOS buildNumber must remain 314');
assert(app.expo.android.versionCode === 120405, 'Android versionCode must remain 120405');

const runtime = read('lib/carnival/carnivalSyncRuntime.ts');
for (const marker of [
  'CARNIVAL_SYNC_CHECKPOINT_TTL_MS',
  'last non-empty wins',
  'buildCarnivalCheckpointIdentity',
  'isCarnivalCheckpointCompatible',
  'isCarnivalCodeSkippable',
  'isCarnivalBookingCompleted',
  'normalizeCarnivalBookingClassification',
  'mergeCarnivalBookingRows',
]) assert(runtime.includes(marker), `Carnival runtime helper missing: ${marker}`);

const safeSync = read('lib/carnival/carnivalSafeSync.ts');
for (const marker of [
  'pageSize: number = 50',
  'carnivalSearchByContext',
  'payloadPagination',
  'payloadMatched',
  'authoritativeEmpty',
  'Run-scoped API data is primary',
  "sourcePage: 'Completed'",
]) assert(safeSync.includes(marker), `Carnival safe parser missing: ${marker}`);
assert(!safeSync.includes('effectivePageSize = resultCards.length'), 'Visible DOM card count must not be treated as server page size');

const auth = read('lib/royalCaribbean/authDetection.ts');
for (const marker of [
  'getCarnivalSearchContext',
  'captureCarnivalSearchPayload',
  '_easySeasCarnivalSearchContext',
  'carnivalSearchByContext',
  'payloads.push',
  'requestContext ? Object.assign({}, requestContext)',
]) assert(auth.includes(marker), `Network interceptor missing run-scoped capture: ${marker}`);

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
for (const marker of [
  'v12.4.2-build313-carnival-integrity-stage1 active',
  'let activeCarnivalRun',
  'new AbortController()',
  'CarnivalSyncCancelledError',
  'activeCarnivalRunIdRef',
  "CARNIVAL_CHECKPOINT_STORAGE_KEY = 'carnival_sync_checkpoint_v2'",
  'Resuming Carnival sync from account-bound checkpoint',
  'one short, run-scoped retry',
  'explicitlySelectedCodes',
  'mergeCatalogs([catalog, clickSnapshot, parseCarnivalPersonalizedUrl(entry.bookingLink)])',
  'Rejected stale Carnival payload',
  'catalogVisibleOfferCount',
  'catalogRowBearingOfferCodes',
  'catalogIncompleteOfferCodes',
  'account-bound resume checkpoint cleared after the full transaction committed',
  "status: terminalStatus === 'auth_lost' ? 'login_expired' : 'cancelled'",
]) assert(provider.includes(marker), `Provider missing approved repair: ${marker}`);
assert(!provider.includes('retrying the exact Shop Now offer with a longer render wait'), 'Legacy long retry loop must be removed');
assert(!provider.includes('await AsyncStorage.removeItem(checkpointKey);\n      addLog(\'🧹 Carnival resume checkpoint cleared after complete extraction'), 'Checkpoint must survive review until Apply Sync succeeds');

const syncScreen = read('app/carnival-sync.tsx');
assert(syncScreen.includes("cancelSync('iOS WebView content process terminated')"), 'iOS WebView termination must abort with an exact reason');
assert(syncScreen.includes("cancelSync('Android WebView render process exited')"), 'Android render-process termination must abort with an exact reason');
assert(syncScreen.includes("case 'cancelled'"), 'Cancelled/resumable status is not displayed');

const filterStrip = read('components/IntelligenceFilterStrip.tsx');
assert(filterStrip.includes("['all', 'royal', 'celebrity', 'silversea', 'carnival']"), 'Carnival must be selectable in the visible brand filter');
const header = read('components/CompactDashboardHeader.tsx');
for (const marker of ['dashboard-brand-all', 'Combined portfolio totals', 'noActiveSelection={isAllBrands}', 'carnival-offer-metrics', 'Personalized Offers', 'With Sailings', 'Eligible Sailings']) {
  assert(header.includes(marker), `Dashboard scope/metric repair missing: ${marker}`);
}

const models = read('types/models.ts');
const transformer = read('lib/royalCaribbean/dataTransformers.ts');
for (const marker of ['catalogVisibleOfferCodes', 'catalogVisibleOfferCount', 'catalogZeroRowOfferCodes', 'catalogRowBearingOfferCodes', 'eligibleSailingCount']) {
  assert(models.includes(marker), `CasinoOffer model missing catalog metric: ${marker}`);
  assert(transformer.includes(marker), `Offer transformer drops catalog metric: ${marker}`);
}

const overview = read('app/(tabs)/(overview)/index.tsx');
assert(overview.includes('const carnivalOfferMetrics = useMemo'), 'Overview must derive explicit Carnival catalog metrics');
assert(overview.includes('carnivalOfferMetrics={carnivalOfferMetrics}'), 'Overview must pass Carnival catalog metrics to the header');

require('child_process').execFileSync(process.execPath, [path.join(root, 'scripts/testV1242Build315CarnivalPriority4To8.js')], { stdio: 'inherit', cwd: root });

console.log('PASS testV1242Build312CarnivalResumableSync (carried forward in the Carnival-only rebuild)');
