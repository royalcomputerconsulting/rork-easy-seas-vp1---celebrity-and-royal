const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const casino = read('components/casino/CasinoCommandCenter.tsx');
const booked = read('app/(tabs)/booked.tsx');
const agenda = read('app/day-agenda.tsx');
const todayOnCruise = read('app/today-on-cruise.tsx');
const calendar = read('app/(tabs)/events.tsx');
const offers = read('app/(tabs)/(overview)/index.tsx');
const agentSea = read('app/ask-my-data.tsx');
const agentChat = read('components/AgentXChat.tsx');
const certificateCodes = read('app/certificate-codes.tsx');
const certificateSummary = read('app/certificate-summary.tsx');
const rootLayout = read('app/_layout.tsx');

if (!casino.includes("confidence ?? '').trim().toLowerCase() === 'missing' ? '—' : value")) {
  throw new Error('Casino metrics can still present missing data as a real zero value.');
}
if (!casino.includes("displayValue === '—' ? 'Data not available'")) {
  throw new Error('Casino missing-data metrics do not expose a truthful accessibility label.');
}

if (!booked.includes('<VoyageWeatherSection cruise={nextCruise} />')) {
  throw new Error('Booked is missing its single upcoming-voyage weather owner.');
}
if (booked.includes('MarineAlertsPanel') || booked.includes('booked-voyage-alerts-section')) {
  throw new Error('Booked still renders a second marine/weather presentation outside its one upcoming-voyage section.');
}
if (!booked.includes('title="Upcoming voyage weather"')) {
  throw new Error('Booked weather does not have one canonical section title.');
}
if (!booked.includes('const hasCasinoCruiseData = casinoStats.completedCount > 0;')) {
  throw new Error('Booked casino summaries cannot distinguish absent cruise evidence from a legitimate zero.');
}
for (const guardedValue of [
  "hasCasinoCruiseData ? formatCurrency(casinoStats.totalCoinIn) : '—'",
  "hasCasinoCruiseData ? formatCurrency(casinoStats.totalRetailValue) : '—'",
  "hasCasinoCruiseData ? formatCurrency(casinoStats.totalPaid) : '—'",
]) {
  if (!booked.includes(guardedValue)) throw new Error(`Booked still presents missing casino data as zero: ${guardedValue}`);
}
if (!agenda.includes('<VoyageWeatherSection')) {
  throw new Error('Day Agenda is missing its weather owner.');
}
if (todayOnCruise.includes('VoyageWeatherSection') || todayOnCruise.includes('SailingWeatherCard')) {
  throw new Error('Today on My Cruise duplicates weather outside Booked and Day Agenda.');
}

if (calendar.includes('Sea View Calendar')) {
  throw new Error('Draft calendar copy is still visible.');
}
if (!agenda.includes('Today’s Priorities')) {
  throw new Error('Today’s Priorities is not owned by Day Agenda.');
}
if (offers.includes('Mode-aware home') || offers.includes('Today’s Priorities') || offers.includes("Today's Priorities")) {
  throw new Error('Offers still owns the Today’s Priorities experience.');
}

if (agentSea.includes('<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionBar}')) {
  throw new Error('Agent SEA top actions can still clip inside a horizontally scrolling toolbar.');
}
for (const actionId of [
  'ask-my-data-new-conversation',
  'ask-my-data-toggle-filters',
  'agent-sea-save-conversation',
  'agent-sea-print-conversation',
  'agent-sea-export-log',
]) {
  if (!agentSea.includes(`testID="${actionId}"`)) throw new Error(`Agent SEA action is missing: ${actionId}`);
}
if (!agentChat.includes('const trimmedInput = manualInputRef.current.trim();')) {
  throw new Error('Agent SEA Send is still vulnerable to a stale React input-state commit on first tap.');
}
if (!agentChat.includes('lastManualSubmitRef.current = { content: trimmedInput, at: now };')) {
  throw new Error('Agent SEA Send does not guard against accidental rapid duplicate submissions.');
}

for (const [name, source] of [
  ['Certificate Codes', certificateCodes],
  ['Cert Summary', certificateSummary],
]) {
  if (!source.includes('<Stack.Screen options={{ headerShown: false }} />')) {
    throw new Error(`${name} still exposes the raw Expo Router route-name header above its designed page title.`);
  }
}
if (!rootLayout.includes('headerShown: false,\n    headerBackTitle: "Back"')) {
  throw new Error('The root navigation stack can still add an unstyled raw route-name heading above nested screens.');
}

console.log('Build 445 truth, weather ownership, and single-title contract passed.');
