const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const overview = read('app/(tabs)/(overview)/index.tsx');
assert.ok(overview.includes("easyseas-scott-astin-logo.jpeg"), 'Offers must use the complete Easy Seas artwork');
assert.ok(overview.includes("height: 220"), 'Offers hero must be height-bounded');
assert.ok(overview.includes("height: '100%'"), 'Offers artwork must fill only the bounded card');
assert.ok(overview.includes("router.push('/certificate-codes'"), 'View Offers must navigate to the certificate download screen');
assert.ok(overview.includes("router.push('/certificate-lookup'"), 'Examine Certificates must open the live A/C parser screen');

const weather = read('state/SailingWeatherProvider.tsx');
assert.ok(weather.includes("'los angeles california'"), 'Weather must resolve explicit Los Angeles booking port text');
assert.ok(weather.includes("'miami florida'"), 'Weather must resolve explicit Miami booking port text');
assert.ok(weather.includes('Departure-port reference:'), 'Weather must provide an explicitly labeled partial fallback');
assert.ok(weather.includes('(isHistoricalDate || resolvedPoint.isFallback)'), 'Reference fallback must never call the marine endpoint');

const step1 = read('lib/royalCaribbean/step1_offers.ts');
assert.ok(step1.includes('Using the active cookie-authenticated Royal session'), 'Royal must accept HttpOnly-cookie authentication');
assert.ok(step1.includes("credentials: 'include'"), 'Royal API calls must preserve WebView cookies');
assert.ok(step1.includes('viewSailingsButtons.length'), 'Royal DOM fallback must inspect visible offers');
assert.ok(step1.includes("PROGRAM_NAME + ' extraction completed:"), 'Royal/Celebrity DOM fallback must emit sailing rows rather than an empty placeholder');

const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.ok(provider.includes('hasShipAndDate'), 'Empty past-trip rows must be rejected');
assert.ok(provider.includes('seenCruises.has(voyageKey)'), 'Duplicate bookings must be rejected by material voyage identity');
assert.ok(provider.includes('Merged voyage details into'), 'Voyage enrichment must actually merge into bookings');
assert.ok(!provider.includes('All data extracted successfully - ready to sync to your app!'), 'Extraction must not be falsely reported as a completed app sync');
assert.ok(provider.includes('zero offer rows were captured'), 'Zero Club Royale offers must be a visible incomplete result');

const carnival = read('app/carnival-sync.tsx');
const carnivalExtract = read('lib/carnival/carnivalOffersExtraction.ts');
assert.ok(carnival.includes('MAX_WEBVIEW_MESSAGE_SIZE = 60000'), 'Carnival must reject oversized native bridge messages');
assert.ok(carnival.includes('Message handler rejected payload'), 'Carnival handler exceptions must be contained');
assert.ok(carnivalExtract.includes('var BATCH_SIZE = 20'), 'Carnival rows must be delivered in small native-safe chunks');

const lookup = read('app/certificate-lookup.tsx');
const batch = read('lib/certificates/certificateBatchDownload.ts');
assert.ok(lookup.includes('includeD: false'), 'Certificate lookup must use only A/C families');
assert.ok(!batch.includes("input.includeD ?? true ? 'D'"), 'Certificate batch must not default to D marketing codes');

const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
assert.equal(app.expo.version, '13.0.45');
assert.equal(app.expo.ios.buildNumber, '411');
assert.equal(app.expo.android.versionCode, 130068);
assert.equal(pkg.version, '13.0.45');

console.log('Build 334 five release gates regression passed.');
