const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const casino = read('components/casino/CasinoCommandCenter.tsx');
const route = read('app/(tabs)/analytics.tsx');
const economics = read('hooks/useCasinoEconomicsData.ts');
const loyalty = read('state/LoyaltyProvider.tsx');

for (const [label, routeName] of [
  ['cruise-level edit', '/casino/post-cruise-closeout'],
  ['receipt', '/casino/invoice-import'],
  ['host', '/casino/host-crm'],
  ['value', '/casino/value-scenarios'],
  ['certificate', '/casino/certificate-wallet'],
  ['session', '/casino-sessions'],
  ['calculation', '/casino/formula-reference'],
]) {
  assert.ok(casino.includes(routeName), `${label} control is not reachable from Casino`);
}

assert.match(casino, /casino-review-session-history/);
assert.match(casino, /casino-session-history-tool/);
assert.match(economics, /filterRecordsForProfile/);
assert.match(economics, /scopedProfile/);
assert.match(casino, /filterRecordsForProfile\(allSessions, casinoProfile, users\)/);
assert.match(casino, /filterRecordsForProfile\(allSearchableCertificates, casinoProfile, users\)/);
assert.match(casino, /Easy Seas will not show another user’s static casino totals on an empty profile/);
assert.doesNotMatch(loyalty, /Math\.max\(CONFIRMED_CLUB_ROYALE_2026_POINTS/);

assert.doesNotMatch(casino, /InteractionManager\.runAfterInteractions|runAfterUiSettles\(/);
assert.match(casino, /setTimeout\(processBatch, 0\)/);
assert.match(casino, /CASINO_TRUTH_BATCH_SIZE = 125/);
assert.match(route, /CasinoRouteErrorBoundary/);
assert.match(route, /casino-safe-retry/);
assert.match(route, /casino-safe-data-health/);
assert.doesNotMatch(route, /DeferredCasinoCommandCenter/);

console.log('PASS Build 445 Item 31 Casino controls, owner isolation, and responsive recovery regression.');
