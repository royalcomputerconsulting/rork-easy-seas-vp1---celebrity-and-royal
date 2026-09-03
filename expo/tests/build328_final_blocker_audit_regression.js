const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
let localPathIndex = null;

function resolveLocalImport(sourceFile, request) {
  const base = request.startsWith('@/')
    ? path.join(root, request.slice(2))
    : path.resolve(path.dirname(sourceFile), request);
  const candidates = [
    base,
    `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}.json`,
    path.join(base, 'index.ts'), path.join(base, 'index.tsx'),
    path.join(base, 'index.js'), path.join(base, 'index.jsx'),
  ];
  return candidates.some((candidate) => localPathIndex?.has(candidate) || (!candidate.startsWith(`${root}${path.sep}`) && fs.existsSync(candidate)));
}

function walk(directory, visitor) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', '.git', '.expo', 'outputs', '__MACOSX'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, visitor);
    else visitor(full);
  }
}

// 1. Version/build chain.
const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
assert.equal(app.expo.version, '13.0.44');
assert.equal(String(app.expo.ios.buildNumber), '410');
assert.equal(app.expo.android.versionCode, 130067);
assert.equal(pkg.version, '13.0.44');
assert.ok(read('app.config.js').includes("APP_STORE_VERSION = '13.0.44'"));
assert.ok(!read('app.config.js').includes('IOS_BUILD_NUMBER'));
assert.ok(!read('app.config.js').includes('ANDROID_VERSION_CODE'));
assert.ok(read('plugins/withForcedIOSVersion.js').includes("APP_STORE_VERSION = '13.0.44'"));
assert.ok(!read('plugins/withForcedIOSVersion.js').includes('IOS_BUILD_NUMBER'));
assert.ok(!read('plugins/withForcedIOSVersion.js').includes('modResults.CFBundleVersion'));
assert.ok(!read('plugins/withForcedIOSVersion.js').includes('CURRENT_PROJECT_VERSION ='));
assert.equal(JSON.parse(read('eas.json')).cli.appVersionSource, 'remote');
assert.equal(JSON.parse(read('eas.json')).build.production.autoIncrement, true);
assert.ok(read('lib/appVersion.ts').includes("EASYSEAS_APP_VERSION = '13.0.44'"));
assert.ok(read('lib/appVersion.ts').includes("EASYSEAS_IOS_BUILD_NUMBER = '410'"));
assert.ok(read('lib/appVersion.ts').includes('EASYSEAS_ANDROID_VERSION_CODE = 130067'));
assert.ok(read('scripts/verifyIpaVersion.py').includes('EXPECTED_VERSION = "13.0.44"'));
assert.ok(read('scripts/verifyIpaVersion.py').includes('EXPECTED_MIN_BUILD = 410'));
assert.ok(pkg.scripts['verify:source-release'].includes('runMaintainedReleaseTests.js'));
for (const command of pkg.scripts['verify:source-release'].split('&&')) {
  const match = command.match(/\bnode\s+([^\s]+)/);
  if (match) assert.ok(exists(match[1]), `Source-release verifier references missing file: ${match[1]}`);
}

// 2. Startup cannot hang forever on storage bootstrap.
const rootLayout = read('app/_layout.tsx');
const storageRecovery = read('lib/storage/storageRecovery.ts');
assert.ok(storageRecovery.includes('STORAGE_OPERATION_TIMEOUT_MS = 1500'));
assert.ok(storageRecovery.includes('Promise.race'));
assert.ok(storageRecovery.includes('non-destructive healthcheck'));
assert.ok(!storageRecovery.includes('AsyncStorage.clear('));
assert.ok(!storageRecovery.includes('multiRemove('));
assert.ok(rootLayout.includes('ensureStorageHealthy()'));
assert.ok(rootLayout.includes('recoverIncompleteSyncTransaction()'));
assert.ok(!rootLayout.includes('testID="storage-retry-button"'));
assert.ok(!rootLayout.includes('Retry startup'));

