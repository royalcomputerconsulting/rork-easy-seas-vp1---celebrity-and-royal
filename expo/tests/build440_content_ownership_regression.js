const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const offers = read('app/(tabs)/(overview)/index.tsx');
assert.doesNotMatch(offers, /import \{ MachineStrategyCard \}/, 'Offers must not own Machine Strategy');
assert.doesNotMatch(offers, /import \{ ShipMachinesExplorer \}/, 'Offers must not own Ship Machine Explorer');
assert.doesNotMatch(offers, /<MachineStrategyCard\s*\/>/, 'Offers must not mount machine strategy data');
assert.doesNotMatch(offers, /<ShipMachinesExplorer\s*\/>/, 'Offers must not mount fleet machine data');
assert.match(offers, /cruisesWithCasinoData\.slice\(0, 3\)/, 'Offers must show only a bounded recent casino summary');
assert.match(offers, /testID="offers-view-casino-history"/, 'Offers must retain a visible route to complete Casino activity');
assert.match(offers, /router\.push\('\/analytics'/, 'the complete casino-history route must target Casino');
assert.match(offers, /testID="offers-open-slots-tools"/, 'Offers must retain a visible discovery route to Slots tools');
assert.match(offers, /router\.push\('\/machines'/, 'machine discovery must target Slots');

const slots = read('app/(tabs)/machines.tsx');
assert.match(slots, /import \{ MachineStrategyCard \}/, 'Slots must own Machine Strategy');
assert.match(slots, /import \{ ShipMachinesExplorer \}/, 'Slots must own Ship Machine Explorer');
assert.match(slots, /<MachineStrategyCard\s*\/>/, 'Slots must render Machine Strategy');
assert.match(slots, /<ShipMachinesExplorer\s*\/>/, 'Slots must render Ship Machine Explorer');
assert.match(slots, /<MachineConditionLogsPanel/, 'existing condition logs must remain');
assert.match(slots, /<CasinoSessionTracker/, 'existing session tools must remain');
assert.match(slots, /exportFavoriteMachinesToDocx/, 'favorite export must remain');
assert.match(slots, /exportAllMachinesIncrementallyToDocx/, 'full machine export must remain');

const casino = read('app/(tabs)/analytics.tsx');
assert.match(casino, /buildCruiseEconomicsSummary/, 'Casino must retain full cruise economics/history ownership');
assert.match(casino, /buildCasinoCruisesCsv/, 'Casino must retain history export');
assert.match(casino, /openCruisePerformanceEditor/, 'Casino must retain history editing');
assert.match(casino, /completedCruisesCount|completedCruiseCount/, 'Casino must retain completed-cruise evidence');

console.log('Build 440 Casino and Slots content-ownership regression passed.');
