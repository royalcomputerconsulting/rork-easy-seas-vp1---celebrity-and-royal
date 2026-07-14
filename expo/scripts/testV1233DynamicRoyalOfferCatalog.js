const fs = require('fs');
const path = require('path');
function read(p){ return fs.readFileSync(path.join(process.cwd(), p), 'utf8'); }
function assert(c,m){ if(!c) throw new Error(m); }
const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
const step1 = read('lib/royalCaribbean/step1_offers.ts');
const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
const syncLogic = read('lib/royalCaribbean/syncLogic.ts');
assert(app.expo.version === '12.4.2', 'app version must be 12.4.2');
assert(app.expo.ios.buildNumber === '311', 'iOS build must be 311');
assert(app.expo.android.versionCode === 120402, 'Android versionCode must be 120402');
assert(pkg.version === '12.4.2', 'package version must be 12.4.2');
assert(step1.includes('v12.3.3-dynamic-visible-offer-catalog'), 'dynamic offer engine marker missing');
assert(step1.includes('No offer-count or row-count thresholds here'), 'hard-coded count threshold removal marker missing');
assert(!step1.includes('MIN_ROWS_FOR_VISIBLE_ROYAL_FOUR_OFFER_SET'), '4-offer row threshold must not exist');
assert(!step1.includes('MIN_ROWS_FOR_KNOWN_MULTI_OFFER_SET'), 'known multi-offer row threshold must not exist');
assert(step1.includes('zero visible offers is a legitimate account state'), 'zero-offer account handling missing');
assert(step1.includes('catalogVisibleOfferCodes'), 'catalog metadata must travel on offer rows');
assert(provider.includes('step1CatalogMetaRef'), 'provider must store Step 1 dynamic catalog metadata');
assert(provider.includes('authoritativeEmptyOfferCatalog'), 'provider must support authoritative empty offer catalog');
assert(provider.includes('Dynamic offer catalog metadata for Apply Sync'), 'provider Apply Sync metadata log missing');
assert(syncLogic.includes('visibleOfferCodes?: string[]'), 'apply sync options must include visible offer codes');
assert(syncLogic.includes('dynamicFullVisibleCatalog'), 'dynamic full visible-catalog replacement logic missing');
assert(syncLogic.includes('dynamicPartialVisibleCatalog'), 'dynamic partial visible-catalog preservation logic missing');
assert(syncLogic.includes('authoritativeEmptyOfferCatalog'), 'empty catalog apply logic missing');
console.log('PASS testV1233DynamicRoyalOfferCatalog');
