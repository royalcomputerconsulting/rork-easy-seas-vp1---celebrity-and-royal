const fs = require('fs');
const path = require('path');
function read(p){ return fs.readFileSync(path.join(process.cwd(), p), 'utf8'); }
function assert(c,m){ if(!c) throw new Error(m); }
const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
const route = read('backend/trpc/routes/certificate-explorer.ts');
const trpc = read('lib/trpc.ts');
assert(app.expo.version === '12.4.2', 'app version must be 12.4.2');
assert(app.expo.ios.buildNumber === '314', 'iOS build must be 314');
assert(app.expo.android.versionCode === 120405, 'Android versionCode must be 120405');
assert(pkg.version === '12.4.2', 'package version must be 12.4.2');
assert(route.includes('v12.3.8-certificate-offer-catalog-chat'), 'certificate route must include v12.3.7 marker');
assert(route.includes('DEFAULT_CERTIFICATE_POINTS'), 'certificate route must have default points ladder');
assert(route.includes('PDF_TEXT_CACHE_TTL_MS'), 'certificate route must cache PDF text');
assert(route.includes('getDefaultPointsForCertificate'), 'certificate route must assign default points per level');
assert(route.includes('mapWithConcurrency<IndexEntry, SailingEntry[]>(allIndexEntries, 5'), 'certificate route must scan PDFs with safe concurrency');
assert(route.includes('catalog = allIndexEntries.map'), 'certificate route must return A/C catalog metadata even when no matches are found');
assert(route.includes('pdfTextCache.set(url'), 'certificate route must cache successful and 404/empty downloads');
assert(route.includes('entry.points = detectedPoints ?? entry.points ?? getDefaultPointsForCertificate'), 'certificate route must preserve parsed or default points');
assert(trpc.includes('getRequestTimeoutMs'), 'trpc client must use dynamic timeout');
assert(trpc.includes('180_000'), 'certificate scans must have long timeout to prevent JSON parse truncation');
assert(trpc.includes('empty or non-JSON response'), 'trpc client must guard empty certificate responses before JSON.parse');
console.log('PASS testV1237CertificateBankRobustDownload');
