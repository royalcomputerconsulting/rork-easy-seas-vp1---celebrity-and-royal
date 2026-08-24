const fs = require('fs');
const path = require('path');
function read(p){ return fs.readFileSync(path.join(process.cwd(), p), 'utf8'); }
function assert(c,m){ if(!c) throw new Error(m); }
const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
const route = read('backend/trpc/routes/certificate-explorer.ts');
const trpc = read('lib/trpc.ts');
const direct = read('lib/certificates/clientCertificatePdfEngine.ts');
assert(app.expo.version === '12.4.4', 'app version must be 12.4.4');
assert(app.expo.ios.buildNumber === '319', 'iOS build must be 319');
assert(app.expo.android.versionCode === 120410, 'Android versionCode must be 120410');
assert(pkg.version === '12.4.4', 'package version must be 12.4.4');
assert(route.includes('v12.4.4-certificate-material-row-authority'), 'certificate route must include current architecture marker');
assert(route.includes('coreGetDefaultPointsForCertificate'), 'certificate route must use the shared points ladder');
assert(route.includes('discoverCertificateCodesFromText'), 'certificate route must discover monthly codes dynamically');
assert(route.includes('PDF_TEXT_CACHE_TTL_MS'), 'certificate route must cache PDF text');
assert(route.includes('getDefaultPointsForCertificate'), 'certificate route must assign default points per level');
assert(route.includes('mapWithConcurrency<IndexEntry, SailingEntry[]>(allIndexEntries, 5'), 'certificate route must scan PDFs with safe concurrency');
assert(route.includes('MUTATION_TIME_BUDGET_MS = 45_000'), 'backend must return bounded valid JSON before host timeout');
assert(route.includes("status: sailings.length > 0 ? 'parsed' : 'parse_failed'"), 'zero-result backend parses must be explicit failures');
assert(route.includes("header !== '%PDF-'"), 'backend must validate actual PDF content');
assert(direct.includes('v2.0.0-shared-material-row-authority-and-evidence'), 'direct-device fallback marker missing');
assert(direct.includes("header !== '%PDF-'"), 'direct-device parser must validate actual PDF content');
assert(trpc.includes('getRequestTimeoutMs'), 'trpc client must use dynamic timeout');
assert(trpc.includes('60_000'), 'certificate scans must have a bounded client timeout');
assert(trpc.includes('empty or non-JSON response'), 'trpc client must guard empty certificate responses before JSON.parse');
console.log('PASS testV1237CertificateBankRobustDownload');
