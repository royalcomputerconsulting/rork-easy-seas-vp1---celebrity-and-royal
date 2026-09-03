const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const theme = read('constants/theme.ts');
const section = read('components/ui/ThemedSectionCard.tsx');

const expectedGradients = [
  "['#0F2247', '#1C2F7A', '#0E7FA7']",
  "['#123D73', '#0E7FA7', '#3D87BF']",
  "['#0F2247', '#123D73', '#16755F']",
  "['#0E7FA7', '#3D87BF', '#123D73']",
  "['#22201E', '#2C1D9A', '#D87924']",
  "['#0F2247', '#4A4A4A', '#8C3FC8']",
  "['#123D73', '#58585B', '#0E7FA7']",
];
for (const gradient of expectedGradients) assert.ok(theme.includes(gradient), `missing distinct tab gradient ${gradient}`);
assert.match(section, /\[palette\.soft, colors\.surface\]/, 'section headers must use their nautical/tier soft color instead of a transparent white strip');
for (const [file, marker] of [
  ['app/(tabs)/(overview)/index.tsx', 'offers-hero-banner-image'],
  ['app/(tabs)/scheduling.tsx', 'TabIdentityBand tab="cruises"'],
  ['app/(tabs)/booked.tsx', 'TabIdentityBand tab="booked"'],
  ['app/(tabs)/events.tsx', 'TabIdentityBand tab="calendar"'],
  ['app/(tabs)/analytics.tsx', 'TabIdentityBand tab="casino"'],
  ['app/(tabs)/machines.tsx', 'TabIdentityBand tab="slots"'],
  ['app/(tabs)/settings.tsx', 'TabIdentityBand tab="settings"'],
]) assert.ok(read(file).includes(marker), `${file} must retain its photo-led tab identity`);
const offers = read('app/(tabs)/(overview)/index.tsx');
assert.match(offers, /easyseas-scott-astin-logo\.jpeg/, 'Offers must use the proper Easy Seas logo as its complete top identity panel');
assert.doesNotMatch(offers, /Your next voyage starts here/, 'Offers must not duplicate the logo with a marketing-copy hero box');
assert.match(offers, /Easy Seas logo by Scott Astin/, 'Offers must retain the exact Easy Seas logo at the top');
const ask = read('app/ask-my-data.tsx');
assert.match(ask, /offers-certificates-v1\.png/);
assert.match(ask, /styles\.nauticalBackdrop/);
assert.match(read('app/certificate-codes.tsx'), /certificate-codes-artwork/);
assert.match(read('components/AgentXChat.tsx'), /\{message\.contextSummary\}/, 'chat must disclose the actual AI/local evidence path');
const chat = read('components/AgentXChat.tsx');
assert.match(chat, /disabled=\{isTranscribing \|\| isRecording\}/, 'the iOS Send target must not swallow the first tap while TextInput state is committing');
assert.match(chat, /const trimmedInput = manualInputRef\.current\.trim\(\)/, 'Send must read the synchronous native input mirror');

console.log('PASS Build 446 visual system uses seven distinct nautical identities, colored section surfaces, photo-led Agent SEA/certificates, and visible answer provenance.');
