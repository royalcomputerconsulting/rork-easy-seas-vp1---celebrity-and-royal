const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const theme = read('constants/theme.ts');
for (const role of ['pageTitle', 'sectionTitle', 'cardTitle', 'body', 'caption', 'metric', 'badge', 'button']) {
  assert.match(theme, new RegExp(`\\b${role}:\\s*\\{`), `canonical ${role} typography role must remain defined`);
}
for (const token of [
  'grid: 8',
  'halfGrid: 4',
  'pagePadding: 16',
  'sectionGap: 24',
  'cardGap: 16',
  'cardPadding: 16',
  'cardRadius: 16',
  'minimumTarget: 44',
  'borderWidth: 1',
  'dividerWidth: 1',
]) {
  assert.ok(theme.includes(token), `shared component token ${token} must remain defined`);
}

for (const file of [
  'components/ui/EasySeasPrimitives.tsx',
  'components/ui/ThemedSectionCard.tsx',
  'components/ui/TabIdentityBand.tsx',
]) {
  const source = read(file);
  assert.match(source, /EASY_SEAS_TYPE_STYLES/, `${file} must use the canonical type roles`);
  assert.match(source, /EASY_SEAS_COMPONENT_TOKENS/, `${file} must use the canonical spacing and surface tokens`);
}

const primitives = read('components/ui/EasySeasPrimitives.tsx');
assert.ok(
  primitives.indexOf('<Text style={styles.metricLabel}') < primitives.indexOf('<Text style={styles.metricDetail}'),
  'Metric cards must present the conclusion before secondary detail',
);
assert.match(primitives, /headerPrimary:\s*\{\s*minHeight:\s*44/, 'primary header actions must retain a 44-point target');
assert.match(primitives, /headerOverflow:\s*\{\s*width:\s*44,\s*height:\s*44/, 'overflow actions must retain a 44-point target');

const highTrafficComponents = [
  'components/CompactDashboardHeader.tsx',
  'components/CasinoOfferCard.tsx',
  'components/IntelligenceFilterStrip.tsx',
  'components/CruiseCard.tsx',
  'components/ui/EasySeasPrimitives.tsx',
  'components/ui/ThemedSectionCard.tsx',
  'components/ui/TabIdentityBand.tsx',
];
for (const file of highTrafficComponents) {
  const source = read(file);
  assert.doesNotMatch(source, /fontSize:\s*(?:[0-9]|10)(?:\D|$)/, `${file} must not render metadata below 11 points`);
}

const casino = read('components/casino/CasinoCommandCenter.tsx');
assert.match(casino, /headerCopy:\s*\{\s*flex:\s*1,\s*minWidth:\s*0/, 'Casino heading must be allowed to reflow instead of clipping');
assert.match(casino, />Agent SEA</, 'Casino Agent SEA action must use a compact unclipped label');

console.log('build445 item 9 typography, spacing, and hierarchy regression passed');
