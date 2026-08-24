const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const settings = read('app/(tabs)/settings.tsx');
const provider = read('state/CarnivalSyncProvider.tsx');
const screen = read('app/carnival-sync.tsx');

for (const source of [settings, provider]) {
  assert.match(source, /function getLocalCarnivalSyncAccess/);
  assert.doesNotMatch(source, /import\s*\{\s*getCarnivalSyncAccess\s*\}/);
  assert.doesNotMatch(source, /getCarnivalSyncAccess\(/);
}

assert.match(provider, /getLocalCarnivalSyncAccess\(isAuthenticated, currentUser\?\.id\)/);
assert.match(provider, /const runIngestion = useCallback\(/);
assert.match(provider, /\(\) => requireCarnivalAccess\(runtime\.runIngestion\)/);
assert.match(provider, /\[requireCarnivalAccess, runtime\.runIngestion\]/);
assert.match(screen, /carnivalSyncAccess/);
assert.match(screen, /carnival-sync-access-notice/);

console.log('Carnival navigation runtime regression checks passed');
