const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = (message) => {
  console.error(`PHASE 3 RELEASE CANDIDATE CHECK FAILED: ${message}`);
  process.exit(1);
};

const status = JSON.parse(read('PHASE3_RELEASE_GATE_STATUS.json'));
if (status.release?.version !== '12.4.19') fail('release-gate version is not 12.4.19');
if (String(status.release?.iosBuild) !== '339') fail('release-gate iOS build is not 333');
if (status.release?.androidVersionCode !== 120425) fail('release-gate Android version code is not 120425');
if (status.release?.bundleIdentifier !== 'app.rork.easy-seas-vp1-celebrity-and-royal') fail('bundle identifier changed');
for (const key of ['versionAuthorities', 'phase1CriticalSync', 'phase2CertificatesLogo']) {
  if (status.automatedValidation?.[key] !== 'pass') fail(`automated release-gate status is not pass: ${key}`);
}
for (const key of ['maintainedRegression', 'typescriptSyntax', 'archiveSourceIntegrity']) {
  if (!['pass', 'pending'].includes(status.automatedValidation?.[key])) fail(`automated release-gate status is invalid: ${key}`);
}
if (status.testFlightValidation?.status !== 'pending-physical-device') fail('TestFlight gate must remain pending until physical-device evidence is supplied');
if (status.productionSubmissionAllowed !== false) fail('production submission must be blocked before TestFlight evidence');

const carnival = read('app/carnival-sync.tsx');
if (!carnival.includes('getSafeRemoteWebViewUrl')) fail('Carnival WebView does not use the remote-source safety boundary');
if (!carnival.includes('source={{ uri: safeWebViewUrl }}')) fail('Carnival WebView source is not the validated remote URL');
for (const forbidden of ['allowingReadAccessToURL', 'allowFileAccessFromFileURLs', 'allowUniversalAccessFromFileURLs', 'about:blank', "source={{ uri: webViewUrl }}"]) {
  if (carnival.includes(forbidden)) fail(`Carnival WebView contains forbidden native-crash marker: ${forbidden}`);
}
const webViewSafety = read('lib/webViewSourceSafety.ts');
if (!webViewSafety.includes("parsed.protocol === 'https:' || parsed.protocol === 'http:'")) fail('WebView safety boundary does not restrict sources to HTTP(S)');
if (!webViewSafety.includes('parsed.hostname.trim().length > 0')) fail('WebView safety boundary does not require a host');

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
if (!provider.includes('const normalizedRows = normalizedOffers.length + normalizedBookedCruises.length;')) fail('Royal final-sync normalizedRows repair is missing');
if (!provider.includes('parseRoyalLoyaltyHistorySailings')) fail('Royal loyalty-history completed-cruise parser is not wired');
const bookingNormalization = read('lib/royalCaribbean/bookingNormalization.ts');
if (!bookingNormalization.includes('parseRoyalLoyaltyHistorySailings')) fail('Royal history parser implementation is missing');

const clientCertificate = read('lib/certificates/clientCertificatePdfEngine.ts');
const documentStore = read('lib/certificates/certificateDocumentStore.ts');
const binaryTransport = read('lib/certificates/certificateBinaryTransport.ts');
const certificatePipeline = read('lib/certificates/certificatePdfPipeline.ts');
if (!clientCertificate.includes('archiveCertificatePdfBytes')) fail('certificate client does not call the archive implementation');
if (!documentStore.includes('export async function archiveCertificatePdfBytes')) fail('certificate archive function is not exported');
if (!certificatePipeline.includes('isPdfSignature') || !certificatePipeline.includes("parseStatus: 'pdf_corrupt'")) fail('certificate pipeline does not verify and reject an invalid PDF signature');
if (!binaryTransport.includes('expo-file-system/legacy')) fail('certificate native binary transport is not pinned to the compatible Expo filesystem API');

for (const relative of ['components/EasySeasHero.tsx', 'app/(tabs)/(overview)/index.tsx']) {
  if (!read(relative).includes('resizeMode="cover"')) fail(`logo fill repair is missing from ${relative}`);
}

const nativeTemplate = JSON.parse(read('native-validation-evidence.template.json'));
if (nativeTemplate.release?.version !== '12.4.19' || String(nativeTemplate.release?.iosBuild) !== '339') fail('native evidence template has stale release identity');
if (nativeTemplate.ios?.carnivalNoNativeCrash !== false) fail('native evidence template must not claim unperformed validation');

console.log('PASS Phase 3 release candidate: source repairs, release identity, safety gates, and truthful native-validation block verified.');
