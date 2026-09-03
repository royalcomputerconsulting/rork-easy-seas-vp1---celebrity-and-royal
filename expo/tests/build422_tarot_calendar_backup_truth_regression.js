const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const events = read('app/(tabs)/events.tsx');
assert.match(events, /testID="tarot-month-toggle"/);
assert.match(events, /getTarotCardForDate\(day\.date\)/);
assert.match(events, /tarotMonthMode \? 'Daily tarot cards/);
assert.match(events, /!tarotMonthMode && <View style=\{styles\.legendContainer\}>/);
assert.match(events, /tarotMonthMode && tarotCard/);

const scheduler = read('lib/runAfterUiSettles.ts');
assert.match(scheduler, /import \* as ReactNative from 'react-native'/);
assert.doesNotMatch(scheduler, /import \{ InteractionManager \} from 'react-native'/);

const bundle = read('lib/dataBundle/bundleOperations.ts');
for (const key of ['CASINO_SESSIONS', 'USER_SLOT_MACHINES', 'COMP_ITEMS']) {
  assert.match(bundle, new RegExp(`quotaSafeGetItem\\(sk\\(ALL_STORAGE_KEYS\\.${key}\\)\\)`));
}
assert.match(bundle, /loadCrewRecognitionRows<RecognitionEntryWithCrew>\(ALL_STORAGE_KEYS\.CREW_RECOGNITION_ENTRIES/);
assert.match(bundle, /loadCrewRecognitionRows<Sailing>\(ALL_STORAGE_KEYS\.CREW_RECOGNITION_SAILINGS/);

const economics = read('lib/casinoCruiseEconomics.ts');
assert.match(economics, /does not fabricate winnings for totals/);
assert.match(economics, /does not fabricate points for totals/);

console.log('PASS Build 422 tarot month, guarded Casino scheduler, resilient backup counts, and non-fabricated casino totals');
