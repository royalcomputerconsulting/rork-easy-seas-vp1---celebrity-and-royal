const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const designSystem = read('constants/easySeasDesignSystem.ts');
const layout = read('app/_layout.tsx');
const primitives = read('components/ui/EasySeasPrimitives.tsx');
const intelligenceFilters = read('components/IntelligenceFilterStrip.tsx');
const minimalistFilters = read('components/ui/MinimalistFilterBar.tsx');
const cleanFilterTabs = read('components/ui/CleanFilterTabs.tsx');
const cruises = read('app/(tabs)/scheduling.tsx');
const offers = read('app/(tabs)/(overview)/index.tsx');
const favoriteStaterooms = read('components/favorite-staterooms/FavoriteStateroomsSection.tsx');
const slots = read('app/(tabs)/machines.tsx');
const calendar = read('app/(tabs)/events.tsx');

for (const token of [
  "background: '#F7F3EC'",
  "surface: '#FFFCF7'",
  "accent: '#17324D'",
  "accentSecondary: '#167C80'",
  'pageGradient:',
  "highContrast:",
]) {
  if (!designSystem.includes(token)) throw new Error(`Missing shared nautical design token: ${token}`);
}

for (const font of ['SourceSerif4-Regular', 'SourceSerif4-SemiBold', 'SourceSerif4-Bold']) {
  if (!layout.includes(font)) throw new Error(`Source Serif runtime registration is missing: ${font}`);
}

for (const primitive of ['NauticalPageShell', 'minimumControlSize', 'preferences.reducedMotion', 'colors.pageGradient']) {
  if (!primitives.includes(primitive)) throw new Error(`Shared adaptive primitive is missing: ${primitive}`);
}

if (!minimalistFilters.includes('const visibleActions = actions;')) {
  throw new Error('MinimalistFilterBar is suppressing actions supplied by consuming screens.');
}
if (minimalistFilters.includes("actions.filter(action => action.key === 'alerts'")) {
  throw new Error('Legacy action suppression returned to MinimalistFilterBar.');
}

for (const source of [intelligenceFilters, minimalistFilters, cleanFilterTabs]) {
  for (const requirement of ['useExperience', 'colors.surface', 'colors.border', 'minimumControlSize']) {
    if (!source.includes(requirement)) throw new Error(`Filter system is not using shared adaptive styling: ${requirement}`);
  }
}

if (!intelligenceFilters.includes('showTitle?: boolean')) {
  throw new Error('Filter strip cannot suppress a duplicate section title.');
}
if (!cruises.includes('showTitle={false}')) {
  throw new Error('Cruises discovery renders more than one title for its filter section.');
}
if (!offers.includes('title="Filter offers"') || !offers.includes('variant="bookedCruises" compact showTitle={false}')) {
  throw new Error('Offers filters do not use one themed section title with the nested title suppressed.');
}
if (!/title="Casino & Certificates"[\s\S]*?<CasinoCertificatesCard[\s\S]*?showHeader=\{false\}/.test(offers)) {
  throw new Error('Certificates repeat their section title inside the Offers card.');
}
if (!/title="Machine strategy and ship explorer"[\s\S]*?router\.push\('\/machines'/.test(offers)) {
  throw new Error('Offers no longer retains the themed link to Slots-owned machine tools.');
}
if (/Today.?s Priorities|Mode-aware home/i.test(offers)) {
  throw new Error('Today’s Priorities returned to Offers instead of remaining on Day Agenda.');
}
if (!favoriteStaterooms.includes('showHeader?: boolean') || !cruises.includes('showHeader={false}')) {
  throw new Error('Favorite staterooms can still render a duplicate heading inside the Cruises section.');
}
if (slots.includes('<Text style={styles.sectionToggleText}>Slot Play Sessions</Text>')) {
  throw new Error('Slots repeats its Play sessions section title inside the same section.');
}
if (!calendar.includes('<TimeZoneConverter embedded />')) {
  throw new Error('Calendar can still repeat Time zones and Time Zone Converter as competing section titles.');
}

console.log('Build 445 visual foundation and filter behavior contract passed.');
