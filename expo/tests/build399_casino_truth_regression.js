const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function loadTs(relativeFile, dependencyMap = {}) {
  const filename = path.join(root, relativeFile);
  const output = ts.transpileModule(read(relativeFile), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: filename }).outputText;
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

const seasons = loadTs('lib/casino/casinoProgramSeasons.ts');
assert.deepEqual(
  { start: seasons.getCasinoProgramSeason('blue_chip', '2026-07-31').startDate, end: seasons.getCasinoProgramSeason('blue_chip', '2026-07-31').endDateExclusive },
  { start: '2025-08-01', end: '2026-08-01' },
);
assert.equal(seasons.getCasinoProgramSeason('blue_chip', '2026-08-01').startDate, '2026-08-01');
assert.equal(seasons.getCasinoProgramSeason('club_royale', '2026-03-31').startDate, '2025-04-01');
assert.equal(seasons.getCasinoProgramSeason('club_royale', '2026-04-01').startDate, '2026-04-01');

const truth = loadTs('lib/casino/casinoTruthEngine.ts', { './casinoProgramSeasons': seasons });
const royalCruise = { id:'star', shipName:'Star of the Seas', sailDate:'2026-07-05', returnDate:'2026-07-12', nights:7, brand:'royal', pointsEarned:6500, casinoStartingCash:200, casinoEndingCash:2032, cashResult:1832, itinerary:[{day:1,port:'Miami',isSeaDay:false},{day:2,port:'At Sea',isSeaDay:true},{day:3,port:'Cozumel',isSeaDay:false},{day:4,port:'At Sea',isSeaDay:true}] };
const royal = truth.buildCasinoCruiseTruth({ cruise: royalCruise, pointsPerHourFallback:400 });
assert.equal(royal.program, 'club_royale');
assert.equal(royal.hours.value, 16.25);
assert.equal(royal.hours.kind, 'estimated');
assert.equal(royal.coinIn.value, 32500);
assert.equal(royal.coinIn.kind, 'estimated');
assert.equal(royal.theoreticalLoss.value, 2600);
assert.equal(royal.netGamingResult.value, 1832);

const partialSessionMustNotReplaceCloseout = truth.buildCasinoCruiseTruth({
  cruise: { ...royalCruise, id: 'authoritative-closeout', pointsEarned: 6500, cashResult: 1832 },
  sessions: [{ id: 'partial', cruiseId: 'authoritative-closeout', date: '2026-07-06', durationMinutes: 60, pointsEarned: 400, cashIn: 100, cashOut: 150, recordKind: 'actual' }],
});
assert.equal(partialSessionMustNotReplaceCloseout.points.value, 6500, 'partial sessions must not replace the cruise closeout points total');
assert.equal(partialSessionMustNotReplaceCloseout.netGamingResult.value, 1832, 'partial sessions must not replace the cruise closeout gaming result');

const blue = truth.buildCasinoCruiseTruth({ cruise: { ...royalCruise, id:'edge', shipName:'Celebrity Edge', brand:'celebrity', casinoProgram:'blueChip' } });
assert.equal(blue.program, 'blue_chip');
assert.equal(blue.coinIn.value, null, 'Blue Chip points must not use Royal points x $5');
assert.equal(blue.theoreticalLoss.value, null);

const closeout = loadTs('lib/casino/postCruiseCloseout.ts');
const input = { ...closeout.EMPTY_POST_CRUISE_CLOSEOUT, startingCash:'200', endingCash:'2032', hoursPlayed:'12', pointsEarned:'6500', handpays:'0', handpaysIncludedInEndingCash:true, certificateCode:'2608C05' };
const patch = closeout.buildPostCruiseCloseoutPatch(input, { count:0, amount:0 }, '2026-08-22T00:00:00Z', { points:4800, pointsPerHour:400, source:'personal history' });
assert.equal(patch.cashResult, 1832);
assert.equal(patch.hoursPlayed, 12);
assert.equal(patch.expectedPointsForHours, 4800);
assert.equal(patch.pointsVsExpected, 1700);

const cert = loadTs('lib/casino/certificateEarningChain.ts');
const ambiguous = cert.linkCertificateToEarningCruise({ certificateCode:'SAME', completedCruises:[{id:'1',instantCertificateOfferCode:'SAME'},{id:'2',instantCertificateOfferCode:'SAME'}] });
assert.equal(ambiguous.likelyEarningCruise, null);
assert.match(ambiguous.warnings[0], /appears on 2 cruises/);
const exact = cert.linkCertificateToEarningCruise({ certificate:{cruiseId:'2',certificateCode:'SAME'}, completedCruises:[{id:'1',instantCertificateOfferCode:'SAME'},{id:'2',instantCertificateOfferCode:'SAME'}] });
assert.equal(exact.likelyEarningCruise.id, '2');
assert.equal(exact.confidence, 'high');

const casinoUi = read('components/casino/CasinoCommandCenter.tsx');
for (const label of ['Intelligence', 'Charts', 'Session', 'Calcs']) assert.ok(casinoUi.includes(`label: '${label}'`));
assert.match(casinoUi, /Blue Chip Club resets every August 1/);
assert.match(casinoUi, /InteractionManager\.runAfterInteractions/, 'charts must defer until tab navigation settles');
assert.match(casinoUi, /programTrips\.slice\(0, 12\)/, 'the mounted dashboard must bound portfolio rendering');
assert.match(casinoUi, /Points reconciliation/);
assert.match(casinoUi, /Points by cruise/);
assert.match(casinoUi, /Session performance/);
assert.match(read('app/casino-sessions.tsx'), /<FlatList/, 'long session lists must be virtualized');
assert.match(read('state/LoyaltyProvider.tsx'), /getCasinoProgramSeason\('blue_chip'/);
assert.doesNotMatch(read('state/CasinoSessionProvider.tsx').slice(read('state/CasinoSessionProvider.tsx').indexOf('const getSessionAnalytics'), read('state/CasinoSessionProvider.tsx').indexOf('const addQuickMachineWin')), /totalPointsEarned \* 5/);
assert.match(read('state/AgentXProvider.tsx'), /Casino trip evidence/);
assert.match(read('state/AgentXProvider.tsx'), /Blue Chip resets August 1/);
const knownProfile = read('lib/knownProfileFallback.ts');
for (const row of [['2026-04-07', 800], ['2026-04-10', 3000], ['2026-04-15', 2000], ['2026-04-21', 860]]) {
  assert.ok(knownProfile.includes(`sailDate: '${row[0]}'`) && knownProfile.includes(`pointsEarned: ${row[1]}`), `missing current-year Quantum fixture ${row.join(' / ')}`);
}
assert.match(read('hooks/useCasinoLedger.ts'), /allCruiseEconomicsSummary/);
assert.match(read('app/casino/ship-performance.tsx'), /allCruiseEconomicsSummary\.rows\.filter\(\(row\) => row\.status === 'completed'\)/);

console.log('PASS Build 399 casino truth, program seasons, cruise summary, certificate linkage, and Ask My Data regression');
