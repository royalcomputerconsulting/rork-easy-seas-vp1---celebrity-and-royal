const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'lib', 'optimization', 'models');
const required = ['types.ts','statistics.ts','buildThresholdStatistics.ts','selectComparableHistory.ts','estimateExpectedLoss.ts','estimateSuccessProbability.ts','classifyPersonalTargets.ts','buildPersonalGamblingProfile.ts','zodSchemas.ts','index.ts'];
for (const file of required) assert(fs.existsSync(path.join(DIR, file)), `Missing ${file}`);
const types = fs.readFileSync(path.join(DIR, 'types.ts'), 'utf8');
for (const token of ['PersonalOptimizerPriors','ThresholdStatistics','ComparableHistorySelection','ExpectedLossEstimate','SuccessProbabilityEstimate','PersonalTargetClassification','PersonalGamblingProfile','OptimizationModelSnapshot']) assert(types.includes(token), `Missing ${token}`);
const loss = fs.readFileSync(path.join(DIR, 'estimateExpectedLoss.ts'), 'utf8');
assert(loss.includes('Math.max(0, -result)'));
assert(loss.includes('empiricalWeight'));
assert(loss.includes('theoreticalLossRate'));
const probability = fs.readFileSync(path.join(DIR, 'estimateSuccessProbability.ts'), 'utf8');
assert(probability.includes('seededRandom'));
assert(probability.includes('simulationCount'));
assert(probability.includes('paceFeasibility'));
assert(probability.includes('bankrollFeasibility'));
const classification = fs.readFileSync(path.join(DIR, 'classifyPersonalTargets.ts'), 'utf8');
assert(classification.includes('minimumPromotionSamples'));
assert(classification.includes('minimumStableSuccessProbability'));
assert(classification.includes('Automatic label change is held'));
const publicIndex = fs.readFileSync(path.join(ROOT, 'lib', 'optimization', 'index.ts'), 'utf8');
assert(publicIndex.includes("export * from '@/lib/optimization/models'"));
for (const file of required) {
  const source = fs.readFileSync(path.join(DIR, file), 'utf8');
  assert(!/knownProfileFallback|scott\.merlis|KNOWN_CASINO_PROFILE_EMAILS/i.test(source), `${file} must not use hidden profile data`);
}
console.log('PASS OPT-3 model architecture and safety');
