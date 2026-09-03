const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function compileTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const output = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(output, filename);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

const classifier = compileTs('lib/offers/offerCodeClassifier.ts');
assert.equal(classifier.classifyOfferCode('2609A04').pointsRequired, 3000, 'instant-certificate points must be shown from the canonical ladder');
assert.equal(classifier.classifyOfferCode('2609A08').pointsRequired, 800);

const values = compileTs('lib/offers/offerValueNormalization.ts', { '@/types/models': {} });
const normalized = values.normalizeOfferValue(
  { id: 'offer', offerCode: '2609A04', roomType: 'Balcony', guests: 2, freePlay: 100, obcAmount: 75 },
  [
    { id: 'one', balconyPrice: 500, nights: 7, guests: 2 },
    { id: 'two', balconyPrice: 1000, nights: 7, guests: 2 },
    { id: 'three', balconyPrice: 1500, nights: 7, guests: 2 },
  ],
);
assert.equal(normalized.faceValue.value, 2175, 'offer value must use one median room entitlement plus benefits');
assert.notEqual(normalized.faceValue.value, 6175, 'eligible alternatives must never be added into a fake total value');
assert.match(normalized.faceValue.explanation, /not the sum of eligible sailings/i);

const overview = read('app/(tabs)/(overview)/index.tsx');
const loyalty = overview.indexOf('<CompactDashboardHeader');
const overviewCard = overview.indexOf('<OfferSummaryCard');
const urgent = overview.indexOf('{renderCommandCenter()}');
const filters = overview.indexOf('<IntelligenceFilterStrip', urgent);
const active = overview.indexOf('title="Active offers"');
assert(loyalty > -1 && overviewCard > loyalty && urgent > overviewCard && filters > urgent && active > filters,
  'Offers header must render loyalty, overview, urgent decisions, filters, then active offers in that order');

const certificates = overview.indexOf('title="Casino & Certificates"');
const recent = overview.indexOf('title="Recent activity"');
const agentSea = overview.indexOf('testID="dashboard-ask-my-data"', recent);
const learning = overview.indexOf('testID="dashboard-learn-system"', agentSea);
assert(certificates > active && recent > certificates && agentSea > recent && learning > agentSea,
  'Offers footer must render certificates, recent activity, then Agent SEA/learning');

for (const action of ['command-center-view', 'command-center-decode', 'command-center-compare', 'command-center-archive', 'command-center-skip']) {
  assert(overview.includes(`testID="${action}"`), `preserve ${action}`);
}
assert.match(overview, /buildOfferDetailsParams\([^\n]+\{ expectedCruiseCount/, 'card and command-center routes must validate their displayed exact count through the shared route builder');
assert.match(overview, /queryOfferSailings\(\{ \.\.\.query, limit: 1 \}\)/, 'offer counts must come from the indexed offer-sailing repository');
assert.match(overview, /normalizeOfferValue/, 'overview values and highest-value sorting must use the truth-preserving value engine');
assert.doesNotMatch(overview, /totalValue \+= cruiseTotalValue/, 'overview must not sum all alternative sailings into offer value');

const card = read('components/CasinoOfferCard.tsx');
for (const fact of ['Points level', 'Guests', 'Stateroom', 'Estimated value']) assert(card.includes(fact), `offer card must show ${fact}`);
for (const testId of ['casino-offer-card.why-score', 'casino-offer-card.score-evidence', 'casino-offer-card.provenance', 'casino-offer-card.view-all-cruises', 'casino-offer-card.decode-offer']) {
  assert(card.includes(`testID="${testId}"`), `offer card must preserve ${testId}`);
}
assert.match(card, /accessibilityState=\{\{ expanded: showScoreEvidence \}\}/, 'score evidence must expose progressive-disclosure state');
assert.match(card, /normalizeOfferValue/, 'each offer card must use the same normalized value truth as details and overview');

const details = read('app/offer-details.tsx');
assert.match(details, /while \(!cancelled && cursor && collectedRows\.length < targetRows\)/, 'offer drilldown must page toward the exact displayed count');
assert.match(details, /getOfferSailingRowKey/, 'offer drilldown must preserve each offer-sailing row');
assert.match(details, /OFFER_DETAIL_MAX_ROWS/, 'very large offer lists must remain bounded');

console.log('Build 440 premium Offers hierarchy and truth-preserving card regression passed.');
