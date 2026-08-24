const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const commandCenter = read('components/casino/CasinoCommandCenter.tsx');
const settings = read('state/CasinoSettingsProvider.tsx');
const sessions = read('state/CasinoSessionProvider.tsx');
const onboard = read('app/casino/onboard-mode.tsx');
const relationship = read('lib/casino/casinoRelationshipIntelligence.ts');
const shipPerformance = read('app/casino/ship-performance.tsx');
const completed = read('app/casino/completed-sailings.tsx');
const formula = read('app/casino/formula-reference.tsx');
const casinoRoute = read('app/(tabs)/analytics.tsx');

assert.match(settings, /easyseas_casino_selected_program/);
assert.match(settings, /quotaSafeSetItem\(selectedProgramKey, program\)/);
assert.match(commandCenter, /selectedProgram: program/);
assert.match(commandCenter, /pointsPerHourFallback: settings\.defaultPointsPerHour/);
assert.match(commandCenter, /houseEdgeFallback: settings\.defaultHouseEdge/);
assert.match(commandCenter, /currentSeasonTrips\.reduce/);
assert.match(commandCenter, /includeUnprogrammedSessionIds: inferredProgramSessionIds/);
assert.match(sessions, /inferredProgramSessionIds\.has\(session\.id\)/);
assert.match(commandCenter, /CASINO_TRUTH_BATCH_SIZE = 125/);
assert.match(commandCenter, /sessionsByCruise\.get\(cruise\.id\) \?\? \[\]/);
assert.match(commandCenter, /setTimeout\(processBatch, 0\)/);
assert.match(commandCenter, /malformed record\(s\) were safely skipped/);
assert.match(casinoRoute, /class CasinoRouteErrorBoundary/);
assert.match(casinoRoute, /casino-safe-error-state/);
assert.match(casinoRoute, /const fallback = setTimeout\(finish, 250\)/);

for (const tool of [
  'Relationship intelligence', 'Current-trip comp pace', 'Ship observations',
  'Certificate wallet', 'Benefits ledger', 'Future value wallet', 'Completed sailings',
  'Host meeting brief', 'Host CRM', 'Optimization alerts', 'Casino checklist', 'Casino settings',
  'Optimizer accuracy', 'Loyalty data', 'Formula reference',
]) assert.ok(commandCenter.includes(tool), `missing reachable tool: ${tool}`);

assert.match(commandCenter, /Points by recent session/);
assert.doesNotMatch(commandCenter, /label: 'Hours'.*label: 'Points\/hour'.*label: 'Rated days'/s);
assert.match(onboard, /inferCasinoProgram/);
assert.match(onboard, /program, recordKind: 'actual', pointsSource: 'user_entered'/);
assert.match(onboard, /winLoss: out \+ jackpot - buyIn/);
assert.match(relationship, /!isGeneratedSession\(session\)/);
assert.match(relationship, /cashOut \+ separateHandpay - buyIn/);
assert.doesNotMatch(shipPerformance, /entry\.points \* 5/);
assert.match(shipPerformance, /entry\.coinIn \/ entry\.coinInCruises/);
assert.match(completed, /no Blue Chip or table-play conversion is assumed/);
assert.match(formula, /not applied to Blue Chip, Carnival, table play, poker/);

const routeExpectations = {
  'app/casino/action-center.tsx': "tab: 'tools'",
  'app/casino/cruise-value.tsx': "tab: 'trips'",
  'app/casino/history-insights.tsx': "tab: 'trips'",
  'app/casino/simulator.tsx': "tab: 'tools'",
};
for (const [file, expected] of Object.entries(routeExpectations)) assert.ok(read(file).includes(expected), `${file} does not route to ${expected}`);

console.log('PASS Build 400 Casino Command Center reachability, attribution, assumptions, scope, and formula regression');
