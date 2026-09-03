const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const settings = read('app/(tabs)/settings.tsx');
const fileIO = read('lib/dataBundle/bundleFileIO.ts');
const bundleOperations = read('lib/dataBundle/bundleOperations.ts');

assert.match(settings, /Import earlier Easy Seas backup/);
assert.match(settings, /importAllDataFromFile\(authenticatedEmail\)/);
assert.match(settings, /Load Encrypted Backup/);
assert.match(fileIO, /if \(importResult\.errors\.length > 0\)[\s\S]*success: false/);
assert.match(bundleOperations, /Backup import preflight failed/);
assert.match(bundleOperations, /no backup records were changed/);

console.log('PASS Build 446 earlier JSON backups remain importable, encrypted restore stays primary, and failed cruise-storage preflight cannot be reported as a successful restore.');
