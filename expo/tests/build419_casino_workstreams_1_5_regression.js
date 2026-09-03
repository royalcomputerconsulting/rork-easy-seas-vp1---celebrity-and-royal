const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function loadTs(relativeFile, dependencies = {}) {
  const filename = path.join(root, relativeFile);
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const old = Module._load;
  Module._load = (request, parent, main) => request in dependencies ? dependencies[request] : request.startsWith('@/') ? {} : old(request, parent, main);
  try { const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename)); mod._compile(output, filename); return mod.exports; }
  finally { Module._load = old; }
}

const statistics = loadTs('lib/optimization/models/statistics.ts');
const ecosystem = loadTs('lib/optimization/value/buildEcosystemValueAdjustments.ts', { '../models/statistics': statistics });
const adjusted = ecosystem.buildEcosystemValueAdjustments([{
  thresholdDefinitionId: '6500', futureOfferValue: 1000, futureOfferProbability: 0.4,
  tierBenefitValue: 500, tierReachProbability: 0.5, ancillaryValue: 100,
  ancillaryUseProbability: 1, cruiseSavings: 200, incrementalTravelCost: 80,
  incrementalCruiseCost: 120, unredeemedReplacementValue: 300, unredeemedProbability: 0.2,
  sourceIds: ['offer-1', 'tier-1', 'ledger-1'], confidence: 'high',
}]);
assert.deepEqual(adjusted.adjustmentsByThresholdId['6500'], {
  incrementalFutureOfferValue: 400, incrementalTierValue: 250, incrementalAncillaryValue: 300,
  incrementalTravelCost: 80, incrementalCruiseCost: 120, expectedUnredeemedValueLoss: 60,
});
assert.deepEqual(adjusted.evidenceByThresholdId['6500'].sourceIds, ['offer-1', 'tier-1', 'ledger-1']);

const portfolio = loadTs('lib/optimization/integration/buildCasinoPortfolioPlan.ts');
const decision = (ev, loss, confidence = 'high') => ({ nextBestAction: { expectedNetVacationValue: ev, expectedAdditionalLoss: loss, confidence } });
const plan = portfolio.buildCasinoPortfolioPlan({ maximumTrips: 2, maximumCashCost: 1000, candidates: [
  { cruiseId: 'a', shipName: 'A', sailDate: '2026-09-01', travelCost: 100, cruiseCost: 100, decision: decision(600, 200) },
  { cruiseId: 'b', shipName: 'B', sailDate: '2026-10-01', travelCost: 200, cruiseCost: 200, decision: decision(-20, 100) },
  { cruiseId: 'c', shipName: 'C', sailDate: '2026-11-01', travelCost: 100, cruiseCost: 100, decision: decision(350, 250, 'medium') },
] });
assert.deepEqual(plan.selected.map(row => row.cruiseId), ['a', 'c']);
assert.equal(plan.totalExpectedNetVacationValue, 950);
assert.equal(plan.totalExpectedCost, 850);
assert.equal(plan.confidence, 'medium');
assert.equal(plan.deferred.find(row => row.cruiseId === 'b').reason, 'Expected net vacation value is not positive.');

const facade = fs.readFileSync(path.join(root, 'lib/optimization/CasinoIntelligenceEngine.ts'), 'utf8');
assert.match(facade, /personalPlayRates/);
assert.match(facade, /estimatePersonalPlayRates/);
const rates = fs.readFileSync(path.join(root, 'lib/optimization/models/estimatePersonalPlayRates.ts'), 'utf8');
for (const term of ['same-machine', 'same-ship', 'similar-session', 'recent-personal', 'lifetime-personal', 'generic-fallback', 'confidenceInterval95', 'percentile90']) assert.ok(rates.includes(term));
const stopping = fs.readFileSync(path.join(root, 'lib/optimization/engine/buildOptimalStoppingRecommendation.ts'), 'utf8');
for (const action of ['WAIT_UNTIL_TOMORROW', 'LOWER_VOLATILITY', 'SAVE_BANKROLL_FOR_NEXT_CRUISE', 'CONTINUE_NORMALLY']) assert.ok(stopping.includes(action));
const live = fs.readFileSync(path.join(root, 'lib/optimization/live/buildLiveCasinoAdvisorSnapshot.ts'), 'utf8');
assert.match(live, /\[30, 60, 90\]/);
assert.match(live, /playMode/);
assert.doesNotMatch(live, /probability of success × incremental certificate value/);
const screen = fs.readFileSync(path.join(root, 'app/casino/live-certificate-advisor.tsx'), 'utf8');
for (const label of ['Expected net vacation value', 'Bankroll survival', 'Bounded session scenarios', 'Target comparison']) assert.ok(screen.includes(label));
console.log('PASS Build 419 casino intelligence workstreams 1–5: personal rates, live decisions, ecosystem value, portfolio constraints, and advisor UI');
