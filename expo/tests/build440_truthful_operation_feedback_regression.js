const assert = require('assert');
const fs = require('fs');

const read = (path) => fs.readFileSync(path, 'utf8');

const status = read('components/ui/OperationStatusCard.tsx');
assert.match(status, /running.*success.*error.*cancelled/s);
assert.match(status, /Final output or durable data commit verified/);
assert.match(status, /Existing app data was preserved/);
assert.match(status, /onCancel/);
assert.match(status, /onRetry/);
assert.match(status, /onUndo/);
assert.match(status, /onDismiss/);
assert.match(status, /accessibilityLiveRegion="polite"/);

const settings = read('app/(tabs)/settings.tsx');
assert.match(settings, /OperationStatusCard/);
for (const operation of ['save-all', 'load-all', 'certificate-export']) {
  assert.ok(settings.includes(operation), `Settings must report ${operation} truthfully`);
}
assert.match(settings, /committed:\s*true/);
assert.match(settings, /committed:\s*false/);

const weather = read('components/VoyageWeatherSection.tsx');
assert.match(weather, /OperationStatusCard/);
assert.match(weather, /Requesting route-aware weather and marine data for every itinerary day/);
assert.match(weather, /Existing saved weather remains available/);
assert.match(weather, /onRetry/);
assert.match(weather, /setPersistentExpanded\(true\)/);
assert.match(weather, /saved for offline use/);

const machines = read('app/(tabs)/machines.tsx');
assert.match(machines, /OperationStatusCard/);
assert.match(machines, /Saving favorite/);
assert.match(machines, /Undoing favorite change/);
assert.match(machines, /Exporting favorite machines/);
assert.match(machines, /Exporting machine library/);
assert.match(machines, /Writing machine.*of/s);
assert.match(machines, /onUndo/);

const atlasCard = read('components/AtlasCard.tsx');
assert.match(atlasCard, /accessibilityState=\{\{ selected: isFavorite \}\}/);
assert.match(atlasCard, /Add.*favorites/);
assert.match(atlasCard, /Remove.*favorites/);

const trust = read('app/data-trust-center.tsx');
assert.match(trust, /OperationStatusCard/);
assert.match(trust, /Integrity scan/);
assert.match(trust, /Applying verified repair/);
assert.match(trust, /applying only the previewed, unambiguous change/);
assert.match(trust, /repair history was updated/);
assert.match(trust, /onRetry/);

const royal = read('app/royal-caribbean-sync.tsx');
assert.match(royal, /preferences\.reducedMotion/);
assert.match(royal, /cancelSync/);
assert.match(royal, /state\.progress\.current/);

const certificates = read('app/certificate-codes.tsx');
assert.match(certificates, /downloadProgress\.completed/);
assert.match(certificates, /downloadProgress\.total/);
assert.match(certificates, /Stop after current certificate pair/);
assert.match(certificates, /Every completed PDF and parsed sailing row remains saved/);
assert.match(certificates, /Download Missing \/ Retry Failed/);

for (const path of [
  'components/ui/AnimatedActionButton.tsx',
  'components/ui/AnimatedProgressBar.tsx',
  'components/ui/PurposefulMotion.tsx',
]) {
  const source = read(path);
  assert.match(source, /reducedMotion/);
  assert.doesNotMatch(source, /Animated\.loop/);
}

console.log('Build 440 truthful operation feedback regression passed.');
