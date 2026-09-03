const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'lib', 'optimization', 'history');
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'easyseas-opt1-'));

function compile(relativePath) {
  const sourcePath = path.join(SOURCE, relativePath);
  const outputPath = path.join(TEMP, relativePath.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const source = fs.readFileSync(sourcePath, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      strict: true,
    },
    fileName: sourcePath,
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
  assert.strictEqual(errors.length, 0, `Transpile errors in ${relativePath}`);
  fs.writeFileSync(outputPath, result.outputText);
}

[
  'types.ts',
  'normalization.ts',
  'reconcileCasinoSessions.ts',
  'dataHealth.ts',
  'reconstructThresholdAttempts.ts',
  'canonicalizeCasinoCruiseOutcome.ts',
  'legacyHistoryMigration.ts',
  'buildCanonicalCasinoHistory.ts',
].forEach(compile);

const { buildCanonicalCasinoHistory } = require(path.join(TEMP, 'buildCanonicalCasinoHistory.js'));
const {
  createLegacyCasinoHistoryMigrationDraft,
  reviewLegacyCasinoHistoryMigration,
  getAcceptedLegacyCasinoHistoryRecords,
} = require(path.join(TEMP, 'legacyHistoryMigration.js'));

const ownerProfileId = 'profile-scott';
const baseCruise = {
  ownerProfileId,
  shipName: 'Harmony of the Seas',
  sailDate: '2026-01-01',
  returnDate: '2026-01-08',
  nights: 7,
  status: 'completed',
  brand: 'royal',
  casinoProgram: 'clubRoyale',
  calculationConfidence: 'actual',
};

const closeoutCruise = {
  ...baseCruise,
  id: 'cruise-closeout',
  reservationNumber: 'R1',
  pointsEarned: 2000,
  coinIn: 10000,
  netResult: -500,
  hoursPlayed: 10,
  instantCertificateOfferCode: '2601C05',
};
const closeoutSessions = [
  {
    id: 's1', ownerProfileId, cruiseId: 'cruise-closeout', brand: 'royal', program: 'club-royale',
    date: '2026-01-02', startTime: '10:00', endTime: '11:00', durationMinutes: 60,
    pointsEarned: 900, coinIn: 4500, winLoss: -300, machineName: 'Dragon Link', rtp: 0.9,
  },
  {
    id: 's2', ownerProfileId, cruiseId: 'cruise-closeout', brand: 'royal', program: 'club-royale',
    date: '2026-01-03', startTime: '10:00', endTime: '11:00', durationMinutes: 60,
    pointsEarned: 900, coinIn: 4500, winLoss: -300, machineName: 'Buffalo Gold', rtp: 0.89,
  },
];
const evidence = [{
  certificateCode: '2601C05', thresholdPoints: 2000, program: 'club-royale', ownerProfileId,
  documentId: 'doc-1', versionId: 'version-1', pageNumber: 2, source: 'stored-pdf', confidence: 'high',
}];

const closeoutHistory = buildCanonicalCasinoHistory({
  ownerProfileId,
  cruises: [closeoutCruise],
  sessions: closeoutSessions,
  asOf: '2026-07-15',
  certificateEvidence: evidence,
  pointEarningRates: [{ program: 'club-royale', dollarsPerPoint: 5, source: 'verified-rule', authority: 'closeout-verified' }],
  certificateThresholds: [400, 600, 800, 1200, 1500, 2000, 3000, 4000, 6500, 9000, 15000, 25000],
});
assert.strictEqual(closeoutHistory.outcomes.length, 1);
const closeout = closeoutHistory.outcomes[0];
assert.strictEqual(closeout.totalPoints.value, 2000, 'closeout points must override session sum');
assert.strictEqual(closeout.totalPoints.source, 'cruise-closeout:pointsEarned');
assert.strictEqual(closeout.totalCoinIn.value, 10000, 'closeout coin-in must override session sum');
assert.strictEqual(closeout.actualResult.value, -500, 'closeout result must override session sum');
assert.strictEqual(closeout.certificateEvidence.versionId, 'version-1');
assert.strictEqual(closeout.thresholdReached, 2000);
assert(closeout.thresholdAttempts.some(attempt => attempt.thresholdPoints === 2000 && attempt.achieved));
assert.strictEqual(closeout.averagePointsPerSession, 1000);
assert.strictEqual(closeout.averagePointsPerHour, 200);
assert(closeout.dataHealth.score > 70);

const rollupCruise = { ...baseCruise, id: 'cruise-rollup', sailDate: '2026-02-01', returnDate: '2026-02-05', nights: 4 };
const rollupSessions = [
  { id: 'r1', ownerProfileId, cruiseId: 'cruise-rollup', date: '2026-02-02', startTime: '10:00', endTime: '11:00', durationMinutes: 60, pointsEarned: 700, coinIn: 3500, winLoss: 50 },
  { id: 'r2', ownerProfileId, cruiseId: 'cruise-rollup', date: '2026-02-03', startTime: '12:00', endTime: '13:30', durationMinutes: 90, pointsEarned: 800, coinIn: 4000, winLoss: 50 },
];
const rollupHistory = buildCanonicalCasinoHistory({ ownerProfileId, cruises: [rollupCruise], sessions: rollupSessions, asOf: '2026-07-15' });
const rollup = rollupHistory.outcomes[0];
assert.strictEqual(rollup.totalPoints.value, 1500);
assert.strictEqual(rollup.totalPoints.authority, 'session-rollup');
assert.strictEqual(rollup.totalCoinIn.value, 7500);
assert.strictEqual(rollup.actualResult.value, 100);
assert.strictEqual(rollup.timePlayedMinutes.value, 150);

const zeroCruise = { ...baseCruise, id: 'cruise-zero', sailDate: '2026-03-01', returnDate: '2026-03-03', pointsEarned: 0, coinIn: 0, netResult: 0 };
const zeroHistory = buildCanonicalCasinoHistory({ ownerProfileId, cruises: [zeroCruise], sessions: [], asOf: '2026-07-15' });
assert.strictEqual(zeroHistory.descriptiveOutcomes[0].totalPoints.value, 0, 'zero points must not become missing');
assert.strictEqual(zeroHistory.descriptiveOutcomes[0].totalCoinIn.value, 0, 'zero coin-in must not become missing');
assert.strictEqual(zeroHistory.descriptiveOutcomes[0].actualResult.value, 0, 'zero result must not become missing');

const estimatedCruise = { ...baseCruise, id: 'cruise-estimated', sailDate: '2026-04-01', returnDate: '2026-04-05', pointsEarned: 4000, netResult: -100 };
const estimatedHistory = buildCanonicalCasinoHistory({
  ownerProfileId,
  cruises: [estimatedCruise],
  sessions: [],
  asOf: '2026-07-15',
  pointEarningRates: [{ program: 'club-royale', dollarsPerPoint: 5, source: 'verified-slot-rate', authority: 'closeout-verified' }],
});
assert.strictEqual(estimatedHistory.outcomes[0].totalCoinIn.value, 20000);
assert.strictEqual(estimatedHistory.outcomes[0].totalCoinIn.authority, 'estimated');
assert(estimatedHistory.outcomes[0].totalCoinIn.warnings[0].includes('4,000 points'));

const overlapCruise = { ...baseCruise, id: 'cruise-overlap', sailDate: '2026-05-01', returnDate: '2026-05-04' };
const overlapSessions = [
  { id: 'o1', ownerProfileId, cruiseId: 'cruise-overlap', date: '2026-05-02', startTime: '10:00', endTime: '12:00', durationMinutes: 120, pointsEarned: 500, coinIn: 2500, winLoss: -50 },
  { id: 'o2', ownerProfileId, cruiseId: 'cruise-overlap', date: '2026-05-02', startTime: '11:00', endTime: '13:00', durationMinutes: 120, pointsEarned: 500, coinIn: 2500, winLoss: -50 },
];
const overlapHistory = buildCanonicalCasinoHistory({ ownerProfileId, cruises: [overlapCruise], sessions: overlapSessions, asOf: '2026-07-15' });
assert.deepStrictEqual(new Set(overlapHistory.sessionReconciliation.overlappingSessionIds), new Set(['o1', 'o2']));
assert.strictEqual(overlapHistory.descriptiveOutcomes[0].totalPoints.value, null, 'overlapping sessions must not be silently summed');
assert.strictEqual(overlapHistory.descriptiveOutcomes[0].actualResult.value, null);

const duplicateSession = { ...rollupSessions[0], id: 'r1-copy' };
const orphan = { id: 'orphan', ownerProfileId, date: '2025-01-01', pointsEarned: 100 };
const foreign = { id: 'foreign', ownerProfileId: 'profile-justin', cruiseId: 'cruise-rollup', pointsEarned: 999 };
const reconciliationHistory = buildCanonicalCasinoHistory({
  ownerProfileId,
  cruises: [rollupCruise],
  sessions: [...rollupSessions, duplicateSession, orphan, foreign],
  asOf: '2026-07-15',
});
assert.deepStrictEqual(reconciliationHistory.sessionReconciliation.duplicateSessionIds, ['r1-copy']);
assert.deepStrictEqual(reconciliationHistory.sessionReconciliation.orphanSessionIds, ['orphan']);
assert.deepStrictEqual(reconciliationHistory.sessionReconciliation.profileMismatchSessionIds, ['foreign']);
assert.strictEqual(reconciliationHistory.outcomes[0].totalPoints.value, 1500, 'duplicate/foreign/orphan sessions must not enter rollup');

const duplicateCruise = { ...closeoutCruise, id: 'cruise-closeout-copy' };
const duplicateHistory = buildCanonicalCasinoHistory({ ownerProfileId, cruises: [closeoutCruise, duplicateCruise], sessions: closeoutSessions, asOf: '2026-07-15' });
assert.deepStrictEqual(duplicateHistory.duplicateCruiseIds, ['cruise-closeout-copy']);
assert(duplicateHistory.excludedOutcomes.some(outcome => outcome.sourceCruiseId === 'cruise-closeout-copy'));

const foreignCruise = { ...baseCruise, id: 'foreign-cruise', ownerProfileId: 'profile-justin', pointsEarned: 9000, netResult: 5000 };
const upcomingCruise = { ...baseCruise, id: 'upcoming', sailDate: '2027-01-01', returnDate: '2027-01-08', status: 'booked', pointsEarned: 6500 };
const cancelledCruise = { ...baseCruise, id: 'cancelled', status: 'cancelled', pointsEarned: 6500 };
const tombstonedCruise = { ...baseCruise, id: 'tombstoned', sailDate: '2026-06-01', returnDate: '2026-06-08', pointsEarned: 6500 };
const excludedHistory = buildCanonicalCasinoHistory({
  ownerProfileId,
  cruises: [foreignCruise, upcomingCruise, cancelledCruise, tombstonedCruise],
  sessions: [],
  asOf: '2026-07-15',
  tombstonedCruiseIds: ['tombstoned'],
});
assert.strictEqual(excludedHistory.outcomes.length, 0);
assert.strictEqual(excludedHistory.excludedOutcomes.length, 4);

const annualTierOnly = { ...baseCruise, id: 'annual-only', sailDate: '2026-06-10', returnDate: '2026-06-13', clubRoyalePoints: 20941 };
const annualHistory = buildCanonicalCasinoHistory({ ownerProfileId, cruises: [annualTierOnly], sessions: [], asOf: '2026-07-15' });
assert.strictEqual(annualHistory.descriptiveOutcomes[0].totalPoints.value, null, 'annual loyalty totals must not become per-cruise points');

const nearCruise = { ...baseCruise, id: 'near-4000', sailDate: '2026-06-15', returnDate: '2026-06-20', pointsEarned: 3800, netResult: -200 };
const nearHistory = buildCanonicalCasinoHistory({ ownerProfileId, cruises: [nearCruise], sessions: [], asOf: '2026-07-15', certificateThresholds: [1500, 2000, 4000, 6500] });
const nearAttempt = nearHistory.outcomes[0].thresholdAttempts.find(attempt => attempt.thresholdPoints === 4000);
assert(nearAttempt);
assert.strictEqual(nearAttempt.status, 'ambiguous');
assert.strictEqual(nearAttempt.attempted, null, 'near threshold must not be guessed as an intentional attempt');

const draft = createLegacyCasinoHistoryMigrationDraft({ ownerProfileId, records: [closeoutCruise], createdAt: '2026-07-15' });
assert.strictEqual(draft.status, 'review-required');
assert.strictEqual(getAcceptedLegacyCasinoHistoryRecords(draft).length, 0, 'unreviewed legacy facts must not enter history');
const reviewed = reviewLegacyCasinoHistoryMigration({
  draft,
  acceptedCandidateIds: [draft.candidates[0].id],
  reviewerId: ownerProfileId,
  reviewedAt: '2026-07-15',
});
const acceptedRecords = getAcceptedLegacyCasinoHistoryRecords(reviewed);
assert.strictEqual(acceptedRecords.length, 1);
assert.strictEqual(acceptedRecords[0].migrationSource, 'migrated_legacy_known_fact');

const optimizationFiles = fs.readdirSync(SOURCE).filter(file => file.endsWith('.ts'));
for (const file of optimizationFiles) {
  const source = fs.readFileSync(path.join(SOURCE, file), 'utf8');
  assert(!/knownProfileFallback|mocks\/|scott\.merlis|s@a\.com/i.test(source), `${file} must not import hidden personal fallback data`);
}
const zodSource = fs.readFileSync(path.join(SOURCE, 'zodSchemas.ts'), 'utf8');
assert(zodSource.includes('CasinoCruiseOutcomeSchema'));
assert(zodSource.includes('CasinoSessionObservationSchema'));
assert(zodSource.includes('FieldAuthoritySchema'));

console.log('PASS OPT-1 canonical personal casino history');
