const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const disclosure = read('components/ui/ProgressiveDisclosure.tsx');
assert.match(disclosure, /conclusions\.slice\(0, 3\)/, 'analytical summaries must never begin with more than three conclusions');
assert.match(disclosure, /loadDisclosure\(ownerId, screenId, sectionId, defaultOpen\)/, 'expanded state must restore per owner and section');
assert.match(disclosure, /saveDisclosure\(ownerId, screenId, sectionId, next\)/, 'expanded state must persist per owner and section');
assert.match(disclosure, /open \? <View[\s\S]*?\{children\}/, 'secondary evidence must not mount until the disclosure is open');
assert.match(disclosure, /Show evidence and formulas/, 'collapsed controls must explain what additional evidence contains');
assert.match(disclosure, /minimumControlSize/, 'disclosure controls must preserve accessible targets');

const casino = read('components/casino/CasinoCommandCenter.tsx');
for (const id of [
  'casino-points-reconciliation-disclosure',
  'casino-annual-host-evidence-disclosure',
  'casino-play-assumptions-disclosure',
  'casino-calculation-guardrails-disclosure',
]) {
  assert.ok(casino.includes(id), `Casino must keep ${id} behind persisted progressive disclosure`);
}
const topDisclosureStart = casino.indexOf('title="Casino truth at a glance"');
const topDisclosureEnd = casino.indexOf('</ProgressiveDisclosure>', topDisclosureStart);
const provenanceIndex = casino.indexOf('<EntityProvenanceDisclosure', topDisclosureStart);
assert.ok(topDisclosureStart >= 0 && provenanceIndex > topDisclosureStart && provenanceIndex < topDisclosureEnd, 'Casino source records must remain inside the top evidence disclosure');

for (const file of [
  'app/data-trust-center.tsx',
  'app/certificate-portfolio.tsx',
  'app/relationship-explorer.tsx',
]) {
  assert.match(read(file), /<ProgressiveDisclosure/, `${file} must begin its analytics with conclusions-first disclosure`);
}

const agent = read('components/AgentXChat.tsx');
assert.match(agent, /View evidence \(\$\{message\.sourceReferences\.length\}\)/, 'Agent SEA must keep answer evidence collapsed behind an explicit control');

console.log('build445 item 12 progressive disclosure regression passed');