// 3. Required visual assets and Offers routes/actions.
for (const asset of [
  app.expo.icon,
  app.expo.splash.image,
  app.expo.android.adaptiveIcon.foregroundImage,
  './assets/images/easyseas-scott-astin-logo.jpeg',
]) {
  assert.ok(exists(asset), `Required asset missing: ${asset}`);
}
const overview = read('app/(tabs)/(overview)/index.tsx');
assert.ok(overview.includes("easyseas-scott-astin-logo.jpeg"));
assert.ok(overview.includes('height: 220'));
assert.ok(overview.includes("router.push('/certificate-codes'"));
assert.ok(overview.includes("router.push('/certificate-lookup'"));

// 4. Weather resolution and no fabricated sea state.
const weather = read('state/SailingWeatherProvider.tsx');
assert.ok(weather.includes("'los angeles california'"));
assert.ok(weather.includes("'miami florida'"));
assert.ok(weather.includes('Departure-port reference:'));
assert.ok(weather.includes('(isHistoricalDate || resolvedPoint.isFallback)'));
assert.ok(weather.includes("const marineDataStatus: SailingWeatherForecast['metrics']['marineDataStatus']"));
assert.ok(weather.includes("? 'verified'"));
assert.ok(weather.includes("? 'pending' : 'unavailable'"));

// 5. Royal sync must be truthful and preserve valid WebView cookie auth.
const royalOffers = read('lib/royalCaribbean/step1_offers.ts');
const royalProvider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.ok(royalOffers.includes('Using the active cookie-authenticated Royal session'));
assert.ok(royalOffers.includes("credentials: 'include'"));
assert.ok(royalOffers.includes("PROGRAM_NAME + ' extraction completed:"));
assert.ok(royalProvider.includes('hasShipAndDate'));
assert.ok(royalProvider.includes('seenCruises.has(voyageKey)'));
assert.ok(royalProvider.includes('Merged voyage details into'));
assert.ok(!royalProvider.includes('All data extracted successfully - ready to sync to your app!'));
assert.ok(royalProvider.includes('zero offer rows were captured'));

// 6. Carnival native bridge crash containment.
const carnivalScreen = read('app/carnival-sync.tsx');
const carnivalExtract = read('lib/carnival/carnivalOffersExtraction.ts');
assert.ok(carnivalScreen.includes('MAX_WEBVIEW_MESSAGE_SIZE = 60000'));
assert.ok(carnivalScreen.includes('Message handler rejected payload'));
assert.ok(carnivalScreen.includes('<ErrorBoundary>'));
assert.ok(carnivalExtract.includes('var BATCH_SIZE = 20'));

// 7. Certificate parser: A/C only and robust object-anchored PDF stream parsing.
const pipeline = read('lib/certificates/certificatePdfPipeline.ts');
const batch = read('lib/certificates/certificateBatchDownload.ts');
const lookup = read('app/certificate-lookup.tsx');
assert.ok(pipeline.includes("CERTIFICATE_FAMILY_CODES = new Set(['A', 'C'])"));
assert.ok(pipeline.includes('const objectHeaderPattern = /\\b\\d+\\s+\\d+\\s+obj'));
assert.ok(pipeline.includes("dictionary.includes('/FlateDecode')"));
assert.ok(pipeline.includes('if (printableRatio < 0.75) return;'));
assert.ok(pipeline.includes('parsePdfUnicodeMap(stream)'));
assert.ok(pipeline.includes('extractTextFromPdfContentStream(stream, unicodeMaps)'));
assert.ok(lookup.includes('includeD: false'));
assert.ok(!batch.includes("input.includeD ?? true ? 'D'"));


const directDeviceEngine = read('lib/certificates/clientCertificatePdfEngine.ts');
assert.match(directDeviceEngine, /import \{ extractCertificatePdfText, parseCertificateExtractedTextOnDevice \} from '@\/lib\/certificates\/certificatePdfPipeline'/);
assert.match(directDeviceEngine, /shared-device-pdf-completeness-recovery/);
assert.match(directDeviceEngine, /retained the more complete verified result/);
assert.ok(directDeviceEngine.includes('return extractCertificatePdfText(pdfBytes);'));
assert.ok(!directDeviceEngine.includes('const streamRegex = /(<<[\\s\\S]*?>>)'));

