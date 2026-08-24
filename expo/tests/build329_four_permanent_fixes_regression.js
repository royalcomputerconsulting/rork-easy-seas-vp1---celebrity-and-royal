const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// 1. View Offers must be the A/C certificate index/downloader, never the chat screen.
const overview = read('app/(tabs)/(overview)/index.tsx');
assert.ok(overview.includes("onViewOffersPress={() => router.push('/certificate-codes'"), 'View Offers must open certificate-codes');
assert.ok(!/onViewOffersPress[\s\S]{0,300}ask-(?:all-offers|my-data)/.test(overview), 'View Offers must not open a chat route');
const codes = read('app/certificate-codes.tsx');
assert.ok(codes.includes('Download All A/C'), 'certificate-codes must expose Download All A/C');
assert.ok(codes.includes("(['C', 'A'] as CertificateType[])"), 'certificate code UI must be A/C only');
assert.ok(!codes.includes("buildCertificateCatalog(monthCode, 'D')"), 'D marketing offers must not be treated as certificates');

// Ask All Offers is now part of Ask My Data, including old deep links.
assert.ok(read('app/ask-all-offers.tsx').includes("pathname: '/ask-my-data'"));
assert.ok(read('app/ask-all-offers-chat.tsx').includes("pathname: '/ask-my-data'"));
assert.ok(read('app/ask-my-data.tsx').includes('incomingQuery'));
assert.ok(overview.includes('>Ask My Data</Text>'), 'Offers dashboard must present the integrated assistant as Ask My Data');
assert.ok(!overview.includes('>Ask All Offers</Text>'), 'Ask All Offers must not remain a separate visible dashboard tool');
const askFile = path.join(root, 'lib/askAllOffers.ts');
const askCompiled = ts.transpileModule(fs.readFileSync(askFile, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: askFile,
}).outputText;
const askModule = new Module(askFile, module); askModule.filename = askFile; askModule.paths = Module._nodeModulePaths(path.dirname(askFile)); askModule._compile(askCompiled, askFile);
const offerAnswer = askModule.exports.buildAskAllOffersAnswer(
  'Show every active casino offer and eligible sailing with FreePlay, OBC and trade-in value',
  {
    offers: [{ id:'o1', title:'Offer', offerCode:'26ABC123', shipName:'Navigator of the Seas', sailingDate:'2026-08-01', freePlay:100 }],
    cruises:[], bookedCruises:[], certificates:[], calendarEvents:[], casinoSessions:[], weather:[], loyalty:{}
  }
);
assert.match(offerAnswer.content, /I found 1 active saved offer/);
assert.doesNotMatch(offerAnswer.content, /casino-session evidence/);

// 2. Examine Certificates must have its provider and a fail-safe no-op analytics callback.
const layout = read('app/_layout.tsx');
assert.ok(layout.includes('CasinoBenefitsProvider'));
assert.ok(/CertificatesProvider,[\s\S]{0,120}CasinoBenefitsProvider/.test(layout));
const lookup = read('app/certificate-lookup.tsx');
assert.ok(lookup.includes('casinoBenefits?.recordCertificateSearch ?? (() => undefined)'));
assert.ok(layout.includes('PersonalCertificateOptimizerProvider'));
assert.ok(layout.includes('PersonalOptimizationAlertsProvider'));
assert.ok(/CasinoBenefitsProvider,[\s\S]{0,160}PersonalCertificateOptimizerProvider,[\s\S]{0,160}PersonalOptimizationAlertsProvider/.test(layout));
assert.ok(codes.includes('personalOptimizer?.bundle ?? null'), 'certificate-codes must not crash if optimizer context is temporarily unavailable');
assert.ok(read('state/PersonalCertificateOptimizerProvider.tsx').includes('Failed to load optimization bundle'));
assert.ok(read('state/PersonalOptimizationAlertsProvider.tsx').includes('Failed to generate alerts'));

