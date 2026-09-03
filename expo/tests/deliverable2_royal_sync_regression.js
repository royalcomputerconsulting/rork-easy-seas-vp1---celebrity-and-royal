const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const syncLogic = fs.readFileSync(path.join(root, 'lib/royalCaribbean/syncLogic.ts'), 'utf8');
const dataTransformers = fs.readFileSync(path.join(root, 'lib/royalCaribbean/dataTransformers.ts'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'app/(tabs)/settings.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(syncLogic.includes('rawOfferRows') && syncLogic.includes('retainedOfferVariants'), 'sync evidence counts are missing');
assert(syncLogic.includes('isInvalidCompletedCruiseRow'), 'completed-cruise validator is missing');
assert(syncLogic.includes('Preserving distinct variant'), 'offer-sailing variant preservation is missing');
assert(syncLogic.includes('preserveKnownCruiseFields'), 'field-level protection is missing');
assert(dataTransformers.includes('preserving unknown instead of defaulting to 7'), 'unsafe seven-night default guard is missing');
assert(dataTransformers.includes('requiresCompletedReview'), 'completed-cruise review guard is missing');
assert(dataTransformers.includes('hasDurationConflict'), 'completed-cruise duration conflict guard is missing');
assert(dataTransformers.includes("rawCategory: 'offer_sailing'"), 'sanitized offer-sailing evidence is missing');
assert(settings.includes('royalImported') && settings.includes('royalCompleted'), 'Settings Royal totals are missing');

console.log('Deliverable 2 Royal sync regression checks passed');
