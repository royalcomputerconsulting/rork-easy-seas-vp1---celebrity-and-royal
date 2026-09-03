const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const picker = read('components/CruiseWeatherDayPicker.tsx');
assert.match(picker, /buildCruiseDayPlan/);
assert.match(picker, /onPress=\{\(\) => onSelectDate\(day\.date\)\}/);
assert.match(picker, /wave, and swell forecast/);

const marineAlerts = read('components/MarineAlertsPanel.tsx');
assert.match(marineAlerts, /onSelectForecastDay\?:/);
assert.match(marineAlerts, /onSelectForecastDay\?\.\(forecast\.cruiseId, forecast\.dateKey\)/);

const booked = read('app/(tabs)/booked.tsx');
assert.match(booked, /<VoyageWeatherSection cruise=\{nextCruise\} \/>/);

const agenda = read('app/day-agenda.tsx');
assert.match(agenda, /localData\.booked/);
assert.match(agenda, /dedupeBookedCruises/);
assert.match(agenda, /selectVoyageWeatherBlock/);
assert.match(agenda, /weatherVoyages\.map/);
assert.match(agenda, /cruise=\{voyage\}/);

const loyalty = read('state/LoyaltyProvider.tsx');
const explicitManualAuthority = loyalty.indexOf("hasProfileClubRoyalePoints && Boolean(currentUser?.loyaltyManualOverrideAt)");
const liveAuthority = loyalty.indexOf('else if (!shouldForceSeasonResetBalance && hasLiveClubRoyalePoints)');
const cachedProfileFallback = loyalty.indexOf('else if (!shouldForceSeasonResetBalance && hasProfileClubRoyalePoints)', liveAuthority + 1);
assert.ok(explicitManualAuthority >= 0 && liveAuthority > explicitManualAuthority && cachedProfileFallback > liveAuthority, 'explicit manual override must win, followed by provider sync, then cached profile fallback');

const carnivalScreen = read('app/carnival-sync.tsx');
assert.match(carnivalScreen, /authorizedStartPendingRef/);
assert.match(carnivalScreen, /setTimeout\(attemptAuthorizedStart, 750\)/);
assert.match(carnivalScreen, /same mounted screen/);
assert.match(carnivalScreen, /onPress=\{handleRunIngestion\}/);

const repository = read('lib/cruiseInventory/CruiseInventoryRepository.ts');
assert.match(repository, /sourceTotal: number/);
assert.match(repository, /offerSailingRelationships: number/);
assert.match(repository, /FROM cruise_offer_sailings relationships/);
const overview = read('app/(tabs)/(overview)/index.tsx');
assert.match(overview, /availableCruiseOptions=\{totalSourceCruises \|\| availableCruisesCount\}/);
const header = read('components/CompactDashboardHeader.tsx');
assert.match(header, /Sailing Options/);
assert.match(header, /unique departures/);

const agent = read('state/AgentXProvider.tsx');
assert.match(agent, /second, dependency-free Ask My Data pass/);
assert.match(agent, /const fallbackResponse = askMyDataSearch/);
assert.doesNotMatch(agent, /assistant service failed before returning an error/);

console.log('PASS Build 397 selectable marine days, shared loyalty balance, same-screen Carnival start, full sailing-option count, and local Ask My Data fallback regression');
