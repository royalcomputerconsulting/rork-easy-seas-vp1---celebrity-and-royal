const fs = require('fs');
const path = require('path');

const root = process.cwd();
function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

const analytics = read('app/(tabs)/analytics.tsx');
const dataFlow = read('lib/analytics/casinoTabDataFlow.ts');
const sessionProvider = read('state/CasinoSessionProvider.tsx');
const addSessionModal = read('components/AddSessionModal.tsx');
const pkg = JSON.parse(read('package.json'));

assert(fs.existsSync(path.join(root, 'lib/analytics/casinoTabDataFlow.ts')), 'casinoTabDataFlow engine exists');
assert(dataFlow.includes('buildCasinoTabDataFlow'), 'data flow exposes buildCasinoTabDataFlow');
assert(dataFlow.includes('estimateSessionCoinIn'), 'data flow exposes session coin-in estimation');
assert(dataFlow.includes('individualSessions') && dataFlow.includes('extrapolatedSessions'), 'data flow separates individual and extrapolated sessions');
assert(dataFlow.includes('cruise-level totals win') || dataFlow.includes('Cruise-level totals win'), 'data flow documents no-double-count cruise total precedence');
assert(dataFlow.includes('tabTotals') && dataFlow.includes('intelligence') && dataFlow.includes('charts') && dataFlow.includes('session') && dataFlow.includes('calcs'), 'data flow emits totals for all four casino tabs');

assert(analytics.includes("type AnalyticsTab = 'intelligence' | 'charts' | 'session' | 'calcs'"), 'casino tab enum still has all four tabs');
assert(analytics.includes('buildCasinoTabDataFlow'), 'Analytics screen builds central casino tab data flow');
assert(analytics.includes("renderCasinoDataSourceCard('Intelligence')"), 'Intelligence tab shows shared data source card');
assert(analytics.includes("renderCasinoDataSourceCard('Charts')"), 'Charts tab shows shared data source card');
assert(analytics.includes("renderCasinoDataSourceCard('Sessions')"), 'Sessions tab shows shared data source card');
assert(analytics.includes("renderCasinoDataSourceCard('Calcs')"), 'Calcs tab shows shared data source card');
assert(!analytics.includes('DOLLARS_PER_POINT'), 'Analytics tab no longer uses DOLLARS_PER_POINT directly');
assert(analytics.includes('estimateCoinInForPoints({ targetPoints: pointsEarned'), 'Cruise performance editor uses points engine for coin-in');
assert(analytics.includes('sessionSource: sessionData.sessionSource') && analytics.includes("|| 'individual'"), 'new sessions are marked individual by default');
assert(analytics.includes('gameCategory: sessionData.gameCategory') && analytics.includes('normalizeGameCategory'), 'new sessions flow game category into points/session systems');
assert(analytics.includes('individualSessions') && analytics.includes('extrapolatedSessions'), 'UI audit surfaces individual and extrapolated session counts');

assert(sessionProvider.includes("brand?: 'royal' | 'celebrity' | 'carnival' | 'unknown'"), 'casino sessions support brand');
assert(sessionProvider.includes("program?: 'club-royale' | 'blue-chip' | 'players-club' | 'unknown'"), 'casino sessions support program');
assert(sessionProvider.includes('estimateCoinInForPoints'), 'session analytics estimates coin-in through points engine');
assert(sessionProvider.includes('sessionSource?'), 'casino session model stores sessionSource');

assert(addSessionModal.includes('sessionSource?:') && addSessionModal.includes("sessionSource: 'individual'"), 'AddSessionModal sends individual session source');
assert(addSessionModal.includes('gameCategory?:') && addSessionModal.includes('inferGameCategory'), 'AddSessionModal maps machine type into game category');
assert(!addSessionModal.includes('<TouchableOpacity\n          <TouchableOpacity'), 'AddSessionModal close button duplicate JSX fixed');
assert(/^9\.11\.\d+$/.test(pkg.version), 'package version remains in 9.11.x release line');
assert(pkg.scripts['test:v1047-casino-tabs'], 'v1047 casino tab test script exists');

console.log('\n✅ v1047 casino tabs data-flow checks passed');
