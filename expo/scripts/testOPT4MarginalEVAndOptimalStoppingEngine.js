const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'easyseas-opt4-'));
function compile(relativePath) {
  const sourcePath = path.join(ROOT, 'lib', 'optimization', relativePath);
  const outputPath = path.join(TEMP, relativePath.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const result = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true, strict: true },
    fileName: sourcePath, reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.strictEqual(errors.length, 0, `Transpile errors in ${relativePath}`);
  fs.writeFileSync(outputPath, result.outputText);
}
[
  'history/types.ts', 'value/types.ts',
  'models/types.ts','models/statistics.ts','models/selectComparableHistory.ts','models/estimateExpectedLoss.ts','models/estimateSuccessProbability.ts',
  'engine/types.ts','engine/determineCurrentLockedCertificate.ts','engine/assessSafetyModes.ts','engine/evaluateCandidateTargets.ts','engine/buildOptimalStoppingRecommendation.ts','engine/legacyAdapter.ts',
].forEach(compile);
const { buildOptimalStoppingRecommendation } = require(path.join(TEMP, 'engine', 'buildOptimalStoppingRecommendation.js'));
const { adaptPersonalRecommendationToLegacyShape } = require(path.join(TEMP, 'engine', 'legacyAdapter.js'));

const ownerProfileId = 'profile-1';
function field(value) { return { value, source: 'fixture', authority: 'closeout-verified', confidence: 'high', confidenceScore: 1, freshness: '2026-07-15', warnings: [] }; }
function outcome(index, points, result, coinIn, pph = 220) {
  return {
    id: `outcome-${index}`, sourceCruiseId: `source-${index}`, ownerProfileId, brand: 'royal', program: 'club-royale', cruiseId: `cruise-${index}`,
    reservationId: `r-${index}`, shipName: 'Harmony of the Seas', sailDate: `2026-0${index + 1}-01`, returnDate: `2026-0${index + 1}-08`, nights: 7,
    casinoOpenDays: 5, casinoOpenHours: 25, seaDayCount: 3, portDayCount: 3, privateIslandDayCount: 1,
    totalPoints: field(points), totalCoinIn: field(coinIn), actualResult: field(result), theoreticalLoss: field(coinIn * 0.06), buyIn: field(500), cashOut: field(Math.max(0, 500 + result)),
    freePlayUsed: field(0), timePlayedMinutes: field(points / pph * 60), sessionCount: 5, machineMix: { slots: 5 }, averagePointsPerDay: points / 5,
    averagePointsPerSession: points / 5, averagePointsPerHour: pph, certificateEarnedCode: null, thresholdReached: points, certificateEvidence: null,
    certificateValueSnapshotId: null, fieldAuthority: {}, dataHealth: { score: 90, grade: 'high', eligibleForHighConfidenceModel: true, components: {}, criticalWarnings: [], warnings: [] },
    thresholdAttempts: [], eligibleForModeling: true, exclusionReasons: [], warnings: [], createdAt: '2026-01-01', updatedAt: '2026-07-15',
  };
}
const outcomes = [outcome(0, 4200, -300, 21000), outcome(1, 6600, -700, 33000), outcome(2, 6800, 900, 34000), outcome(3, 9000, -1200, 45000), outcome(4, 4300, 500, 21500), outcome(5, 6500, -600, 32500)];
const history = { id: 'history-1', ownerProfileId, generatedAt: '2026-07-15', outcomes, descriptiveOutcomes: outcomes, excludedOutcomes: [], sessionReconciliation: {}, duplicateCruiseIds: [], overallDataHealth: { score: 90, grade: 'high', eligibleForHighConfidenceModel: true, components: {}, criticalWarnings: [], warnings: [] }, warnings: [], version: 'opt1.0.0' };
const baseThreshold = { ownerProfileId: null, program: 'club-royale', family: 'C', levelCode: null, effectiveStart: '2026-07-01', effectiveEnd: '2026-07-31', minimumNights: 7, maximumNights: null, replacesLowerCertificate: true, sourceEvidence: [], isFallback: false, version: '1', warnings: [] };
const thresholds = [
  { ...baseThreshold, id: 't1500', certificateCode: 'C1500', thresholdPoints: 1500 },
  { ...baseThreshold, id: 't2000', certificateCode: 'C2000', thresholdPoints: 2000 },
  { ...baseThreshold, id: 't4000', certificateCode: 'C4000', thresholdPoints: 4000 },
  { ...baseThreshold, id: 't6500', certificateCode: 'C6500', thresholdPoints: 6500 },
  { ...baseThreshold, id: 't9000', certificateCode: 'C9000', thresholdPoints: 9000 },
];
function valueSnapshot(t, value, confidence = 'high') { return { id: `v-${t.id}`, ownerProfileId, thresholdDefinitionId: t.id, certificateCode: t.certificateCode, family: 'C', thresholdPoints: t.thresholdPoints, effectiveStart: '2026-07-01', effectiveEnd: null, generatedAt: '2026-07-15', grossReplacementValue: {}, netReplacementValue: {}, redemptionProbability: 0.8, expectedRealizedValue: value, expectedAlternativeValue: 0, expectedUserPaidCost: 200, tradeInAlternativeValue: 0, eligibleSailingCount: 6, sourceCount: 3, completeness: 0.9, confidence, assumptions: [], warnings: [], valuedSailings: [], version: 'opt2.0.0' }; }
function thresholdModel(t, value, label) { return {
  threshold: t, valueSnapshot: valueSnapshot(t, value),
  statistics: { thresholdDefinitionId: t.id, thresholdPoints: t.thresholdPoints, certificateCode: t.certificateCode, opportunities: 6, attempts: 6, successes: outcomes.filter(o => o.totalPoints.value >= t.thresholdPoints).length, failures: 0, rawSuccessRate: 0.7, smoothedSuccessRate: 0.7, successRateConfidenceInterval: { low: 0.3, high: 0.9 }, coinIn: {}, actualResult: {}, bankrollConsumed: {}, tripLength: { median: 7 }, pointsPerDay: {}, pointsPerSession: {}, pointsPerHour: { median: 220 }, lossRate: {}, averageLossOnLosingCruises: 700, averageWinOnWinningCruises: 700, resultVariance: 1, resultStandardDeviation: 1, recencyWeightedTrend: 0, dataQuality: 0.9, confidence: 'high', includedCruiseOutcomeIds: outcomes.map(o => o.id), excludedCruiseOutcomeIds: [], warnings: [] },
  expectedLoss: { thresholdDefinitionId: t.id, targetPoints: t.thresholdPoints, pointsRemaining: t.thresholdPoints, expectedAdditionalCoinIn: t.thresholdPoints * 5, empiricalLossRate: 0.03, theoreticalLossRate: 0.06, blendedLossRate: 0.05, empiricalWeight: 0.5, expectedAdditionalLoss: t.thresholdPoints * 0.25, downsideLow: 0, downsideHigh: t.thresholdPoints * 0.4, costPerPoint: 0.25, sampleCount: 6, confidence: 'high', assumptions: [], warnings: [] },
  successProbability: { thresholdDefinitionId: t.id, targetPoints: t.thresholdPoints, pointsRemaining: t.thresholdPoints, historicalProbability: 0.7, paceFeasibility: 0.8, bankrollFeasibility: 0.8, simulationProbability: 0.7, probability: 0.72, confidence: 'high', comparableSampleCount: 6, simulationCount: 1000, seed: 'x', includedCruiseOutcomeIds: outcomes.map(o => o.id), warnings: [] },
  classification: { thresholdDefinitionId: t.id, thresholdPoints: t.thresholdPoints, label, priorLabel: label, expectedCertificateValue: value, expectedTotalLoss: 500, expectedNetValue: value - 500, riskAdjustedExpectedNetValue: value - 600, successProbability: 0.7, normalBankrollRequired: 600, evidenceSamples: 6, promotionEligible: true, changedFromPrior: false, reasons: [], warnings: [] },
}; }
function model(values = [600,800,2500,2800,3000], lossRate = 0.06) {
  const labels = ['Comfortable','Comfortable','Primary Target','Stretch Goal','Exceptional Goal'];
  return { id: 'model-1', ownerProfileId, generatedAt: '2026-07-15', canonicalHistorySnapshotId: history.id, certificateValueSnapshotIds: thresholds.map(t => `v-${t.id}`),
    profile: { id: 'p', ownerProfileId, generatedAt: '2026-07-15', priors: { ownerProfileId, dailyBankrollBudget: 200, tripBankrollBudget: 1000, volatilityTolerance: 'moderate', dollarsPerPoint: 5, theoreticalLossRate: lossRate, minimumPromotionSamples: 4, minimumStableSuccessProbability: 0.55, defaultThresholdLabels: {}, source: 'user', updatedAt: '2026-07-15' }, averageBankrollConsumed: 500, averageActualLoss: 700, averageActualWin: 700, averagePointsPerDay: 900, averagePointsPerSession: 1000, modelMaturity: 'developing', thresholdModels: thresholds.map((t,i) => thresholdModel(t,values[i],labels[i])), currentPrimaryTarget: 4000, highestExpectedValueTarget: 4000, warnings: [], version: 'opt3.0.0' },
    modelVersion: 'opt3.0.0', priorSnapshotId: null, deterministicFingerprint: `fingerprint-${lossRate}-${values.join('-')}` };
}
function state(overrides = {}) { return { ownerProfileId, program: 'club-royale', brand: 'royal', certificateFamily: 'C', shipName: 'Harmony of the Seas', cruiseNights: 7, currentPoints: 4000, currentResult: 0, currentCoinIn: 20000, remainingCasinoHours: 12, remainingCasinoDays: 2, remainingBankroll: 1000, dailyBankrollBudget: 200, tripBankrollBudget: 1000, currentDailyLoss: 0, currentTripLoss: 0, hardDailyLossLimit: 200, hardTripLossLimit: 1000, lockedProfitFloor: null, sessionDurationMinutes: 60, sameDayPlayMinutes: 90, fatigueRating: 2, currentPointsPerHour: 220, baselinePointsPerHour: 220, currentLossPerPoint: 0.25, baselineLossPerPoint: 0.25, sourceFreshness: '2026-07-15T12:00:00Z', asOf: '2026-07-15T12:00:00Z', ...overrides }; }

