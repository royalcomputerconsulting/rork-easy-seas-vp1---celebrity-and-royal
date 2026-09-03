const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const layout = read('app/(tabs)/_layout.tsx');
const maestro = read('.maestro/build444-seven-tab-smoke.yaml');
const appLayout = read('app/_layout.tsx');

const tabs = [
  ['Offers', '(overview)', 'offers'],
  ['Cruises', 'scheduling', 'cruises'],
  ['Booked', 'booked', 'booked'],
  ['Calendar', 'events', 'calendar'],
  ['Casino', 'analytics', 'casino'],
  ['Slots', 'machines', 'slots'],
  ['Settings', 'settings', 'settings'],
];

assert.match(layout, /lazy: true/, 'Tab scenes must mount lazily to keep startup responsive.');
assert.match(layout, /freezeOnBlur: Platform\.OS !== 'web'/, 'Inactive native scenes must stop recomputing large datasets.');
assert.match(layout, /detachInactiveScreens=\{Platform\.OS !== 'web'\}/, 'Native navigation must detach inactive screens.');
assert.match(appLayout, /<ErrorBoundary>/, 'The root navigator must retain its uncaught-render error boundary.');

for (const [label, route, slug] of tabs) {
  assert.ok(layout.includes(`name="${route}"`), `${label} route is missing or reordered.`);
  assert.ok(layout.includes(`title: "${label}"`), `${label} title is missing.`);
  assert.ok(layout.includes(`tabBarButtonTestID: "tab-${slug}"`), `${label} lacks a stable native automation target.`);
  assert.ok(maestro.includes(`id: tab-${slug}`), `${label} is absent from the repeatable tap flow.`);
  assert.ok(maestro.includes(`id: tab-identity-${slug}`), `${label} flow does not wait for the destination screen.`);
}

const order = tabs.map(([, route]) => layout.indexOf(`name="${route}"`));
assert.deepEqual(order, [...order].sort((a, b) => a - b), 'The seven-tab order changed.');
assert.match(maestro, /id: tab-settings[\s\S]*id: tab-identity-settings[\s\S]*id: tab-offers/, 'The smoke flow must prove Settings can return to Offers.');

console.log('Build 444 repeatable seven-tab interaction smoke contract passed.');
