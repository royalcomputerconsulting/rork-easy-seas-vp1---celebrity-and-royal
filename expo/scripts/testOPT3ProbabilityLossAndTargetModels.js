const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'lib', 'optimization', 'models');
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'easyseas-opt3-'));
function compile(relativePath) {
  const sourcePath = path.join(SOURCE, relativePath);
  const outputPath = path.join(TEMP, relativePath.replace(/\.ts$/, '.js'));
  const result = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true, strict: true },
    fileName: sourcePath, reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.strictEqual(errors.length, 0, `Transpile errors in ${relativePath}`);
  fs.writeFileSync(outputPath, result.outputText);
}
[
  'types.ts', 'statistics.ts', 'buildThresholdStatistics.ts', 'selectComparableHistory.ts',
  'estimateExpectedLoss.ts', 'estimateSuccessProbability.ts', 'classifyPersonalTargets.ts', 'buildPersonalGamblingProfile.ts',
].forEach(compile);
const { buildThresholdStatistics } = require(path.join(TEMP, 'buildThresholdStatistics.js'));
const { selectComparableHistory } = require(path.join(TEMP, 'selectComparableHistory.js'));
const { estimateExpectedLoss } = require(path.join(TEMP, 'estimateExpectedLoss.js'));
const { estimateSuccessProbability } = require(path.join(TEMP, 'estimateSuccessProbability.js'));
const { classifyPersonalTargets } = require(path.join(TEMP, 'classifyPersonalTargets.js'));
const { buildPersonalGamblingProfile } = require(path.join(TEMP, 'buildPersonalGamblingProfile.js'));

const ownerProfileId = 'profile-1';
function field(value) { return { value, source: 'fixture', authority: 'closeout-verified', confidence: 'high', confidenceScore: 1, freshness: '2026-07-15', warnings: [] }; }
function outcome(index, points, result, coinIn, pph = 200, health = 90) {
  const attempts = [1500, 2000, 4000, 6500, 9000].map(threshold => ({
    id: `a-${index}-${threshold}`, cruiseOutcomeId: `outcome-${index}`, thresholdPoints: threshold, pointsAtOpportunityStart: 0,
    pointsRemainingAtStop: Math.max(0, threshold - points), attempted: points >= threshold ? true : (threshold - points <= 250 ? null : false), achieved: points >= threshold,
    pointsAtStop: points, incrementalCoinIn: null, incrementalResult: null, sessionsUsed: null, timeUsedMinutes: null, bankrollConsumed: null,
    resultWhenAttemptBegan: null, remainingCruiseOpportunity: null, recommendationIdAtStart: null, stopReason: null,
    status: points >= threshold ? 'complete' : 'ambiguous', warnings: [],
  }));
  return {
    id: `outcome-${index}`, sourceCruiseId: `source-${index}`, ownerProfileId, brand: 'royal', program: 'club-royale', cruiseId: `cruise-${index}`,
    reservationId: `r-${index}`, shipName: index % 2 ? 'Harmony of the Seas' : 'Wonder of the Seas', sailDate: `2026-0${Math.min(index + 1, 9)}-01`, returnDate: `2026-0${Math.min(index + 1, 9)}-08`,
    nights: 7, casinoOpenDays: 5, casinoOpenHours: 25, seaDayCount: 3, portDayCount: 3, privateIslandDayCount: 1,
    totalPoints: field(points), totalCoinIn: field(coinIn), actualResult: field(result), theoreticalLoss: field(coinIn * 0.06),
    buyIn: field(Math.max(200, -result)), cashOut: field(Math.max(0, 200 + result)), freePlayUsed: field(0), timePlayedMinutes: field(points / pph * 60),
    sessionCount: 4, machineMix: { slots: 4 }, averagePointsPerDay: points / 5, averagePointsPerSession: points / 4, averagePointsPerHour: pph,
    certificateEarnedCode: null, thresholdReached: points, certificateEvidence: null, certificateValueSnapshotId: null, fieldAuthority: {},
    dataHealth: { score: health, grade: health >= 75 ? 'high' : 'medium', eligibleForHighConfidenceModel: health >= 75, components: {}, criticalWarnings: [], warnings: [] },
    thresholdAttempts: attempts, eligibleForModeling: true, exclusionReasons: [], warnings: [], createdAt: '2026-01-01', updatedAt: '2026-07-15',
  };
}
const outcomes = [
  outcome(0, 1800, -150, 9000, 160), outcome(1, 2200, 100, 11000, 180), outcome(2, 4100, -400, 20500, 210),
  outcome(3, 4300, 700, 21500, 220), outcome(4, 6500, -700, 32500, 230), outcome(5, 6700, 1200, 33500, 240),
  outcome(6, 9000, -1200, 45000, 250), outcome(7, 4200, -300, 21000, 205),
];
const threshold = { id: 't4000', ownerProfileId: null, program: 'club-royale', family: 'C', certificateCode: '2607C07', levelCode: '07', thresholdPoints: 4000, effectiveStart: '2026-07-01', effectiveEnd: '2026-07-31', minimumNights: 7, maximumNights: null, replacesLowerCertificate: true, sourceEvidence: [], isFallback: false, version: '1', warnings: [] };
const stats = buildThresholdStatistics({ threshold, outcomes });
assert.strictEqual(stats.successes, 6);
assert(stats.attempts >= stats.successes);
assert(stats.rawSuccessRate > 0.5);
assert(stats.coinIn.median > 0);
assert(stats.averageLossOnLosingCruises > 0);
assert(stats.averageWinOnWinningCruises > 0);
assert(stats.successRateConfidenceInterval.low <= stats.rawSuccessRate);
assert(stats.successRateConfidenceInterval.high >= stats.rawSuccessRate);

