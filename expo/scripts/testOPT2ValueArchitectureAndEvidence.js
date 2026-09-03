const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const VALUE = path.join(ROOT, 'lib', 'optimization', 'value');
const required = [
  'types.ts', 'statistics.ts', 'valueCertificateSailing.ts', 'calculatePersonalRedeemability.ts',
  'buildCertificateValueSnapshot.ts', 'backfillHistoricalCertificateValues.ts', 'zodSchemas.ts', 'index.ts',
];
for (const file of required) assert(fs.existsSync(path.join(VALUE, file)), `Missing ${file}`);
const types = fs.readFileSync(path.join(VALUE, 'types.ts'), 'utf8');
for (const token of ['CertificateThresholdDefinition', 'CertificateValueSnapshot', 'grossReplacementValue', 'expectedRealizedValue', 'sourceEvidence', 'actualRealizedValue', 'estimatedRealizedValue']) {
  assert(types.includes(token), `Missing contract ${token}`);
}
const sailing = fs.readFileSync(path.join(VALUE, 'valueCertificateSailing.ts'), 'utf8');
assert(sailing.includes('seenNonStackableBenefitKeys'));
assert(sailing.includes('suppressedDuplicateComponentIds'));
assert(sailing.includes('mandatoryUserPaidCost'));
const snapshot = fs.readFileSync(path.join(VALUE, 'buildCertificateValueSnapshot.ts'), 'utf8');
assert(snapshot.includes('Gross replacement value and expected realized value are intentionally stored separately'));
assert(snapshot.includes('input.threshold.isFallback'));
assert(snapshot.includes('sourceCount'));
const backfill = fs.readFileSync(path.join(VALUE, 'backfillHistoricalCertificateValues.ts'), 'utf8');
assert(backfill.includes('usedLaterPeriodEvidence'));
assert(backfill.includes('Actual realized value is preserved separately'));
const zod = fs.readFileSync(path.join(VALUE, 'zodSchemas.ts'), 'utf8');
assert(zod.includes('CertificateThresholdDefinitionSchema'));
assert(zod.includes('CertificateValueSnapshotSchema'));
const index = fs.readFileSync(path.join(ROOT, 'lib', 'optimization', 'index.ts'), 'utf8');
assert(index.includes("export * from '@/lib/optimization/value'"));
for (const file of required) {
  const source = fs.readFileSync(path.join(VALUE, file), 'utf8');
  assert(!/knownProfileFallback|scott\.merlis|@/.test(source), `${file} must not contain hidden personal profile data`);
}
console.log('PASS OPT-2 value architecture and evidence');
