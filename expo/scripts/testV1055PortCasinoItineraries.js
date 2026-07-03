const fs = require('fs');
const path = require('path');

const root = process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const policy = read('lib/portCasinoRules.ts');
const known = read('lib/knownCruiseItineraries.ts');
const casino = read('lib/casinoAvailability.ts');
const agenda = read('app/day-agenda.tsx');
const calendar = read('lib/calendar/cruiseEvents.ts');
const appJson = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));

assert(policy.includes('perfect day at cococay'), 'CocoCay casino policy missing');
assert(policy.includes('charlotte amalie'), 'Charlotte Amalie casino policy missing');
assert(policy.includes('roatan'), 'Roatan casino policy missing');
assert(policy.includes('san juan'), 'San Juan casino policy missing');
assert(policy.includes('basseterre'), 'Basseterre casino policy missing');
assert(policy.includes('philipsburg'), 'Philipsburg casino policy missing');
assert(policy.includes('CASINO_DAY1_OPEN_AFTER_SAILAWAY_MINUTES = 60'), 'Day 1 one-hour sailaway rule missing');
assert(policy.includes("CASINO_DEFAULT_LATE_CLOSE_TIME = '02:30'"), 'Late-close 02:30 rule missing');
assert(policy.includes("CASINO_ALTERNATE_LATE_CLOSE_TIME = '03:00'"), 'Late-close 03:00 alternate missing');

assert(known.includes('celebrityEquinoxAugust62026Itinerary'), 'Celebrity Equinox Aug 2026 itinerary missing');
assert(known.includes("Ibiza, Spain") && known.includes("Tangier, Morocco") && known.includes("Lisbon, Portugal") && known.includes("Porto (Leixões), Portugal") && known.includes("A Coruña, Spain"), 'Celebrity Equinox ports missing');
assert(known.includes("arrival: '11:00'") && known.includes("departure: '09:00'"), 'Celebrity Equinox Ibiza overnight times missing');
assert(known.includes('starJuly52026Itinerary'), 'Star Jul 5 itinerary missing');

assert(casino.includes("from '@/lib/portCasinoRules'"), 'casinoAvailability not using port casino rules');
assert(casino.includes("from '@/lib/knownCruiseItineraries'"), 'casinoAvailability not using known itineraries');
assert(casino.includes('Using known researched itinerary'), 'casinoAvailability not preferring researched itinerary');
assert(casino.includes('CASINO_DAY1_OPEN_AFTER_SAILAWAY_MINUTES'), 'casinoAvailability not using one-hour day 1 rule');
assert(casino.includes('isCasinoOpenWhileDockedPort'), 'casinoAvailability not honoring open-while-docked ports');

assert(agenda.includes('getTrustedCruiseItineraryDays(cruise as unknown as BookedCruise)'), 'day agenda not using trusted itinerary days');
assert(!agenda.includes("startTime: '10:00'"), 'day agenda still hardcodes casino main hours to 10:00');
assert(calendar.includes('getCentralKnownCruiseItineraryDays'), 'calendar not using central known itineraries');

assert(pkg.version === '9.11.45', 'package version not bumped');
assert(appJson.expo.version === '9.11.45', 'app version not bumped');
assert(appJson.expo.ios.buildNumber === '9.11.45', 'iOS buildNumber not bumped');
assert(appJson.expo.android.versionCode === 91145, 'Android versionCode not bumped');

console.log('✅ v1055 port casino itinerary checks passed');
