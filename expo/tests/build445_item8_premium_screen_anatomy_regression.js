const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const theme = read('constants/theme.ts');
const primitives = read('components/ui/EasySeasPrimitives.tsx');
const sections = read('components/ui/ThemedSectionCard.tsx');
const identity = read('components/ui/TabIdentityBand.tsx');

for (const token of ['#F3F3F2', '#F5F5F4', '#D5D5D0', '#333334', '#1C2F7A', '#0E7FA7']) {
  assert.ok(theme.includes(token), `shared SeaPass token ${token} must remain available`);
}
assert.match(primitives, /fontFamilyEditorialSemibold/, 'page and story titles must use Source Serif');
assert.match(primitives, /backgroundColor: C\.surface/, 'dense facts must use the readable shared surface');
assert.match(sections, /Story photography belongs in PremiumVoyageArtwork/, 'section cards must keep art behind story content, not dense facts');
assert.match(sections, /backgroundColor: colors\.surface/, 'section fact surfaces must use the experience surface');
assert.match(identity, /cachePolicy="memory-disk"/, 'tab artwork must be nonblocking and cached');
assert.match(identity, /artworkFailed/, 'tab artwork must have a neutral fallback');

const tabFiles = {
  offers: 'app/(tabs)/(overview)/index.tsx',
  cruises: 'app/(tabs)/scheduling.tsx',
  booked: 'app/(tabs)/booked.tsx',
  calendar: 'app/(tabs)/events.tsx',
  casino: 'components/casino/CasinoCommandCenter.tsx',
  slots: 'app/(tabs)/machines.tsx',
  settings: 'app/(tabs)/settings.tsx',
};
for (const [tab, file] of Object.entries(tabFiles)) {
  const source = read(file);
  if (tab === 'offers') {
    assert.ok(source.includes('offers-hero-banner-image'), 'Offers must render the non-negotiable Easy Seas logo treatment first');
    assert.doesNotMatch(source, /<TabIdentityBand tab="offers"/, 'Offers must not place a generic identity blurb beneath the logo');
  } else {
    assert.ok(source.includes('TabIdentityBand'), `${tab} must render the shared photorealistic identity band`);
  }
  assert.ok(source.includes('ThemedSectionHeader') || source.includes('ThemedSectionCard'), `${tab} must use shared editorial section anatomy`);
}

const premiumNestedScreens = [
  'app/ask-my-data.tsx',
  'app/import-review.tsx',
  'app/import-cruises.tsx',
  'app/royal-caribbean-sync.tsx',
  'app/learn-system.tsx',
  'app/certificate-codes.tsx',
  'app/certificate-summary.tsx',
  'app/certificate-summary-results.tsx',
  'app/certificate-lookup.tsx',
  'app/certificate-portfolio.tsx',
  'app/certificate-stacking-ledger.tsx',
  'app/day-agenda.tsx',
  'app/today-on-cruise.tsx',
  'app/paywall-monthly.tsx',
];
for (const file of premiumNestedScreens) {
  const source = read(file);
  assert.ok(
    source.includes('#F3F3F2') || source.includes("backgroundColor: C.background") || source.includes('colors.background'),
    `${file} must expose the premium warm-white page surface`,
  );
}

const legacyTheme = read('constants/darkRoyalTheme.ts');
assert.match(legacyTheme, /background:\s*'#F3F3F2'/, 'legacy consumers must inherit a light compatibility canvas');
assert.match(legacyTheme, /card:\s*'#FFFFFF'/, 'legacy consumers must inherit white cards');

const loyaltyTheme = read('constants/loyaltyTheme.ts');
assert.match(loyaltyTheme, /gradientColors:\s*\['#FFFFFF', '#F8FAFB', '#F3F3F2'\]/, 'loyalty cards must use a neutral Easy Seas surface');
assert.match(loyaltyTheme, /progressBarGradient:\s*\[resolvedAccent, progressEnd\]/, 'tier colors must remain bounded to progress evidence');

const offers = read('app/(tabs)/(overview)/index.tsx');
assert.ok(offers.indexOf('offers-hero-banner-image') < offers.indexOf('offers-loyalty-progress-section'), 'Offers must place the non-negotiable Easy Seas logo before operational sections');
assert.doesNotMatch(offers, /Mode-aware home/, 'Offers must not expose the unexplained mode-aware home block');
const dayAgenda = read('app/day-agenda.tsx');
assert.match(dayAgenda, /Today’s Priorities/, 'Today priorities must live on Day Agenda');
assert.match(dayAgenda, /day-agenda-todays-priorities/, 'Today priorities must be a reachable Day Agenda action');

const cruiseCard = read('components/CruiseCard.tsx');
assert.match(cruiseCard, /Every catalog card keeps the same[\s\S]*SeaPass surface/, 'catalog status must not recolor an entire cruise card');
assert.match(cruiseCard, /\['#FFFFFF', '#F5F5F4', '#F3F3F2'\]/, 'available cruise cards must use neutral premium surfaces');

console.log('build445 item 8 premium screen anatomy regression passed');
