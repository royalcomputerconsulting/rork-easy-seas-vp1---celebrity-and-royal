const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'lib/sync/syncRunIntegrity.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: filename,
}).outputText;
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(compiled, filename);
const integrity = mod.exports;

const snapshot = integrity.createSyncOwnershipSnapshot('carnival', 'profile-a', 'first@example.com', 'carnival-abc');
assert.equal(integrity.isSyncOwnershipCurrent(snapshot, 'profile-a', 'first@example.com'), true);
assert.equal(integrity.isSyncOwnershipCurrent(snapshot, 'profile-b', 'first@example.com'), false);
assert.equal(integrity.isSyncOwnershipCurrent(snapshot, 'profile-a', 'second@example.com'), false);
assert.equal(integrity.isSyncOwnershipCurrent(snapshot, '', 'first@example.com'), false);
assert.equal(integrity.canPersistSyncToTarget(snapshot, 'profile-a', 'other@example.com'), true);
assert.equal(integrity.canPersistSyncToTarget(snapshot, 'linked-profile', 'first@example.com'), true);
assert.equal(integrity.canPersistSyncToTarget(snapshot, 'foreign-profile', 'other@example.com'), false);
assert.equal(integrity.canPersistSyncToTarget(snapshot, 'secondary-profile', 'second@example.com', ['profile-a', 'secondary-profile']), true);

const provider = fs.readFileSync(path.join(root, 'state/RoyalCaribbeanSyncProvider.tsx'), 'utf8');
assert.match(provider, /currentSyncOwnerRef/);
assert.match(provider, /acceptCarnivalProviderAccount/);
assert.match(provider, /CARNIVAL_ACCOUNT_CHANGED/);
assert.match(provider, /syncOwnershipRef\.current = null/);
assert.match(provider, /isSyncOwnershipCurrent\(syncOwnershipRef\.current, currentOwner\.profileId, currentOwner\.authenticatedEmail\)/);
assert.match(provider, /canPersistSyncToTarget\([\s\S]*?activeProfiles\.map\(\(profile\) => profile\.id\)/);

console.log('Sync ownership race regression checks passed');
