const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'lib', 'optimization', 'value');
const HISTORY = path.join(ROOT, 'lib', 'optimization', 'history');
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'easyseas-opt2-'));

function compile(sourceRoot, relativePath, outputRoot = TEMP) {
  const sourcePath = path.join(sourceRoot, relativePath);
  const outputPath = path.join(outputRoot, relativePath.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const source = fs.readFileSync(sourcePath, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true, strict: true },
    fileName: sourcePath,
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics || []).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
  assert.strictEqual(errors.length, 0, `Transpile errors in ${relativePath}`);
  fs.writeFileSync(outputPath, result.outputText);
}

compile(HISTORY, 'types.ts', path.join(TEMP, '..', 'history-output'));
[
  'types.ts', 'statistics.ts', 'valueCertificateSailing.ts', 'calculatePersonalRedeemability.ts',
  'buildCertificateValueSnapshot.ts', 'backfillHistoricalCertificateValues.ts',
].forEach(file => compile(SOURCE, file));

const { valueCertificateSailing } = require(path.join(TEMP, 'valueCertificateSailing.js'));
const { calculatePersonalRedeemability } = require(path.join(TEMP, 'calculatePersonalRedeemability.js'));
const { buildCertificateValueSnapshot } = require(path.join(TEMP, 'buildCertificateValueSnapshot.js'));
const { backfillHistoricalCertificateValues } = require(path.join(TEMP, 'backfillHistoricalCertificateValues.js'));

const evidence = [{ source: 'stored-pdf', authority: 'closeout-verified', confidence: 'high', documentId: 'doc-c', versionId: 'v1', pageNumber: 2 }];
const threshold4000 = {
  id: 'threshold-c-4000', ownerProfileId: null, program: 'club-royale', family: 'C', certificateCode: '2607C07', levelCode: '07',
  thresholdPoints: 4000, effectiveStart: '2026-07-01', effectiveEnd: '2026-07-31', minimumNights: 7, maximumNights: null,
  replacesLowerCertificate: true, sourceEvidence: evidence, isFallback: false, version: '1', warnings: [],
};
const thresholdA4000 = { ...threshold4000, id: 'threshold-a-4000', family: 'A', certificateCode: '2607A07', maximumNights: 6 };
assert.notStrictEqual(threshold4000.id, thresholdA4000.id, 'A and C threshold authority must remain separate');

const valued = valueCertificateSailing({
  id: 'sailing-1', thresholdDefinitionId: threshold4000.id, certificateCode: threshold4000.certificateCode,
  shipName: 'Legend of the Seas', sailDate: '2027-01-01', nights: 7, cabinCategory: 'Balcony', guestOccupancy: '2 Guests',
  eligible: true, mandatoryUserPaidCost: 250,
  components: [
    { id: 'fare', kind: 'cruise-fare', amount: 2200, benefitKey: 'fare-2', sourceEvidence: evidence },
    { id: 'tax-covered', kind: 'covered-taxes-fees', amount: 200, benefitKey: 'covered-tax', sourceEvidence: evidence },
    { id: 'fp', kind: 'freeplay', amount: 500, benefitKey: 'freeplay', sourceEvidence: evidence },
    { id: 'obc-1', kind: 'obc', amount: 75, benefitKey: 'signature-obc', sourceEvidence: evidence },
    { id: 'obc-duplicate', kind: 'obc', amount: 75, benefitKey: 'signature-obc', sourceEvidence: evidence },
    { id: 'internet', kind: 'internet', amount: 210, benefitKey: 'internet-one-device', userPaidCost: 10, sourceEvidence: evidence },
  ],
});
assert.strictEqual(valued.grossReplacementValue, 3185, 'duplicate OBC must not be counted twice');
assert.strictEqual(valued.expectedUserPaidCost, 260);
assert.strictEqual(valued.netReplacementValue, 2925);
assert.deepStrictEqual(valued.suppressedDuplicateComponentIds, ['obc-duplicate']);
assert.strictEqual(valued.componentTotals.obc, 75);

const redeemability = calculatePersonalRedeemability({
  ownerProfileId: 'profile-1', threshold: threshold4000, eligibleSailings: [valued],
  history: [{ family: 'C', thresholdPoints: 4000, earnedCount: 4, redeemedCount: 3, expiredCount: 1 }],
  manualUseWeight: 0.9, daysUntilExpiration: 30, severeRestrictionCount: 0, alternativeTradeInValue: 450,
});
assert(redeemability.probability > 0 && redeemability.probability < 1);
assert.strictEqual(redeemability.rawHistoricalRate, 0.75);
assert.strictEqual(redeemability.alternativeTradeInValue, 450);