// Golden-rule example: 4,000 -> 6,500 adds only $300 but costs about $750; stop.
const negativeValues = thresholds.map((t,i) => valueSnapshot(t,[600,800,2500,2800,3000][i]));
const stop = buildOptimalStoppingRecommendation({ state: state(), history, model: model(), thresholds, valueSnapshots: negativeValues });
assert(['STOP_NOW','DO_NOT_CHASE'].includes(stop.action));
const c6500 = stop.candidateEvaluations.find(c => c.targetPoints === 6500);
assert(c6500);
assert.strictEqual(c6500.incrementalCertificateValue, 300);
assert(c6500.expectedAdditionalLoss > c6500.incrementalCertificateValue);
assert(c6500.rawIncrementalExpectedValue < 0);
assert(stop.topReasons.length > 0);
assert(stop.assumptions.some(x => x.includes('No gambling continuation is described as risk-free')));
assert(!JSON.stringify(stop).toLowerCase().includes('risk-free push'));

const hard = buildOptimalStoppingRecommendation({ state: state({ currentDailyLoss: 200, remainingBankroll: 0 }), history, model: model(), thresholds, valueSnapshots: negativeValues });
assert.strictEqual(hard.action, 'HARD_STOP');
assert(hard.warnings.some(x => x.includes('Daily hard loss limit')));

