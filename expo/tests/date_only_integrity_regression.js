const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function loadStandaloneTs(relativePath, stubs = {}) {
  const filename = path.join(root, relativePath);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = new Module(filename, module);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod._compile(compiled, filename);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

const date = loadStandaloneTs('lib/date.ts');
const cruiseDays = loadStandaloneTs('lib/cruiseDayPipeline.ts', { './date': date });
const status = loadStandaloneTs('lib/bookedCruiseStatus.ts', {
  '@/lib/date': date,
  '@/lib/cruiseDayPipeline': cruiseDays,
});
const lifecycle = loadStandaloneTs('lib/lifecycleManager.ts', {
  '@/lib/date': date,
  '@/lib/cruiseDayPipeline': cruiseDays,
});

assert.equal(date.toCalendarDateOnly('2026-12-31T23:30:00-10:00'), '2026-12-31');
assert.equal(date.toCalendarDateOnly('04/02/26'), '2026-04-02');
assert.equal(date.toCalendarDateOnly('February 29, 2028'), '2028-02-29');
assert.equal(date.toCalendarDateOnly('2026-02-29'), undefined);
assert.equal(date.toCalendarDateOnly('not a date'), undefined);
assert.equal(Number.isNaN(date.createDateFromString('not a date').getTime()), true);
assert.equal(date.toCalendarDateOnly(date.addDays('2026-12-30', 3).toISOString()), '2027-01-02');
assert.equal(date.getDaysBetween('2026-12-30', '2027-01-02'), 3);
assert.equal(date.getDaysUntil('2026-12-31', new Date(2026, 11, 30, 22, 0, 0)), 1);
assert.equal(date.createUtcDateFromCalendarDate('2026-12-31T23:30:00-10:00').toISOString(), '2026-12-31T00:00:00.000Z');
assert.equal(date.createUtcDateFromLocalCalendarDay(new Date(2026, 11, 31, 23, 0, 0)).toISOString(), '2026-12-31T00:00:00.000Z');
assert.equal(Number.isNaN(date.createUtcDateFromCalendarDate('invalid').getTime()), true);

const marineAlerts = read('components/MarineAlertsPanel.tsx');
const weatherCard = read('components/SailingWeatherCard.tsx');
const agentX = read('state/AgentXProvider.tsx');
assert.match(marineAlerts, /createUtcDateFromCalendarDate/);
assert.doesNotMatch(marineAlerts, /new Date\(`\$\{day\.date\}T00:00:00`\)/);
assert.match(weatherCard, /createUtcDateFromLocalCalendarDay/);
assert.match(weatherCard, /getForecastForCruiseDay\(cruise, weatherTargetDate\)/);
assert.match(agentX, /dates\.push\(createUtcDateFromLocalCalendarDay\(cursor\)\)/);

const unknownSchedule = { id: 'unknown', sailDate: '2026-12-30', status: 'booked', nights: 0 };
assert.equal(status.isCompletedBookedCruise(unknownSchedule, new Date(2027, 0, 10)), false);
assert.equal(lifecycle.determineLifecycleState(unknownSchedule), 'upcoming');

const completedByDate = { id: 'completed', sailDate: '2026-12-30', returnDate: '2027-01-02', status: 'booked', nights: 3 };
assert.equal(status.isCompletedBookedCruise(completedByDate, new Date(2027, 0, 3)), true);
assert.equal(status.isInProgressBookedCruise(completedByDate, new Date(2026, 11, 31)), true);

const conflictedSchedule = { id: 'conflict', sailDate: '2026-12-30', returnDate: '2026-12-31', status: 'booked', nights: 3 };
assert.equal(status.isCompletedBookedCruise(conflictedSchedule, new Date(2027, 0, 10)), false);
assert.equal(lifecycle.determineLifecycleState(conflictedSchedule), 'upcoming');

const overlapping = lifecycle.findOverlappingCruises([
  { id: 'one', sailDate: '2026-12-30', returnDate: '2027-01-02', status: 'booked', nights: 3 },
  { id: 'two', sailDate: '2027-01-02', returnDate: '2027-01-05', status: 'booked', nights: 3 },
]);
assert.equal(overlapping.length, 1);

console.log('Date-only integrity regression checks passed');