// 3. Royal sync: no obsolete API fetch, no navigation-prone anchor click, live payload capture.
const royalStep = read('lib/royalCaribbean/step1_offers.ts');
const auth = read('lib/royalCaribbean/authDetection.ts');
const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.ok(!royalStep.includes('/api/casino/casino-offers/v1'), 'retired Royal v1 endpoint must be absent');
assert.ok(!royalStep.includes('/api/casino/casino-offers/v2'), 'retired Royal v2 endpoint must be absent');
assert.ok(royalStep.includes("'/api/casino/v1/partners/player'"), 'current Royal partner endpoint is required');
assert.ok(royalStep.includes("'/api/casino/v2/offers/list'"), 'current Royal offers-list endpoint is required');
assert.ok(royalStep.includes("'/api/casino/v2/offers/details'"), 'current Royal offer-details endpoint is required');
assert.ok(royalStep.includes("headers['x-account-id']"), 'Royal current flow must send x-account-id');
assert.ok(royalStep.includes("headers['x-loyalty-id']"), 'Royal current flow must send x-loyalty-id');
assert.ok(royalStep.includes("getCookieValue('accessToken')"), 'Royal current flow must recover accessToken from the signed-in page cookie');
assert.ok(royalStep.includes("getCookieValue('VDS_ID')"), 'Royal current flow must recover VDS_ID from the signed-in page cookie');
assert.ok(royalStep.includes("getCookieValue('loyalty_ID')"), 'Royal current flow must recover loyalty_ID from the signed-in page cookie');
assert.ok(royalStep.includes("listParams.append('sortBy', 'offer.reserveByDate')"));
assert.ok(royalStep.includes("detailsParams.append('playerOfferId', playerOfferId)"));
assert.ok(royalStep.includes('Inspecting the live Royal page and captured website requests'));
assert.ok(royalStep.includes('fetchDocument(href)'));
assert.ok(royalStep.includes('Never click a navigation anchor'));
assert.ok(royalStep.includes('declaresDialog'));
assert.ok(auth.includes('captureRoyalOfferCandidate'));
assert.ok(auth.includes('offerCandidates'));
assert.ok(provider.includes('isCarnivalMode ? 180000 : 120000'));
assert.ok(provider.includes('STEP 1 INCOMPLETE'));
assert.ok(!provider.includes('All data extracted successfully - ready to sync to your app!'));
const extensionContent = read('assets/easy-seas-extension/content.js');
const legacyExtensionApi = read('assets/cext1/utils/apiClient.js');
assert.ok(extensionContent.includes('/api/casino/v1/partners/player'));
assert.ok(extensionContent.includes('/api/casino/v2/offers/list'));
assert.ok(extensionContent.includes('/api/casino/v2/offers/details'));
assert.ok(legacyExtensionApi.includes('/api/casino/v1/partners/player'));
assert.ok(legacyExtensionApi.includes('/api/casino/v2/offers/list'));
assert.ok(legacyExtensionApi.includes('/api/casino/v2/offers/details'));
assert.ok(!extensionContent.includes('/api/casino/casino-offers/v1'));
assert.ok(!extensionContent.includes('/api/casino/casino-offers/v2'));
assert.ok(!legacyExtensionApi.includes('/api/casino/casino-offers/v1'));
assert.ok(!legacyExtensionApi.includes('/api/casino/casino-offers/v2'));

// 4. Carnival: page-side bridge protection must execute before native crossing.
const carnivalScreen = read('app/carnival-sync.tsx');
const carnivalProvider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.ok(carnivalScreen.includes('const [webViewVisible, setWebViewVisible] = useState(true)'), 'Carnival WebView must open automatically');
assert.ok(carnivalScreen.includes('const handleOpenLogin = useCallback'), 'LOGIN must mount the protected browser before navigation');
assert.ok(carnivalScreen.includes('carnivalSyncAccess.enabled && webViewVisible'), 'sync cannot target an unmounted/stale WebView');
assert.ok(carnivalScreen.includes('webViewRef.current = ref'), 'WebView ref must clear on unmount');
assert.ok(carnivalScreen.includes('CARNIVAL_SAFE_BRIDGE_SCRIPT'));
assert.ok(carnivalScreen.includes('MAX_WEBVIEW_MESSAGE_SIZE = 60000'));
assert.ok(carnivalScreen.includes('bridgeMessageQueueRef'));
assert.ok(carnivalScreen.includes('drainBridgeMessageQueue'));
assert.ok(carnivalScreen.includes('bridgeMessageQueueRef.current.length >= MAX_BRIDGE_QUEUE_LENGTH'));
assert.ok(carnivalScreen.includes('onContentProcessDidTerminate'));
assert.ok(carnivalScreen.includes('onRenderProcessGone'));
assert.ok(carnivalScreen.includes('setSupportMultipleWindows={false}'));
assert.ok(carnivalProvider.includes("case 'bridge_payload_rejected'"));

const bridgeFile = path.join(root, 'lib/carnival/carnivalBridgeSafety.ts');
const bridgeCompiled = ts.transpileModule(fs.readFileSync(bridgeFile, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: bridgeFile,
}).outputText;
const bridgeModule = new Module(bridgeFile, module); bridgeModule.filename = bridgeFile; bridgeModule.paths = Module._nodeModulePaths(path.dirname(bridgeFile)); bridgeModule._compile(bridgeCompiled, bridgeFile);
const sent = [];
const sandbox = {
  window: { ReactNativeWebView: { postMessage: (value) => sent.push(value) } },
  JSON, Math, Object, Array, String, Number, Boolean, Date, RegExp,
};
vm.runInNewContext(bridgeModule.exports.CARNIVAL_SAFE_BRIDGE_SCRIPT, sandbox);
const hugeRows = Array.from({length: 30}, (_, i) => ({ id:i, name:'x'.repeat(10000) }));
sandbox.window.ReactNativeWebView.postMessage(JSON.stringify({ type:'offers_batch', data:hugeRows, isFinal:false }));
assert.ok(sent.length > 1, 'oversized Carnival rows must be split before the native bridge');
assert.ok(sent.every((message) => message.length <= 48000), 'every Carnival bridge message must stay under the page-side limit');

const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
assert.equal(app.expo.version, '13.0.44');
assert.equal(String(app.expo.ios.buildNumber), '410');
assert.equal(app.expo.android.versionCode, 130067);
assert.equal(pkg.version, '13.0.44');

require('./phase1_critical_sync_repairs_regression.js');

console.log('Build 334 four permanent fixes regression passed.');
