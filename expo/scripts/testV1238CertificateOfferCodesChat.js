const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const assert = (cond, msg) => { if (!cond) { console.error('FAIL testV1238CertificateOfferCodesChat:', msg); process.exit(1); } };

const appJson = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
assert(pkg.version === '12.4.4', 'package version must be 12.4.4');
assert(appJson.expo.version === '12.4.4', 'expo version must be 12.4.4');
assert(appJson.expo.ios.buildNumber === '319', 'ios build must be 319');
assert(appJson.expo.android.versionCode === 120410, 'android versionCode must be 120406');

const codesScreen = read('app/certificate-codes.tsx');
assert(codesScreen.includes('Certificate Codes'), 'Certificate Codes screen must exist');
assert(codesScreen.includes('Download All A/C/D'), 'Certificate Codes screen must include Download All A/C/D');
assert(codesScreen.includes('Examine Offers'), 'Certificate Codes screen must include Examine Offers');
assert(codesScreen.includes('AgentXChat'), 'Examine Offers must open an AgentX chat box');
assert(codesScreen.includes('certificateCodes: [entry.certificateCode]'), 'Tapping a code must download that specific code');
assert(codesScreen.includes('ROYAL_CERTIFICATE_BROAD_SHIP_QUERY'), 'Download All must use broad Royal ship query');
assert(codesScreen.includes('v12.4.4-dynamic-family-and-level-discovery') || read('lib/certificates/certificateCatalog.ts').includes('v12.4.4-dynamic-family-and-level-discovery'), 'runtime marker missing');

const overview = read('app/(tabs)/(overview)/index.tsx');
assert(overview.includes("router.push('/certificate-codes'"), 'View Offers must route to certificate-codes');
assert(overview.includes("router.push('/certificate-codes?chat=1'"), 'Examine Offers must route to certificate-codes chat');

const backend = read('backend/trpc/routes/certificate-explorer.ts');
assert(backend.includes('certificateCodes'), 'Backend examine input must support specific certificate codes');
assert(backend.includes('requestedCodeSet'), 'Backend must filter to requested certificate codes');
assert(backend.includes('v12.4.4-certificate-material-row-authority'), 'Backend truthful-status marker missing');
assert(backend.includes("status: sailings.length > 0 ? 'parsed' : 'parse_failed'"), 'Backend must not report zero-result parse as success');

const trpc = read('lib/trpc.ts');
assert(trpc.includes('effectiveMaxRetries'), 'Certificate tRPC requests need retry hardening');

console.log('PASS testV1238CertificateOfferCodesChat');
