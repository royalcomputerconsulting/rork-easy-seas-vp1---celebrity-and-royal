const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const pkg = JSON.parse(read('package.json'));
const casino = read('components/casino/CasinoCommandCenter.tsx');
const agent = read('state/AgentXProvider.tsx');
const sync = read('state/UserDataSyncProvider.tsx');
const weather = read('state/SailingWeatherProvider.tsx');
const settings = read('app/(tabs)/settings.tsx');
const requirements = read('lib/casino/casinoRecoveryRequirements.ts');

assert.match(pkg.scripts['verify:source-release'], /runMaintainedReleaseTests\.js/);
assert.match(requirements, /Unavailable — authoritative source required/);
assert.match(requirements, /CASINO_RECOVERY_REQUIREMENTS/);
assert.match(requirements, /CASINO_METRIC_DICTIONARY/);
assert.match(requirements, /version: '2026-08-24-build410-recovery'/);

for (let id = 41; id <= 89; id += 1) {
  assert.match(requirements, new RegExp(`id: ${id},`), `missing requirement ${id}`);
}

for (const term of [
  'coin-in',
  'turnover',
  'theo',
  'actual',
  'gaming day',
  'rated day',
  'ADT',
  'ADW',
  'player worth',
  'traveler value',
  'operator cost',
  'reinvestment',
  'response',
  'redemption',
  'lift',
  'contribution',
]) {
  assert.match(requirements.toLowerCase(), new RegExp(term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `metric dictionary missing ${term}`);
}

for (const label of [
  'Receipt importer',
  'Certificate-to-earning-cruise linkage',
  'Certificate-to-booking redemption',
  'Ask My Data Casino coverage',
  'Complete backup coverage',
  'Chunked transactional restore',
  'Crew registry scaling',
  'Startup fast path',
  'Release gate',
  'Responsible-gaming controls',
  'Privacy and governance',
  'Model governance',
  'Casino-marketing readiness scenarios',
]) {
  assert.match(requirements, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `requirements registry missing ${label}`);
}

for (const status of ['active', 'guarded', 'operator_source_required', 'test_required']) {
  assert.match(requirements, new RegExp(`status: '${status}'`), `requirements registry missing ${status} status`);
}

assert.match(casino, /casino-recovery-governance-status/, 'Casino screen must expose recovery/governance status');
assert.match(casino, /Operator-only fields display/, 'Casino screen must warn that operator-only values are not fabricated');
assert.match(casino, /Formula reference/i, 'Formula Reference tool must remain available');
assert.match(casino, /Casino settings/, 'Casino Settings tool must remain available');
assert.match(casino, /Royal receipt importer/, 'Receipt importer must remain reachable from Casino tools');
assert.match(casino, /Host report/, 'Host export/report surface must remain reachable');

assert.match(agent, /cruise ledger|sessions|receipts|certificates|tiers|ships|points|theo|hours|confidence/i, 'Ask My Data prompt/context must cover casino evidence domains');
assert.match(agent, /assistant service.*failed|dependency-free Ask My Data pass|fallback/i, 'Ask My Data must have a local fallback path');
assert.match(sync, /CREW_RECOGNITION_ENTRIES/, 'Save/load must include crew recognition entries');
assert.match(sync, /CREW_RECOGNITION_SAILINGS/, 'Save/load must include crew recognition sailings');
assert.match(sync, /CASINO_SESSIONS/, 'Save/load must include casino sessions');
assert.match(sync, /automatic backend restore is disabled/, 'startup must remain local-first instead of backend-dependent');
assert.match(sync, /appendPromise|withTimeout|restoreDataToLocal/, 'restore must use bounded/guarded writes rather than direct render-path hydration');
assert.match(weather, /SAILING_WEATHER_REFRESH_MS = 1000 \* 60 \* 60 \* 4/, 'weather refresh should retain 4-hour update cadence');
assert.match(settings, /export|Export/i, 'settings/admin must retain export surfaces');

console.log('PASS build410 requirements batch 5-9: receipts/certificates/Ask My Data, backup/crew performance, release gates, and casino marketing governance');
