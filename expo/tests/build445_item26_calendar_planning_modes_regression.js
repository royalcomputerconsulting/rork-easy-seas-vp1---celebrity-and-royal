const assert = require('node:assert/strict');
const fs = require('node:fs');

const events = fs.readFileSync('app/(tabs)/events.tsx', 'utf8');

for (const marker of [
  '<TabIdentityBand',
  '<ThemedSectionHeader',
  "testID={`calendar-view-${mode}`}",
  "'calendar-month-grid'",
  'calendar-tarot-month-grid',
  'testID="calendar-week-grid"',
  'testID="calendar-90-day-grid"',
  "testID={`calendar-90-day-${formatDateOnly(day.date)}`}",
]) assert.ok(events.includes(marker), `Calendar planning UI is missing ${marker}.`);

assert.match(events, /\(\['events', 'week', 'month', '90days', 'passenger'\] as ViewMode\[\]\)/);
assert.match(events, /mode === 'events' \? 'Agenda'[\s\S]*mode === '90days' \? '90 Days'/);

// Planning deadlines must be first-class calendar events rather than counts hidden elsewhere.
for (const marker of [
  'planningDeadlineEvents',
  'generated-offer-deadline-',
  'generated-certificate-deadline-',
  "title: 'Offer expires'",
  "title: 'Certificate expires'",
  '[...sourceCalendarEvents, ...planningDeadlineEvents]',
]) assert.ok(events.includes(marker), `Calendar deadline coverage is missing ${marker}.`);

// Every grid is actionable and reaches canonical detail/day routes.
assert.match(events, /onPress=\{\(\) => handleDayPress\(day\)\}/);
assert.match(events, /router\.push\(\{[\s\S]*pathname: '\/cruise-details'[\s\S]*buildCruiseDetailsParams\(cruise, \{ source: 'calendar' \}\)/);
assert.match(events, /pathname: '\/day-agenda'/);

// Tarot is strictly a month-only mode; returning to any normal planning mode exits it.
assert.match(events, /onPress=\{\(\) => \{[\s\S]*setTarotMonthMode\(false\);[\s\S]*setViewMode\(mode\);/);
assert.match(events, /setTarotMonthMode\(\(active\) => !active\);[\s\S]*setViewMode\('month'\);/);
assert.match(events, /!tarotMonthMode \? <IntelligenceFilterStrip/);
assert.match(events, /tarotMonthMode \? getTarotCardForDate/);

// Clear remains explicit, destructive, and connected to persisted Core Data.
assert.match(events, /Alert\.alert\([\s\S]*'Clear All Events'[\s\S]*coreData\.setCalendarEvents\(\[\]\)/);
assert.ok(events.includes('testID="clear-events-button"'));

// Crew is explicit, owner-aware, and remains a nested route rather than a new tab.
assert.ok(events.includes("router.push('/crew-recognition' as any)"));
assert.ok(events.includes('testID="calendar-open-crew-recognition"'));
assert.ok(events.includes('crewOwnerLabel'));
assert.ok(events.includes('Saved separately for the active user profile'));

console.log('PASS Build 445 Item 26 premium Agenda, Week, Month, 90-day, Tarot, deadlines, clearing, canonical navigation, and owner-aware Crew Recognition');
