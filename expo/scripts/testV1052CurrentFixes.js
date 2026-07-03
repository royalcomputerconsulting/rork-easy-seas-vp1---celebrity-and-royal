const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const step1 = read('lib/royalCaribbean/step1_offers.ts');
assert(!step1.includes("codes.length > 0 && codes.length < 3 && finalRows.length < 150"), 'Step 1 still rejects valid 1-2 offer catalogs.');
assert(step1.includes('small-but-complete live catalog'), 'Step 1 small catalog guardrail explanation missing.');

const sync = read('state/RoyalCaribbeanSyncProvider.tsx');
assert(!sync.includes('royalTinyPartialCapture'), 'Sync provider still uses royalTinyPartialCapture.');
assert(!sync.includes('royalSmallMultiOfferCapture'), 'Sync provider still rejects smaller Royal catalogs.');
assert(sync.includes('visible live catalog can legitimately be small'), 'Sync provider missing small visible catalog log.');

const csv = read('lib/csv-export.ts');
assert(csv.includes("expo-file-system/legacy"), 'Crew/CSV export still imports deprecated non-legacy FileSystem API.');

const seapass = read('lib/seaPassWebPass.ts');
assert(seapass.includes('x: 886'), 'SeaPass Jul 5 date overlay has not been moved left under the time.');

const cruiseEvents = read('lib/calendar/cruiseEvents.ts');
assert(cruiseEvents.includes('getKnownCruiseItineraryDays'), 'Known itinerary resolver is missing.');
assert(cruiseEvents.includes('2026-07-12'), 'Star of the Seas 07-05-2026 return date hard-map missing.');
assert(cruiseEvents.includes('Perfect Day at CocoCay, Bahamas'), 'CocoCay day hard-map missing.');
assert(cruiseEvents.includes('Basseterre, St. Kitts & Nevis'), 'Basseterre day hard-map missing.');
assert(cruiseEvents.includes('Charlotte Amalie, St. Thomas'), 'Charlotte Amalie day hard-map missing.');

const dayAgenda = read('app/day-agenda.tsx');
assert(dayAgenda.includes('resolveAgendaItinerary'), 'Day Agenda does not resolve itinerary from trusted itinerary/ports and times.');
assert(dayAgenda.includes('findLinkedOfferForAgenda'), 'Day Agenda does not link offer Ports & Times.');
assert(dayAgenda.includes('getTrustedCruiseItineraryDays'), 'Day Agenda does not use known/weather-trusted itinerary data.');
assert(dayAgenda.includes('parsedOfferPorts'), 'Day Agenda does not fall back to linked offer Ports & Times.');

const passenger = read('lib/cruisePlanningIntelligence.ts');
assert(passenger.includes('getTrustedCruiseItineraryDays'), 'Schedule drill-down planner does not use trusted itinerary data.');
assert(passenger.includes('getNormalizedCruiseDateRange'), 'Schedule drill-down planner does not use normalized cruise date range.');

const pkg = JSON.parse(read('package.json'));
const app = JSON.parse(read('app.json'));
assert(pkg.version === '9.11.42', 'package version not bumped to 9.11.42');
assert(app.expo.version === '9.11.42', 'expo.version not bumped to 9.11.42');
assert(app.expo.ios.buildNumber === '9.11.42', 'iOS buildNumber not bumped to 9.11.42');
assert(app.expo.android.versionCode === 91142, 'Android versionCode not bumped to 91142');

console.log('✅ v1052 current fixes checks passed');
