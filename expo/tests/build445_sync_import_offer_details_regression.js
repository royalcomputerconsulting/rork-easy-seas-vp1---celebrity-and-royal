const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const repository = read('lib/cruiseInventory/CruiseInventoryRepository.ts');
assert.match(repository, /withExclusiveTransactionAsync/);
assert.match(repository, /withSerializedTransaction\(db, async \(transaction\)/);
assert.match(repository, /relationship\.eligibility_key=\?/);
assert.match(repository, /inventory\.ship_name=\? AND inventory\.sail_date=\?/);

const settings = read('app/(tabs)/settings.tsx');
const reviewedBooked = settings.slice(settings.indexOf("title: `${sourceLabel} Booked Cruise Import Review`"), settings.indexOf('const handleImportCompletedCruisesXLSX'));
assert.equal((reviewedBooked.match(/setBookedCruises\(mergedBooked\)/g) || []).length, 1);
assert.equal((reviewedBooked.match(/setLocalData\(\{ booked: mergedBooked \}\)/g) || []).length, 0);
const completedReview = settings.slice(settings.indexOf("title: 'Completed Cruise Import Review'"), settings.indexOf('const handleExportBookedCSV'));
assert.equal((completedReview.match(/setBookedCruises\(merged\)/g) || []).length, 1);
assert.equal((completedReview.match(/setLocalData\(\{ booked: merged \}\)/g) || []).length, 0);

const syncProvider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert.match(syncProvider, /scrapePricingAndItinerary: true/);

const transformer = read('lib/royalCaribbean/dataTransformers.ts');
assert.match(transformer, /source: 'provider' as const/);
assert.match(transformer, /itinerary: providerItinerary/);
assert.match(transformer, /portsAndTimes/);

const payloadParser = read('lib/royalCaribbean/offerPayloadParser.ts');
for (const field of ['stateroomCategory', 'stateroomClass', 'awardType']) assert.match(payloadParser, new RegExp(field));

const details = read('app/(tabs)/(overview)/cruise-details.tsx');
assert.match(details, /getCruiseById\(id\)/);
assert.match(details, /getCruiseByIdentity/);
assert.match(details, /offerOptionId/);

const offerCard = read('components/CasinoOfferCard.tsx');
assert.match(offerCard, /resolveOfferPointRequirement/);
assert.match(offerCard, /resolveOfferCabinEntitlement/);
assert.match(offerCard, /resolveOfferGuestEntitlement/);
assert.match(offerCard, /representativeEstimatedValue/);
assert.match(offerCard, /Est\. stateroom value/);

const classifierSource = read('lib/offers/offerCodeClassifier.ts');
const compiled = ts.transpileModule(classifierSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleBox = { exports: {} };
new Function('module', 'exports', 'require', compiled)(moduleBox, moduleBox.exports, require);
const { classifyOfferCode } = moduleBox.exports;
assert.equal(classifyOfferCode('26TOR603').pointsRequired, 6500);
assert.equal(classifyOfferCode('26BAF305').pointsRequired, 2000);
assert.equal(classifyOfferCode('26OCT104').pointsRequired, 3000);
assert.equal(classifyOfferCode('2607C07').pointsRequired, 1200);

console.log('PASS Build 445 sync/import/detail/card release blockers regression');
