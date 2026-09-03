const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = [
  'lib/certificates/certificateDocumentStore.ts',
  'lib/askAllOffers/storage.ts',
  'lib/carnival/syncSupport.ts',
];
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert.match(source, /(?:from ['"]\.\.\/storage\/quotaSafeStorage['"]|require\('\.\.\/storage\/quotaSafeStorage'\))/, `${file} must route authoritative data through coordinated storage`);
}
const bundle = fs.readFileSync(path.join(root, 'lib/dataBundle/bundleOperations.ts'), 'utf8');
for (const key of ['CASINO_SESSIONS','CERTIFICATES','MACHINE_ENCYCLOPEDIA','USER_SLOT_MACHINES','BANKROLL_LIMITS']) {
  assert.match(bundle, new RegExp(`quotaSafeSetJsonItem\\(sk\\(ALL_STORAGE_KEYS\\.${key}\\)`), `${key} bundle import must use coordinated storage`);
}
assert.match(bundle, /saveCrewRecognitionRowsByProfile\(\s*ALL_STORAGE_KEYS\.CREW_RECOGNITION_ENTRIES/, 'CREW_RECOGNITION_ENTRIES bundle import must use coordinated profile-scoped storage');
assert.match(bundle, /saveCrewRecognitionRowsByProfile\(\s*ALL_STORAGE_KEYS\.CREW_RECOGNITION_SAILINGS/, 'CREW_RECOGNITION_SAILINGS bundle import must use coordinated profile-scoped storage');
const core = fs.readFileSync(path.join(root, 'state/CoreDataProvider.tsx'), 'utf8');
assert.match(core, /setTimeout\(\(\) => \{\s*void \(async \(\) => \{[\s\S]*DERIVED_CALENDAR_REBUILT/, 'derived calendar must be queued after authoritative commit');
console.log('PASS build337_stage3_full_migration_regression');