const conflicted = calculatePersonalRedeemability({
  ownerProfileId: 'profile-1', threshold: threshold4000, eligibleSailings: [valued],
  history: [{ family: 'C', thresholdPoints: 4000, earnedCount: 4, redeemedCount: 3 }],
  manualUseWeight: 0.9, hasFutureBookingConflict: true, daysUntilExpiration: 4, severeRestrictionCount: 2,
});
assert(conflicted.probability < redeemability.probability, 'conflict, expiration, and restrictions must reduce redeemability');

const snapshot = buildCertificateValueSnapshot({
  ownerProfileId: 'profile-1', threshold: threshold4000, generatedAt: '2026-07-15T12:00:00Z',
  sailings: [
    {
      id: 's1', thresholdDefinitionId: threshold4000.id, certificateCode: threshold4000.certificateCode, shipName: 'Legend of the Seas', sailDate: '2027-01-01', eligible: true,
      components: [{ id: 'fare1', kind: 'cruise-fare', amount: 2000, benefitKey: 'fare', sourceEvidence: evidence }, { id: 'fp1', kind: 'freeplay', amount: 500, benefitKey: 'fp', sourceEvidence: evidence }], mandatoryUserPaidCost: 250,
    },
    {
      id: 's2', thresholdDefinitionId: threshold4000.id, certificateCode: threshold4000.certificateCode, shipName: 'Icon of the Seas', sailDate: '2027-02-01', eligible: true,
      components: [{ id: 'fare2', kind: 'cruise-fare', amount: 3000, benefitKey: 'fare', sourceEvidence: evidence }, { id: 'fp2', kind: 'freeplay', amount: 500, benefitKey: 'fp', sourceEvidence: evidence }], mandatoryUserPaidCost: 300,
    },
    {
      id: 's3', thresholdDefinitionId: threshold4000.id, certificateCode: threshold4000.certificateCode, shipName: 'Excluded', sailDate: '2027-03-01', eligible: false,
      components: [{ id: 'fare3', kind: 'cruise-fare', amount: 10000, benefitKey: 'fare', sourceEvidence: evidence }],
    },
  ],
  redemption: { history: [{ family: 'C', thresholdPoints: 4000, earnedCount: 4, redeemedCount: 3 }], manualUseWeight: 0.8, alternativeTradeInValue: 450 },
});
assert.strictEqual(snapshot.eligibleSailingCount, 2);
assert.strictEqual(snapshot.grossReplacementValue.maximumRaw, 3500, 'ineligible raw maximum must be excluded');
assert(snapshot.expectedRealizedValue < snapshot.netReplacementValue.mean, 'realized value must be probability-adjusted');
assert(snapshot.expectedAlternativeValue > 0);
assert(snapshot.grossReplacementValue.mean > snapshot.netReplacementValue.mean);
assert(snapshot.sourceCount >= 1);
assert(snapshot.assumptions.some(value => value.includes('separately')));

const emptySnapshot = buildCertificateValueSnapshot({
  ownerProfileId: 'profile-1', threshold: { ...threshold4000, id: 'fallback', isFallback: true }, generatedAt: '2026-07-15T12:00:00Z',
  sailings: [], redemption: {},
});
assert.strictEqual(emptySnapshot.expectedRealizedValue, 0);
assert.strictEqual(emptySnapshot.confidence, 'missing');
assert(emptySnapshot.warnings.some(value => value.includes('fallback ladder')));
assert(emptySnapshot.warnings.some(value => value.includes('No eligible sailings')));

const backfill = backfillHistoricalCertificateValues({
  records: [
    { id: 'hist-actual', cruiseOutcomeId: 'cruise-1', certificateCode: '2607C07', thresholdPoints: 4000, earnedAt: '2026-07-10', redeemed: true, actualRealizedValue: 2800, actualUserPaidCost: 250 },
    { id: 'hist-later', cruiseOutcomeId: 'cruise-2', certificateCode: '2701C07', thresholdPoints: 4000, earnedAt: '2026-12-15', redeemed: null },
  ],
  definitions: [threshold4000, { ...threshold4000, id: 'later-definition', certificateCode: '2701C07', effectiveStart: '2027-01-01', effectiveEnd: '2027-01-31' }],
  snapshots: [snapshot, { ...snapshot, id: 'later-snapshot', thresholdDefinitionId: 'later-definition', certificateCode: '2701C07' }],
});
assert.strictEqual(backfill[0].actualRealizedValue, 2800);
assert.strictEqual(backfill[0].estimatedRealizedValue, snapshot.expectedRealizedValue);
assert(backfill[0].warnings.some(value => value.includes('not overwritten')));
assert.strictEqual(backfill[1].usedLaterPeriodEvidence, true);
assert(backfill[1].warnings.some(value => value.includes('later certificate period')));

console.log('PASS OPT-2 personal certificate value model');
