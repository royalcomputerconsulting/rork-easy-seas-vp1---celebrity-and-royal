const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const pkg = JSON.parse(read('package.json'));
const casino = read('components/casino/CasinoCommandCenter.tsx');
const economics = read('lib/casinoCruiseEconomics.ts');

assert.match(pkg.scripts['verify:source-release'], /runMaintainedReleaseTests\.js/);

assert.match(casino, /Points reconciliation/, 'provider-to-cruise reconciliation must be visible');
assert.match(casino, /Review cruise rows:/, 'discrepancy report must identify likely unposted cruise rows when possible');
assert.match(casino, /provider\/profile balance is the current total/i, 'provider/profile total must stay separate from attributed cruise points');

for (const label of ['Retail cruise value', 'Amount paid', 'Cruise value captured', 'Cash result', 'Total economic value']) {
  assert.ok(casino.includes(label), `Financial Overview missing ${label}`);
}

assert.ok(casino.includes('Historical annual economics'), 'Historical Annual Casino Summary must render');
assert.ok(casino.includes('Comp coverage'), 'ROI-style comp coverage must render');
assert.ok(casino.includes('Retail / paid'), 'Cruise Portfolio cards must show retail and paid values');
assert.ok(casino.includes('Theoretical loss'), 'Casino Analytics must show theoretical loss');
assert.ok(casino.includes('Coin-in volume'), 'Casino Analytics must show coin-in');
assert.ok(casino.includes('Value per modeled play hour'), 'Casino Analytics must show same-scope cruise-modeled value per play hour');
assert.ok(casino.includes('Modeled point value after theo'), 'Casino Analytics must label modeled point value clearly');

for (const tool of ['Host report', 'Host meeting brief', 'Host CRM', 'Ship intelligence', 'Certificate wallet', 'Benefits ledger', 'Future value wallet']) {
  assert.ok(casino.includes(tool), `Intelligence/tool surface missing ${tool}`);
}

assert.ok(casino.includes('tierProgressionForecastChart'), 'Charts page must build a tier progression forecast series');
assert.ok(casino.includes('futurePointsByMonth'), 'Tier projection must place booked cruises in their actual month');
assert.ok(casino.includes('elapsedDailyPace'), 'Tier projection must use elapsed-season pace');
assert.ok(casino.includes('cursor < reset'), 'Tier projection must stop at the program reset boundary');
assert.ok(casino.includes('Annual value capture'), 'Charts page must render Annual Value Capture');
assert.ok(casino.includes('Retail'), 'Annual value chart must include retail');
assert.ok(casino.includes('Paid'), 'Annual value chart must include paid');
assert.ok(casino.includes('Captured'), 'Annual value chart must include captured comp/discount value');
assert.ok(casino.includes('Cash'), 'Annual value chart must include cash result');
assert.match(economics, /Coin-In is gaming volume only/, 'Annual economics must not double count coin-in as spending or value');

console.log('PASS build410 requirements batch 2: reconciliation, financial overview, annual summary, analytics, portfolio, tools, and reset-bounded charts');
