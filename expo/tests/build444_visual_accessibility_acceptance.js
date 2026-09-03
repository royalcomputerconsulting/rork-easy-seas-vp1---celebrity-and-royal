const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const appJson = JSON.parse(read('app.json'));
assert.equal(appJson.expo.ios.supportsTablet, false, 'Build 444 remains intentionally iPhone-only; tablet verification must not be claimed.');

const design = read('constants/easySeasDesignSystem.ts');
for (const token of ['light:', 'dark:', 'highContrast:', "minimum: 44", "large: 54", 'COLOR_BLIND_SAFE_CHART_PALETTE']) {
  assert.ok(design.includes(token), `Missing adaptive design-system contract: ${token}`);
}

const experience = read('state/ExperienceProvider.tsx');
for (const contract of ['AccessibilityInfo.addEventListener', 'reduceMotionChanged', 'getTextScaleMultiplier', 'minimumControlSize', 'chartPalette', 'motionDuration']) {
  assert.ok(experience.includes(contract), `Experience provider is missing ${contract}.`);
}

const layout = read('app/(tabs)/_layout.tsx');
const fixedTabs = [
  ['Offers', 'tab-offers'], ['Cruises', 'tab-cruises'], ['Booked', 'tab-booked'],
  ['Calendar', 'tab-calendar'], ['Casino', 'tab-casino'], ['Slots', 'tab-slots'], ['Settings', 'tab-settings'],
];
let prior = -1;
for (const [label, testId] of fixedTabs) {
  const index = layout.indexOf(`title: "${label}"`);
  assert.ok(index > prior, `${label} is missing or out of the preserved seven-tab order.`);
  prior = index;
  assert.ok(layout.includes(`tabBarButtonTestID: "${testId}"`), `${label} lacks its stable interaction id.`);
}
assert.match(layout, /tabBarActiveTintColor: isDark \? colors\.accent : '#0E7FA7'/);
assert.match(layout, /backgroundColor: isDark \? colors\.surface : '#FFFFFF'/);
assert.match(layout, /minWidth: minimumControlSize/);

const identity = read('components/ui/TabIdentityBand.tsx');
for (const contract of [
  "from 'expo-image'", 'section-themes/offers-certificates-v1.png', 'section-themes/cruises-discovery-v1.png',
  'section-themes/booked-voyages-v1.png', 'section-themes/calendar-agenda-v1.png',
  'section-themes/casino-intelligence-v1.png', 'section-themes/slots-machines-v1.png',
  'section-themes/settings-trust-v1.png', 'cachePolicy="memory-disk"', 'accessibilityRole="header"',
  'onError={() => setArtworkFailed(true)}', "preferences.theme === 'high-contrast'",
]) assert.ok(identity.includes(contract), `Tab artwork shell is missing ${contract}.`);

const artwork = read('components/ui/PremiumVoyageArtwork.tsx');
for (const contract of ['cachePolicy="memory-disk"', 'transition={preferences.reducedMotion ? 0 : 180}', 'onError', 'LOCAL_ARTWORK', 'accessibilityIgnoresInvertColors']) {
  assert.ok(artwork.includes(contract), `Premium artwork is missing ${contract}.`);
}

const themedSections = read('components/ui/ThemedSectionCard.tsx');
assert.match(themedSections, /lineHeight: Math\.ceil\(titleFontSize \* 1\.25\)/);
assert.match(themedSections, /lineHeight: Math\.ceil\(subtitleFontSize \* 1\.35\)/);
assert.match(themedSections, /minHeight: 44/);

const adaptiveRoots = [
  'app/(tabs)/(overview)/index.tsx', 'app/(tabs)/scheduling.tsx', 'app/(tabs)/booked.tsx',
  'app/(tabs)/events.tsx', 'app/(tabs)/analytics.tsx', 'app/(tabs)/machines.tsx', 'app/(tabs)/settings.tsx',
];
for (const relative of adaptiveRoots) {
  const source = read(relative);
  assert.match(source, /useExperience\(\)/, `${relative} does not consume the owner-scoped experience preferences.`);
  assert.match(source, /experienceColors\.(background|surface|pageGradient)/, `${relative} does not apply the adaptive palette to its root surface.`);
}

const progress = read('components/ui/ProgressBar.tsx');
assert.match(progress, /flexWrap: 'wrap'/);
assert.match(progress, /flexShrink: 1/);
assert.match(progress, /accessibilityRole="progressbar"/);
const dashboard = read('components/CompactDashboardHeader.tsx');
assert.match(dashboard, /preferences\.theme === 'high-contrast'/);
assert.match(dashboard, /minWidth: minimumControlSize/);
assert.match(dashboard, /accessibilityLabel="Open settings"/);
assert.match(dashboard, /solo nights/);
const scheduling = read('app/(tabs)/scheduling.tsx');
assert.match(scheduling, /minWidth: minimumControlSize, minHeight: minimumControlSize/);

const fontFiles = [
  'assets/fonts/source-serif-4/SourceSerif4-Regular.ttf',
  'assets/fonts/source-serif-4/SourceSerif4-Semibold.ttf',
  'assets/fonts/source-serif-4/SourceSerif4-Bold.ttf',
];
for (const relative of fontFiles) assert.ok(fs.statSync(path.join(root, relative)).size > 10_000, `${relative} is missing or empty.`);

const pngDimensions = (relative) => {
  const bytes = fs.readFileSync(path.join(root, relative));
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG', `${relative} is not a PNG.`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};
for (const relative of [
  'assets/images/section-themes/offers-certificates-v1.png',
  'assets/images/section-themes/cruises-discovery-v1.png',
  'assets/images/section-themes/booked-voyages-v1.png',
  'assets/images/section-themes/calendar-agenda-v1.png',
  'assets/images/section-themes/casino-intelligence-v1.png',
  'assets/images/section-themes/slots-machines-v1.png',
  'assets/images/section-themes/settings-trust-v1.png',
]) {
  const dimensions = pngDimensions(relative);
  assert.ok(dimensions.width >= 1200 && dimensions.height >= 600, `${relative} is not a responsive high-resolution story asset.`);
}

console.log('PASS build444_visual_accessibility_acceptance');
