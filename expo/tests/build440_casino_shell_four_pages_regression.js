const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const command = fs.readFileSync(path.join(root, 'components/casino/CasinoCommandCenter.tsx'), 'utf8');
const route = fs.readFileSync(path.join(root, 'app/(tabs)/analytics.tsx'), 'utf8');
const economics = fs.readFileSync(path.join(root, 'hooks/useCasinoEconomicsData.ts'), 'utf8');

for (const [id, label] of [
  ['intelligence', 'Intelligence'],
  ['charts', 'Charts'],
  ['session', 'Play'],
  ['calcs', 'Calcs'],
]) {
  assert.ok(command.includes(`{ id: '${id}', label: '${label}' }`), `missing Casino destination ${label}`);
  assert.match(command, new RegExp(`activeTab === '${id}'`));
}

assert.match(command, /TabIdentityBand tab="casino"/);
assert.match(command, /ProgressiveDisclosure/);
assert.match(command, /PremiumVoyageArtwork/);
assert.match(command, /EntityProvenanceDisclosure/);
assert.match(command, /setTimeout\(\(\) => setChartsReady\(true\), 0\)/);
assert.doesNotMatch(command, /from '@\/lib\/runAfterUiSettles'|runAfterUiSettles\(/);
assert.doesNotMatch(route, /DeferredCasinoCommandCenter|from '@\/lib\/runAfterUiSettles'|runAfterUiSettles\(/);
assert.match(route, /<CasinoCommandCenter \/>/);
assert.match(route, /casino-safe-retry/);
assert.match(route, /casino-safe-data-health/);

assert.match(economics, /filterRecordsForProfile/);
assert.match(economics, /scopedProfile/);
assert.match(command, /filterRecordsForProfile\(allSessions, casinoProfile, users\)/);
assert.match(command, /filterRecordsForProfile\(allSearchableCertificates, casinoProfile, users\)/);

for (const tool of ['Royal receipt importer', 'Host CRM', 'Certificate wallet', 'Value scenarios', 'Completed sailings']) {
  assert.ok(command.includes(tool), `unreachable Casino tool: ${tool}`);
}

console.log('Build 440 Casino shell and four functional pages regression passed.');
