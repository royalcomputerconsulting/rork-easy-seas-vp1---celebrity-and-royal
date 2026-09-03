const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'lib', 'offers', 'offerValueNormalization.ts');
assert(fs.existsSync(sourcePath), 'Item 26 must provide one shared offer-value normalization engine');
const source = fs.readFileSync(sourcePath, 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const sandboxModule = { exports: {} };
vm.runInNewContext(`(function(module,exports,require){${output}\n})(module,module.exports,require)`, { module: sandboxModule, require, console });
const { normalizeOfferValue, rankComparableOfferValues } = sandboxModule.exports;

const offer = { id: 'o1', brand: 'royal', offerCode: '2609A04', freePlay: 200, obcAmount: 75, taxesFees: 180, requiredSpend: 50, travelCost: 300, redemptionProbability: 0.8, freePlayConversionRate: 0.7, obcUsabilityRate: 1, guests: 2, roomType: 'Balcony' };
const sailings = [
  { id: 's1', balconyPrice: 1000, nights: 7, guests: 2, cabinType: 'Balcony' },
  { id: 's2', balconyPrice: 1500, nights: 7, guests: 2, cabinType: 'Balcony' },
  { id: 's3', balconyPrice: 2000, nights: 7, guests: 2, cabinType: 'Balcony' },
];
const result = normalizeOfferValue(offer, sailings);
assert.strictEqual(result.eligibleSailingCount, 3);
assert.strictEqual(result.cabinRetailRange.median, 3000, 'Imported cabin prices are per-person; median room value must be used, never summed across sailings');
assert.strictEqual(result.faceValue.value, 3275);
assert.strictEqual(result.expectedValue.value, 2572, 'Expected value must apply explicit redemption and FreePlay conversion rates');
assert.strictEqual(result.personallyUsableValue.value, 2042, 'Personally usable value must subtract taxes, required spend, and travel cost');
assert(result.formula.some((line) => line.includes('not the sum of eligible sailings')));

const missing = normalizeOfferValue({ id: 'o2', brand: 'royal', offerCode: 'MISSING' }, []);
assert.strictEqual(missing.faceValue.value, null);
assert.strictEqual(missing.expectedValue.value, null);
assert.strictEqual(missing.personallyUsableValue.value, null);
assert(missing.missingInputs.includes('cabin retail value'));

const ranked = rankComparableOfferValues([
  result,
  normalizeOfferValue({ ...offer, id: 'o3', offerCode: 'OTHER', travelCost: 500 }, sailings),
  normalizeOfferValue({ ...offer, id: 'o4', brand: 'celebrity', offerCode: 'OTHER-BRAND' }, sailings),
]);
assert.strictEqual(ranked[0].comparableRank, 1);
assert.strictEqual(ranked[1].comparableRank, 2);
assert.strictEqual(ranked[2].comparableRank, 1, 'Different comparable scopes must be ranked separately');

const details = fs.readFileSync(path.join(root, 'app', 'offer-details.tsx'), 'utf8');
assert(details.includes('normalizeOfferValue'), 'Offer Details must consume the shared normalization engine');
assert(!details.includes('aggregateTotalValue += retailValueForCruise'), 'Offer Details must not add every eligible sailing into one fake offer value');
assert(details.includes('Face value') && details.includes('Expected value') && details.includes('Personally usable'));

console.log('Build 438 item 26 true offer value normalization regression passed');
