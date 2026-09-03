const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(__dirname, '../app/(tabs)/_layout.tsx'), 'utf8');
const orderedScreens = ['(overview)', 'scheduling', 'booked', 'events', 'analytics', 'settings', 'quick-actions'];
const orderedTitles = ['Offers', 'Cruises', 'Booked', 'Calendar', 'Casino', 'Settings', 'Add'];

let prior = -1;
for (const screen of orderedScreens) {
  const index = source.indexOf(`name="${screen}"`);
  if (index <= prior) throw new Error(`Missing or reordered tab route: ${screen}`);
  prior = index;
}
for (const title of orderedTitles) {
  if (!source.includes(`title: "${title}"`)) throw new Error(`Changed or missing tab title: ${title}`);
}
for (const requirement of ['tabBarHideOnKeyboard: true', 'EASY_SEAS_UX.color.brandNavy', 'EASY_SEAS_UX.color.seafoam', 'minimumControlSize', "Platform.OS !== 'web' && width >= LARGE_SCREEN_BREAKPOINT"]) {
  if (!source.includes(requirement)) throw new Error(`Missing bottom-navigation requirement: ${requirement}`);
}
if (!source.includes('name="machines"') || !source.includes('href: null')) throw new Error('Slots must remain routable while hidden from the bottom bar');
if (!source.includes('name="quick-actions"') || !source.includes('tab-quick-actions')) throw new Error('Missing seventh-position common-task tab');

console.log('Build 440 bottom navigation regression passed.');
