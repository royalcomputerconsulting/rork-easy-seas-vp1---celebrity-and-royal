const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const pkg = JSON.parse(read('package.json'));
const casino = read('components/casino/CasinoCommandCenter.tsx');
const economics = read('lib/casinoCruiseEconomics.ts');

assert.match(pkg.scripts['verify:source-release'], /build410_requirements_batch2_regression\.js/);

assert.match(casino, /POINTS SYNC DISCREPANCY/, 'provider discrepancy banner must be visible');
assert.match(casino, /Likely unposted cruise rows/, 'discrepancy report must identify likely unposted cruise rows when possible');
assert.match(casino, /Saved app\/manual cruise points remain authoritative/, 'manual/app truth must win over sync totals');

for (const label of ['Retail value', 'Amount paid', 'Cruise value captured', 'Cash result', 'Total economic value']) {
  assert.ok(casino.includes(label), `Financial Overview missing ${label}`);
}

assert.ok(casino.includes('Historical annual value'), 'Historical Annual Casino Summary must render');
assert.ok(casino.includes('Comp coverage'), 'ROI-style comp coverage must render');
assert.ok(casino.includes('Retail / paid'), 'Cruise Portfolio cards must show retail and paid values');
assert.ok(casino.includes('Theoretical loss'), 'Casino Analytics must show theoretical loss');
assert.ok(casino.includes('Coin-in volume'), 'Casino Analytics must show coin-in');
assert.ok(casino.includes('Value per hour'), 'Casino Analytics must show value per hour');
assert.ok(casino.includes('Net theoretical'), 'Casino Analytics must show net theoretical');

for (const tool of ['Host report', 'Host meeting brief', 'Host CRM', 'Ship intelligence', 'Certificate wallet', 'Benefits ledger', 'Future value wallet']) {
  assert.ok(casino.includes(tool), `Intelligence/tool surface missing ${tool}`);
}

assert.ok(casino.includes('tierProgressionForecastChart'), 'Charts page must build a tier progression forecast series');
assert.ok(casino.includes('Array.from({ length: 24 }'), 'Tier progression forecast must cover 24 months');
assert.ok(casino.includes('futureGamingNights'), 'Tier projection must consider future booked gaming days');
assert.ok(casino.includes('Tier progression forecast · 24-month view'), 'Charts page must render the 24-month forecast');
assert.ok(casino.includes('Annual value capture'), 'Charts page must render Annual Value Capture');
assert.ok(casino.includes('Retail'), 'Annual value chart must include retail');
assert.ok(casino.includes('Paid'), 'Annual value chart must include paid');
assert.ok(casino.includes('Captured'), 'Annual value chart must include captured comp/discount value');
assert.ok(casino.includes('Cash'), 'Annual value chart must include cash result');
assert.match(economics, /Coin-In is gaming volume only/, 'Annual economics must not double count coin-in as spending or value');

console.log('PASS build410 requirements batch 2: discrepancy, financial overview, historical annual summary, analytics, portfolio, host/ship/certificate intelligence, and 24-month charts');
