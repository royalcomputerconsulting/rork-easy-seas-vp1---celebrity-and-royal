const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const slots = read('app/(tabs)/machines.tsx');
const provider = read('state/SlotMachineLibraryProvider.tsx');
const index = read('lib/machineIndexHelper.ts');
const detail = read('app/machine-detail/[id].tsx');

for (const [label, evidence] of [
  ['verified onboard map', 'machines-open-verified-atlas'],
  ['add-machine workflow', 'machines-add-machine'],
  ['global machine library', 'machines-browse-library'],
  ['machine condition history', 'MachineConditionLogsPanel'],
  ['session history', 'MachineSessionsList'],
  ['new session', 'machines.sessions.add'],
  ['favorite export', 'machines.exportFavorites'],
  ['complete export', 'machines.exportAll'],
  ['play-time preferences', 'PlayingHoursCard'],
]) {
  assert.ok(slots.includes(evidence), `${label} must remain reachable from Slots`);
}
assert.match(detail, /userNotes|Notes/, 'machine details must preserve saved notes');
assert.match(slots, /initialNumToRender=\{12\}/);
assert.match(slots, /maxToRenderPerBatch=\{16\}/);
assert.match(slots, /windowSize=\{10\}/);
assert.match(slots, /removeClippedSubviews=\{Platform\.OS !== 'web'\}/);
assert.match(slots, /keyExtractor=\{getSlotMachineListKey\}/);
assert.match(slots, /useFocusEffect\([\s\S]*?runAfterUiSettles\([\s\S]*?reload\(\)/, 'full local atlas hydration must begin from a Slots-focused request');

assert.doesNotMatch(index, /^import MACHINES_262_RAW/m, 'the 262-machine JSON must not be evaluated with the root provider module');
assert.match(index, /function loadBundledMachines\(\)/, 'the offline atlas must have an explicit lazy loader');
assert.match(index, /require\('@\/assets\/MACHINES_262\.json'\)/, 'the offline atlas must remain packaged for on-demand use');
assert.match(provider, /hydrationRequestedRef\.current = true/, 'reload must explicitly record an on-demand hydration request');
assert.match(provider, /if \(!hydrationRequestedRef\.current\) return;/, 'Pro entitlement must not trigger full atlas loading during ordinary navigation');
assert.match(provider, /Shared-library cloud backfill is intentionally manual/, 'startup must not upload or backfill the full machine domain');

console.log('PASS Build 445 Item 33 Slots functions and deferred-performance regression.');
