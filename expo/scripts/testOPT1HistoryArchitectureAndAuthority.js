const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HISTORY = path.join(ROOT, 'lib', 'optimization', 'history');
const requiredFiles = [
  'types.ts',
  'normalization.ts',
  'reconcileCasinoSessions.ts',
  'canonicalizeCasinoCruiseOutcome.ts',
  'reconstructThresholdAttempts.ts',
  'dataHealth.ts',
  'legacyHistoryMigration.ts',
  'buildCanonicalCasinoHistory.ts',
  'zodSchemas.ts',
  'index.ts',
];
for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(HISTORY, file)), `Missing ${file}`);
}

const canonicalizer = fs.readFileSync(path.join(HISTORY, 'canonicalizeCasinoCruiseOutcome.ts'), 'utf8');
assert(canonicalizer.indexOf("['pointsEarned', 'earnedPoints', 'casinoPoints']") >= 0);
assert(canonicalizer.indexOf("['netResult', 'cashResult']") >= 0);
assert(canonicalizer.indexOf("['winningsBroughtHome', 'winnings', 'totalWinnings']") >= 0);
assert(canonicalizer.indexOf('pointEarningRates.find') >= 0);
assert(canonicalizer.indexOf('tombstonedCruiseIds') >= 0);
assert(canonicalizer.indexOf('duplicateCruiseIds') >= 0);
assert(!/crownAnchor|crownAndAnchor|relationshipPoints|individualPoints/i.test(canonicalizer), 'Optimizer history must not read loyalty totals as per-cruise points');

const reconciliation = fs.readFileSync(path.join(HISTORY, 'reconcileCasinoSessions.ts'), 'utf8');
assert(reconciliation.includes("'profile-mismatch'"));
assert(reconciliation.includes("'duplicate'"));
assert(reconciliation.includes("'orphan'"));
assert(reconciliation.includes("'ambiguous'"));
assert(reconciliation.includes('rangesOverlap'));

const migration = fs.readFileSync(path.join(HISTORY, 'legacyHistoryMigration.ts'), 'utf8');
assert(migration.includes('review-required'));
assert(migration.includes('acceptedCandidateIds'));
assert(!/knownProfileFallback|KNOWN_CASINO_PROFILE_EMAILS|BOOKED_CRUISES_DATA|COMPLETED_CRUISES_DATA/.test(migration));


const fixturePath = path.join(ROOT, 'scripts', 'fixtures', 'opt1LegacyCasinoHistoryMigration.review-required.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
assert.strictEqual(fixture.requiresExplicitReview, true);
assert.strictEqual(fixture.acceptedByDefault, false);
assert.strictEqual(fixture.ownerProfileId, null);
assert(fixture.records.every(record => record.migrationReviewStatus === 'review-required'));
assert(!JSON.stringify(fixture).includes('@'), 'Migration fixture must not contain a known email address');

const optimizationIndex = fs.readFileSync(path.join(ROOT, 'lib', 'optimization', 'index.ts'), 'utf8');
assert(optimizationIndex.includes("export * from '@/lib/optimization/history'"));

console.log('PASS OPT-1 history architecture and authority');
