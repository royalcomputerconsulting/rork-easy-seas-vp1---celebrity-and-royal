const fs = require('fs');
const path = require('path');
function read(p){ return fs.readFileSync(path.join(process.cwd(), p), 'utf8'); }
function assert(c,m){ if(!c) throw new Error(m); }
const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
const step1 = read('lib/royalCaribbean/step1_offers.ts');
const syncLogic = read('lib/royalCaribbean/syncLogic.ts');
assert(app.expo.version === '12.4.2', 'app version must be 12.4.2');
assert(app.expo.ios.buildNumber === '311', 'iOS build must be 311');
assert(app.expo.android.versionCode === 120402, 'Android versionCode must be 120402');
assert(pkg.version === '12.4.2', 'package version must be 12.4.2');
assert(step1.includes('v12.3.3-dynamic-visible-offer-catalog'), 'Step 1 engine marker missing');
assert(step1.includes('retrying once from the live My Offers View Sailings button'), '0-row offer retry marker missing');
assert(step1.includes('Returning to live My Offers list'), 'Royal continuation must use live offer list path');
assert(step1.includes('preserving any existing rows for the missing offer code'), 'zero-row visible offer preserve log missing');
assert(syncLogic.includes('preserveUnmatchedManagedOfferCatalog'), 'apply sync must preserve unmatched Royal offer/catalog rows');
assert(syncLogic.includes('not a full authoritative catalog replacement'), 'preserve unmatched catalog log marker missing');
console.log('PASS testV1232RoyalOfferZeroRowPreservation');
