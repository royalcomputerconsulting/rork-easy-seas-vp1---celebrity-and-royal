const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function loadTs(relativeFile, dependencyMap = {}) {
  const filename = path.join(root, relativeFile);
  const output = ts.transpileModule(read(relativeFile), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const old = Module._load;
  Module._load = (request, parent, main) => request in dependencyMap ? dependencyMap[request] : request.startsWith('@/') ? {} : old(request, parent, main);
  try {
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(output, filename);
    return mod.exports;
  } finally { Module._load = old; }
}

const known = loadTs('lib/knownProfileFallback.ts', {
  '@/lib/casinoAnnualReportFacts': { ANNUAL_CASINO_REPORT_FACTS: [] },
  '@/lib/casinoPointTruth': { CONFIRMED_CLUB_ROYALE_2025_POINTS: 58680 },
});
const current = known.CURRENT_CLUB_ROYALE_CONFIRMED_CRUISES;
assert.equal(current.length, 4);
assert.equal(current.reduce((sum, cruise) => sum + cruise.pointsEarned, 0), 6660);
assert.equal(current.reduce((sum, cruise) => sum + cruise.nights, 0), 16);
assert.equal(current.reduce((sum, cruise) => sum + cruise.cashResult, 0), 6715);
assert.deepEqual(current.map((cruise) => cruise.pointsEarned), [800, 3000, 2000, 860]);

const seasons = loadTs('lib/casino/casinoProgramSeasons.ts');
const cruiseIdentity = loadTs('lib/casino/casinoCruiseIdentity.ts');
const truth = loadTs('lib/casino/casinoTruthEngine.ts', { './casinoProgramSeasons': seasons, './casinoCruiseIdentity': cruiseIdentity });
const currentTruth = current.map((cruise) => truth.buildCasinoCruiseTruth({ cruise: { ...cruise, slotPointsConfirmed: true }, pointsPerHourFallback: 400, houseEdgeFallback: 0.08 }));
assert.equal(currentTruth.reduce((sum, cruise) => sum + cruise.coinIn.value, 0), 33300);
assert.equal(currentTruth.reduce((sum, cruise) => sum + cruise.theoreticalLoss.value, 0), 2664);
assert.equal(currentTruth.reduce((sum, cruise) => sum + cruise.netGamingResult.value, 0), 6715);

const scenario = loadTs('lib/casino/theoreticalLoss.ts');
const theo = scenario.calculateTheoreticalLoss({ coinIn: 33300, assumedHoldPercent: 8, actualNetResult: 6715, earnedCompValue: 0 });
assert.equal(theo.theoreticalLoss, 2664);
assert.equal(theo.actualLoss, 0, 'a positive gaming result is not an actual loss');

const adtLib = loadTs('lib/casino/adtScenario.ts');
const adt = adtLib.calculateAdtScenario({ totalCoinIn: 33300, daysPlayed: 16, assumedHoldPercent: 8 });
assert.equal(adt.coinInPerDay, 2081.25);
assert.equal(adt.estimatedTheoPerDay, 166.5);

const ledgerHook = read('hooks/useCasinoLedger.ts');
assert.match(ledgerHook, /allCruiseEconomicsSummary/);
assert.doesNotMatch(ledgerHook, /rowByCruiseId = new Map\(cruiseEconomicsSummary\.rows/);
assert.match(read('components/casino/CasinoCommandCenter.tsx'), /allCruiseEconomicsSummary\.rows/);
assert.match(read('app/casino/ship-performance.tsx'), /row\.status === 'completed'/);
assert.match(read('app/casino/completed-sailings.tsx'), /row\.status === 'completed'/);
const economics = read('lib/casinoCruiseEconomics.ts');
assert.match(economics, /explicitGamingResult = getFirstNumber\(cruiseForEconomics\.cashResult, cruiseForEconomics\.netResult\)/);
assert.match(economics, /totalEconomicValue = calcTotalEconomicValue\(retailForCalc, winningsBroughtHome, netEffectivePaid\)/);

console.log('PASS Build 402 complete casino calculations: current-year points, coin-in, theo, gaming result, ADT, source precedence, and all-cruise screen scope');