const context = { ownerProfileId, program: 'club-royale', brand: 'royal', shipName: 'Harmony of the Seas', cruiseNights: 7, currentPoints: 3500, targetPoints: 4000, remainingCasinoHours: 4, remainingCasinoDays: 1, currentResult: 500, remainingBankroll: 500, asOf: '2026-07-15' };
const selection = selectComparableHistory({ context, outcomes });
assert(selection.includedOutcomes.length >= 3);
assert(selection.decisions.every(decision => typeof decision.similarityScore === 'number'));
const foreign = { ...outcomes[0], id: 'foreign', ownerProfileId: 'other-profile' };
const selectionWithForeign = selectComparableHistory({ context, outcomes: [...outcomes, foreign] });
assert(selectionWithForeign.excludedOutcomes.some(item => item.id === 'foreign'));

const priors = {
  ownerProfileId, dailyBankrollBudget: 200, tripBankrollBudget: 1000, volatilityTolerance: 'moderate', dollarsPerPoint: 5,
  theoreticalLossRate: 0.06, minimumPromotionSamples: 4, minimumStableSuccessProbability: 0.55,
  defaultThresholdLabels: { 1500: 'Comfortable', 2000: 'Comfortable', 4000: 'Primary Target', 6500: 'Stretch Goal', 9000: 'Exceptional Goal', 15000: 'Normally Avoid', 25000: 'Unrealistic' },
  source: 'user-profile', updatedAt: '2026-07-15',
};
const loss = estimateExpectedLoss({ thresholdDefinitionId: 't4000', currentPoints: 3500, targetPoints: 4000, comparableOutcomes: selection.includedOutcomes, priors });
assert(loss.expectedAdditionalLoss >= 0);
assert(loss.blendedLossRate >= 0);
assert(loss.empiricalWeight >= 0 && loss.empiricalWeight <= 0.8);
assert(loss.downsideHigh >= loss.expectedAdditionalLoss);
const allWins = outcomes.map((item, i) => ({ ...item, id: `winner-${i}`, actualResult: field(1000) }));
const winLoss = estimateExpectedLoss({ thresholdDefinitionId: 't4000', currentPoints: 0, targetPoints: 4000, comparableOutcomes: allWins, priors });
assert(winLoss.expectedAdditionalLoss >= 0, 'historical wins must never create negative expected loss');
assert(winLoss.warnings.some(value => value.includes('wins do not make expected loss negative')));

const probabilityA = estimateSuccessProbability({ thresholdDefinitionId: 't4000', context, comparableOutcomes: selection.includedOutcomes, expectedLoss: loss, simulationCount: 1000, seed: 'fixed-seed' });
const probabilityB = estimateSuccessProbability({ thresholdDefinitionId: 't4000', context, comparableOutcomes: selection.includedOutcomes, expectedLoss: loss, simulationCount: 1000, seed: 'fixed-seed' });
assert.deepStrictEqual(probabilityA, probabilityB, 'same snapshot and seed must be deterministic');
assert(probabilityA.probability >= 0 && probabilityA.probability <= 1);
assert.strictEqual(probabilityA.simulationCount, 1000);

