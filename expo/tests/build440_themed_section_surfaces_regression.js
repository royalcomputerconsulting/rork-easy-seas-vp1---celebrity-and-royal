const assert = require('assert');
const fs = require('fs');

const read = (path) => fs.readFileSync(path, 'utf8');

const primitive = read('components/ui/ThemedSectionCard.tsx');
assert.match(primitive, /export function ThemedSectionHeader/);
assert.match(primitive, /export function ThemedSectionCard/);
assert.match(primitive, /fontFamilyEditorialSemibold/);
assert.match(primitive, /preferences\.theme === 'high-contrast'/);
assert.match(primitive, /isDark/);
assert.match(primitive, /accessibilityRole="header"/);
assert.doesNotMatch(primitive, /TouchableOpacity|Pressable|onPress/);

const screens = {
  offers: 'app/(tabs)/(overview)/index.tsx',
  cruises: 'app/(tabs)/scheduling.tsx',
  booked: 'app/(tabs)/booked.tsx',
  calendar: 'app/(tabs)/events.tsx',
  casino: 'components/casino/CasinoCommandCenter.tsx',
  slots: 'app/(tabs)/machines.tsx',
  settings: 'app/(tabs)/settings.tsx',
};

for (const [tab, path] of Object.entries(screens)) {
  const source = read(path);
  assert.match(source, /ThemedSectionHeader/, `${tab} must consume the shared section identity`);
  assert.match(source, new RegExp(`tab=["']${tab}["']`), `${tab} must use its own visual theme`);
}

const coverage = Object.values(screens).reduce((total, path) => {
  return total + (read(path).match(/<ThemedSectionHeader/g) || []).length;
}, 0);
assert.ok(coverage >= 25, `expected at least 25 themed primary sections, found ${coverage}`);

for (const path of [
  'app/action-inbox.tsx',
  'app/certificate-portfolio.tsx',
  'app/relationship-explorer.tsx',
  'app/casino/relationship-intelligence.tsx',
]) {
  assert.match(read(path), /ThemedSectionHeader/, `${path} must preserve the section design in a critical nested workflow`);
}

const collapsible = read('components/ui/CollapsibleSection.tsx');
assert.match(collapsible, /tab\?: EasySeasTabThemeKey/);
assert.match(collapsible, /emoji\?: string/);
assert.match(collapsible, /reducedMotion|isDark|high-contrast/);

console.log(`Build 440 themed section regression passed (${coverage} primary themed sections).`);