// 8. Runtime local imports resolve.
const sourceRoots = ['app', 'components', 'state', 'lib', 'hooks', 'constants', 'backend'];
localPathIndex = new Set();
walk(root, (file) => localPathIndex.add(file));
const missingImports = [];
const sourceCache = new Map();
for (const sourceRoot of sourceRoots) {
  walk(path.join(root, sourceRoot), (file) => {
    if (!/\.(?:ts|tsx|js|jsx)$/.test(file)) return;
    const source = fs.readFileSync(file, 'utf8');
    sourceCache.set(file, source);
    const patterns = [
      /\bfrom\s+['"]([^'"]+)['"]/g,
      /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
      /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const request = match[1];
        if (!(request.startsWith('@/') || request.startsWith('./') || request.startsWith('../'))) continue;
        if (!resolveLocalImport(file, request)) {
          missingImports.push(`${path.relative(root, file)} -> ${request}`);
        }
      }
    }
  });
}
assert.deepEqual(missingImports, [], `Missing local imports:\n${missingImports.join('\n')}`);

// 9. Static Expo Router destinations resolve, including route-group aliases.
const routeSet = new Set(['/']);
walk(path.join(root, 'app'), (file) => {
  if (!/\.(?:ts|tsx|js|jsx)$/.test(file)) return;
  let rel = path.relative(path.join(root, 'app'), file).replace(/\\/g, '/').replace(/\.(?:ts|tsx|js|jsx)$/, '');
  const raw = `/${rel}`.replace(/\/index$/, '') || '/';
  const withoutGroups = `/${rel.split('/').filter((part) => !/^\(.+\)$/.test(part)).join('/')}`.replace(/\/index$/, '') || '/';
  routeSet.add(raw);
  routeSet.add(withoutGroups);
});
const missingRoutes = [];
for (const sourceRoot of ['app', 'components']) {
  walk(path.join(root, sourceRoot), (file) => {
    if (!/\.(?:ts|tsx|js|jsx)$/.test(file)) return;
    const source = sourceCache.get(file) ?? fs.readFileSync(file, 'utf8');
    const routePatterns = [
      /\b(?:router\.)?(?:push|replace|navigate)\(\s*['"]([^'"]+)['"]/g,
      /\bhref\s*=\s*['"]([^'"]+)['"]/g,
      /\bpathname\s*:\s*['"]([^'"]+)['"]/g,
    ];
    for (const pattern of routePatterns) {
      for (const match of source.matchAll(pattern)) {
        let route = match[1];
        if (!route.startsWith('/') || route.includes('${') || route.startsWith('//')) continue;
        route = route.split('?')[0].replace(/\/+$/, '') || '/';
        if (routeSet.has(route)) continue;
        const dynamicMatch = [...routeSet].some((known) => {
          const regex = new RegExp(`^${known.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\[\\\.\\\.\\\.[^\]]+\\\]/g, '.+').replace(/\\\[[^\]]+\\\]/g, '[^/]+')}$`);
          return regex.test(route);
        });
        if (!dynamicMatch) missingRoutes.push(`${path.relative(root, file)} -> ${route}`);
      }
    }
  });
}
assert.deepEqual([...new Set(missingRoutes)], [], `Missing routes:\n${[...new Set(missingRoutes)].join('\n')}`);


// 10. Backend authority must remain the stable Build 319 RORK backend.
// The legacy Render host returns a bare 404 and must never be reintroduced.
const trpcSource = read('lib/trpc.ts');
assert.ok(trpcSource.includes('EXPO_PUBLIC_RORK_API_BASE_URL'));
assert.ok(trpcSource.includes('BACKEND_API_ROOT_URL'));
assert.ok(!trpcSource.includes('const DEFAULT_RENDER_URL'));
assert.ok(!trpcSource.includes('process.env.EXPO_PUBLIC_RENDER_BACKEND_URL'));
assert.ok(read('app/import-cruises.tsx').includes('BACKEND_BASE_URL'));
assert.ok(read('app/(tabs)/settings.tsx').includes('BACKEND_BASE_URL'));
assert.ok(!read('app/import-cruises.tsx').includes('RENDER_BACKEND_URL'));
assert.ok(!read('app/(tabs)/settings.tsx').includes('RENDER_BACKEND_URL'));

console.log('Build 334 final blocker audit regression passed.');