const thresholds = [
  { ...threshold, id: 't1500', thresholdPoints: 1500, certificateCode: 'C1500' },
  { ...threshold, id: 't4000', thresholdPoints: 4000, certificateCode: 'C4000' },
  { ...threshold, id: 't6500', thresholdPoints: 6500, certificateCode: 'C6500' },
];
const values = thresholds.map((t, i) => ({ id: `v${i}`, ownerProfileId, thresholdDefinitionId: t.id, certificateCode: t.certificateCode, family: 'C', thresholdPoints: t.thresholdPoints, effectiveStart: '2026-07-01', effectiveEnd: null, generatedAt: '2026-07-15', grossReplacementValue: {}, netReplacementValue: {}, redemptionProbability: 0.8, expectedRealizedValue: [800, 2500, 2800][i], expectedAlternativeValue: 0, expectedUserPaidCost: 200, tradeInAlternativeValue: 0, eligibleSailingCount: 5, sourceCount: 3, completeness: 0.8, confidence: 'high', assumptions: [], warnings: [], valuedSailings: [], version: 'opt2.0.0' }));
const thresholdStats = thresholds.map(t => buildThresholdStatistics({ threshold: t, outcomes }));
const losses = thresholds.map(t => estimateExpectedLoss({ thresholdDefinitionId: t.id, currentPoints: 0, targetPoints: t.thresholdPoints, comparableOutcomes: outcomes, priors }));
const probabilities = thresholds.map((t, i) => estimateSuccessProbability({ thresholdDefinitionId: t.id, context: { ...context, currentPoints: 0, targetPoints: t.thresholdPoints, remainingCasinoHours: 30, remainingBankroll: 1500 }, comparableOutcomes: outcomes, expectedLoss: losses[i], simulationCount: 500, seed: `seed-${t.id}` }));
const classifications = classifyPersonalTargets({ thresholds, valueSnapshots: values, statistics: thresholdStats, losses, probabilities, priors });
assert.strictEqual(classifications.length, 3);
assert(classifications.some(item => item.label === 'Primary Target'));
assert(classifications.every(item => item.reasons.length >= 3));

const sparseClassifications = classifyPersonalTargets({
  thresholds: [{ ...threshold, id: 't6500-sparse', thresholdPoints: 6500, certificateCode: 'C6500' }],
  valueSnapshots: [{ ...values[2], thresholdDefinitionId: 't6500-sparse' }],
  statistics: [{ ...thresholdStats[2], thresholdDefinitionId: 't6500-sparse', attempts: 1 }],
  losses: [{ ...losses[2], thresholdDefinitionId: 't6500-sparse' }],
  probabilities: [{ ...probabilities[2], thresholdDefinitionId: 't6500-sparse', comparableSampleCount: 1, probability: 0.9 }],
  priors,
});
assert.strictEqual(sparseClassifications[0].label, 'Stretch Goal', 'insufficient evidence must preserve prior label');
assert(sparseClassifications[0].warnings.some(value => value.includes('Insufficient personal samples')));

const history = { id: 'history-1', ownerProfileId, generatedAt: '2026-07-15', outcomes, descriptiveOutcomes: outcomes, excludedOutcomes: [], sessionReconciliation: {}, duplicateCruiseIds: [], overallDataHealth: { score: 90, grade: 'high', eligibleForHighConfidenceModel: true, components: {}, criticalWarnings: [], warnings: [] }, warnings: [], version: 'opt1.0.0' };
const modelA = buildPersonalGamblingProfile({ ownerProfileId, history, thresholds, valueSnapshots: values, priors, generatedAt: '2026-07-15T12:00:00Z' });
const modelB = buildPersonalGamblingProfile({ ownerProfileId, history, thresholds, valueSnapshots: values, priors, generatedAt: '2026-07-15T12:00:00Z' });
assert.strictEqual(modelA.deterministicFingerprint, modelB.deterministicFingerprint);
assert.strictEqual(modelA.id, modelB.id);
assert.strictEqual(modelA.profile.modelMaturity, 'developing');
assert.strictEqual(modelA.profile.thresholdModels.length, 3);
assert(modelA.profile.averageActualLoss > 0);
assert(modelA.profile.averageActualWin > 0);

console.log('PASS OPT-3 probability, loss, and target models');
