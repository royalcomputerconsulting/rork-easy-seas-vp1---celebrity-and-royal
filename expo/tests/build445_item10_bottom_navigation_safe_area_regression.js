const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app/(tabs)/_layout.tsx'), 'utf8');

const orderedScreens = ['(overview)', 'scheduling', 'booked', 'events', 'analytics', 'machines', 'settings'];
const orderedTitles = ['Offers', 'Cruises', 'Booked', 'Calendar', 'Casino', 'Slots', 'Settings'];
let previous = -1;
for (const screen of orderedScreens) {
  const index = source.indexOf(`name="${screen}"`);
  assert.ok(index > previous, `tab route ${screen} must remain present and in the fixed order`);
  previous = index;
}
for (const title of orderedTitles) {
  assert.ok(source.includes(`title: "${title}"`), `tab label ${title} must remain readable and unchanged`);
}

for (const testId of ['offers', 'cruises', 'booked', 'calendar', 'casino', 'slots', 'settings']) {
  assert.ok(source.includes(`tabBarButtonTestID: "tab-${testId}"`), `${testId} tab must remain directly testable`);
}

assert.match(source, /useSafeAreaInsets/, 'bottom navigation must consume the device safe area');
assert.match(source, /minHeight:\s*62 \+ insets\.bottom/, 'the tab bar must include the home-indicator inset');
assert.match(source, /paddingBottom:\s*Math\.max\(6, insets\.bottom\)/, 'tab labels must sit above the home indicator');
assert.match(source, /tabBarItemStyle:[\s\S]*?minHeight:\s*56/, 'every tab item must exceed the 44-point target');
assert.match(source, /tabBarShowLabel:\s*true/, 'all seven text labels must remain visible');
assert.match(source, /tabBarHideOnKeyboard:\s*true/, 'the tab bar must not cover a keyboard composer');
assert.match(source, /webPhoneTabBarWidth = Math\.min\(width, 430\)/, 'the web phone frame must contain all seven tabs instead of clipping the outer viewport bar');

const tabBarBlock = source.slice(source.indexOf('tabBarStyle:'), source.indexOf('tabBarLabelStyle:'));
assert.doesNotMatch(tabBarBlock, /position:\s*['"]absolute['"]/, 'the phone tab bar must stay in layout flow and never cover the final row or floating action');

for (const icon of ['Tag', 'Compass', 'Ship', 'CalendarDays', 'Spade', 'Gamepad2', 'Settings']) {
  assert.match(source, new RegExp(`<${icon}\\s+color=`), `the ${icon} navigation symbol must remain clean and meaningful`);
}

console.log('build445 item 10 bottom navigation and safe-area regression passed');
