const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const healthTrust = fs.readFileSync(path.join(root, 'lib/database/HealthTrustDatabase.ts'), 'utf8');
const royalSync = fs.readFileSync(path.join(root, 'state/RoyalCaribbeanSyncProvider.tsx'), 'utf8');

assert.match(healthTrust, /let databaseWriteTail: Promise<void> = Promise\.resolve\(\)/);
assert.match(healthTrust, /export function enqueueHealthTrustWrite/);
assert.match(healthTrust, /databaseWriteTail\.then\(task, task\)/);
assert.match(healthTrust, /withExclusiveTransactionAsync/);
assert.match(healthTrust, /export async function withHealthTrustWriteTransaction/);
assert.match(healthTrust, /replaceDomainRecords[\s\S]*withHealthTrustWriteTransaction/);
assert.match(healthTrust, /upsertDomainRecords[\s\S]*withHealthTrustWriteTransaction/);

const commitStart = royalSync.indexOf("'COMMIT_OFFERS'");
const cruiseCommit = royalSync.indexOf("'COMMIT_AVAILABLE_CRUISES'", commitStart);
const bookingCommit = royalSync.indexOf("'COMMIT_BOOKINGS_HISTORY'", cruiseCommit);
assert.ok(commitStart >= 0 && commitStart < cruiseCommit && cruiseCommit < bookingCommit,
  'authoritative datasets must commit offers, cruises, then bookings in order');

const commitBlock = royalSync.slice(commitStart, bookingCommit + 500);
assert.doesNotMatch(commitBlock, /Promise\.all\(/,
  'authoritative SQLite-backed dataset commits must not start in parallel');

const rollbackStart = royalSync.indexOf("'ROLLBACK_OFFERS'");
const rollbackCruises = royalSync.indexOf("'ROLLBACK_AVAILABLE_CRUISES'", rollbackStart);
const rollbackBookings = royalSync.indexOf("'ROLLBACK_BOOKINGS'", rollbackCruises);
assert.ok(rollbackStart >= 0 && rollbackStart < rollbackCruises && rollbackCruises < rollbackBookings,
  'rollback must restore offers, cruises, then bookings in order');
const rollbackBlock = royalSync.slice(rollbackStart, rollbackBookings + 500);
assert.doesNotMatch(rollbackBlock, /Promise\.all\(/,
  'rollback writes must not start in parallel');

console.log('PASS build445_health_trust_sync_serialization_regression');
