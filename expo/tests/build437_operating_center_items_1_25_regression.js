const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const screen = fs.readFileSync(path.join(root, 'app', 'operating-center.tsx'), 'utf8');
const casino = fs.readFileSync(path.join(root, 'components', 'casino', 'CasinoCommandCenter.tsx'), 'utf8');
const storage = fs.readFileSync(path.join(root, 'lib', 'storage', 'storageKeys.ts'), 'utf8');

const ids = [...screen.matchAll(/\{ id: (\d+), title:/g)].map((match) => Number(match[1]));
assert.deepStrictEqual(ids.filter((id) => id <= 25), Array.from({ length: 25 }, (_, index) => index + 1), 'Operating Center must preserve every item 1–25 exactly once when later phases add more items');
for (let id = 10; id <= 25; id += 1) {
  const row = new RegExp(`\\{ id: ${id},[\\s\\S]*?group: 'Casino' \\}`).exec(screen)?.[0];
  assert(row, `Item ${id} must be explicitly classified as Casino`);
}
assert(screen.includes('useCasinoEconomicsData'), 'Today metrics must use the canonical casino economics source');
assert(screen.includes('useCoreData'), 'Operating Center must use live core data');
assert(screen.includes('useCertificates'), 'Operating Center must use live certificate data');
assert(screen.includes('AsyncStorage.setItem'), 'User favorites must persist');
assert(storage.includes('OPERATING_CENTER_PREFERENCES'), 'Preferences must be included in Save All / Load All storage registry');
assert(casino.includes('casino-operating-center'), 'Casino tools must expose the Operating Center');

const routes = [...screen.matchAll(/route: '([^']+)'/g)].map((match) => match[1]);
for (const route of routes) {
  if (route === '/operating-center') continue;
  const relative = route.replace(/^\//, '').split('?')[0];
  const direct = path.join(root, 'app', `${relative}.tsx`);
  const tab = path.join(root, 'app', '(tabs)', `${relative}.tsx`);
  assert(fs.existsSync(direct) || fs.existsSync(tab), `Capability route does not exist: ${route}`);
}

console.log('Build 437 Operating Center items 1–25 regression passed');