// Positive raw EV plus a protected profit floor allows a bounded stretch push.
const positiveValues = thresholds.map((t,i) => valueSnapshot(t,[600,800,1200,2600,3000][i]));
const positiveModel = model([600,800,1200,2600,3000], 0.02);
positiveModel.profile.priors.theoreticalLossRate = 0.02;
for (const o of history.outcomes) { o.theoreticalLoss = field(o.totalCoinIn.value * 0.02); o.actualResult = field(o.id.endsWith('0') ? -200 : 300); }
const profit = buildOptimalStoppingRecommendation({ state: state({ currentResult: 1200, lockedProfitFloor: 500, remainingBankroll: 1000, currentDailyLoss: 0, currentTripLoss: 0 }), history, model: positiveModel, thresholds, valueSnapshots: positiveValues });
assert.strictEqual(profit.action, 'PROFIT_PROTECTED_PUSH');
assert.strictEqual(profit.recommendedTargetPoints, 6500);
assert.strictEqual(profit.bankrollImpact.profitProtectedRiskBudget, 700);
assert(profit.rawIncrementalExpectedValue >= 0);

const fresh = buildOptimalStoppingRecommendation({ state: state({ currentResult: 300, remainingBankroll: 1000, fatigueRating: 1, sameDayPlayMinutes: 60 }), history, model: positiveModel, thresholds, valueSnapshots: positiveValues });
const fatigued = buildOptimalStoppingRecommendation({ state: state({ currentResult: 300, remainingBankroll: 1000, fatigueRating: 9, sameDayPlayMinutes: 300, sessionDurationMinutes: 180, currentPointsPerHour: 100, currentLossPerPoint: 0.6 }), history, model: positiveModel, thresholds, valueSnapshots: positiveValues });
const fresh6500 = fresh.candidateEvaluations.find(c => c.targetPoints === 6500);
const tired6500 = fatigued.candidateEvaluations.find(c => c.targetPoints === 6500);
assert(tired6500.riskAdjustedIncrementalExpectedValue < fresh6500.riskAdjustedIncrementalExpectedValue);
assert(fatigued.drillDown.fatiguePerformanceAssessment.penalty > 0);
assert(fatigued.warnings.some(x => x.includes('fatigue') || x.includes('session') || x.includes('same-day')));
const dismissed = buildOptimalStoppingRecommendation({ state: fatigued ? state({ currentResult: 300, remainingBankroll: 1000, fatigueRating: 9, sameDayPlayMinutes: 300 }) : state(), history, model: positiveModel, thresholds, valueSnapshots: positiveValues, dismissFatigueSignal: true });
assert.strictEqual(dismissed.drillDown.fatiguePerformanceAssessment.penalty, 0);
assert.strictEqual(dismissed.drillDown.fatiguePerformanceAssessment.dismissed, true);

const dataUnavailable = buildOptimalStoppingRecommendation({ state: state(), history, model: { ...model(), profile: { ...model().profile, thresholdModels: [] } }, thresholds: [], valueSnapshots: [] });
assert.strictEqual(dataUnavailable.action, 'DATA_UNAVAILABLE');
assert.strictEqual(dataUnavailable.confidence, 'missing');

const repeatA = buildOptimalStoppingRecommendation({ state: state(), history, model: model(), thresholds, valueSnapshots: negativeValues });
const repeatB = buildOptimalStoppingRecommendation({ state: state(), history, model: model(), thresholds, valueSnapshots: negativeValues });
assert.deepStrictEqual(repeatA, repeatB, 'identical snapshots must produce deterministic recommendations');

const legacy = adaptPersonalRecommendationToLegacyShape(stop);
assert.strictEqual(legacy.currentPoints, 4000);
assert(['stop','do-not-chase'].includes(legacy.recommendation));
assert(legacy.warnings.length > 0);

assert.throws(() => buildOptimalStoppingRecommendation({ state: state({ ownerProfileId: 'other' }), history, model: model(), thresholds, valueSnapshots: negativeValues }), /Profile mismatch/);
console.log('PASS OPT-4 marginal EV and optimal stopping engine');
