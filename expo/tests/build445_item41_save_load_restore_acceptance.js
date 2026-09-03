#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const settings = read('app/(tabs)/settings.tsx');
const trust = read('app/data-trust-center.tsx');
const backup = read('lib/backup/incrementalEncryptedBackup.ts');

const saveHandler = settings.match(/const handleExportAllData[\s\S]*?\n  const handleExportCertificates/)?.[0] ?? '';
const loadHandler = settings.match(/const handleImportAllData[\s\S]*?\n  }, \[coreData, router\]\);/)?.[0] ?? '';
assert.match(saveHandler, /pathname: '\/data-trust-center'.*intent: 'backup'/s, 'primary Save All must open the indexed encrypted backup workflow');
assert.match(loadHandler, /pathname: '\/data-trust-center'.*intent: 'restore'/s, 'primary Load All must open the conflict-safe restore workflow');
assert.doesNotMatch(saveHandler, /exportAllDataToFile|JSON\.stringify/, 'primary Save All may not build a monolithic JSON backup');
assert.doesNotMatch(loadHandler, /importAllDataFromFile|JSON\.parse/, 'primary Load All may not use the legacy monolithic importer');

for (const testId of ['settings-save-all', 'settings-load-all', 'settings-export-all-app-data', 'settings-restore-from-backup']) {
  assert.ok(settings.includes(testId), `${testId} must remain a clickable Settings target`);
}
assert.match(settings, /Indexed, encrypted, resumable complete backup/);
assert.match(settings, /Preview additions, updates, conflicts, and rejected rows first/);

for (const contract of [
  'useLocalSearchParams',
  "intent?: 'backup' | 'restore'",
  'data-trust-${intent',
  'createIncrementalEncryptedBackup',
  'estimateBackupStorageBytes',
  'assertBackupStorageCapacity',
  'BackupCancelledError',
  'setBackupResume',
  'previewBackupDatasetMap',
  'mergeRestoreDatasets',
  "'preserve-current'",
  'compareRestoreReadback',
  'rollbackBundle',
  'BACKUP_OWNER_MISMATCH',
]) assert.ok(trust.includes(contract), `Data Trust Center contract missing: ${contract}`);

for (const dataset of [
  'cruises', 'bookedCruises', 'casinoOffers', 'calendarEvents', 'casinoSessions',
  'certificates', 'certificateDocuments', 'users', 'crewRecognition', 'crewSailings',
  'machineEncyclopedia', 'savedAtlasMachines', 'customSlotMachines', 'deckPlanLocations',
  'casinoHistory', 'profile', 'settings', 'loyalty', 'playingHours', 'provenance',
  'experiencePreferences', 'userPreferences', 'sourceManifests',
]) assert.match(backup, new RegExp(`\\b${dataset}\\b`), `encrypted backup must include ${dataset}`);

for (const manifestLabel of [
  'certificate documents', 'crew recognition', 'profiles', 'casino history', 'loyalty',
  'user preferences', 'experience preferences', 'provenance', 'offer-sailing relationships',
  'Agent SEA source manifests and rebuildable caches',
]) assert.ok(backup.includes(manifestLabel), `backup manifest must declare ${manifestLabel}`);

assert.match(backup, /sourceManifests: \{ agentSea: bundle\.agentSeaSourceManifest \?\? null \}/);
assert.match(backup, /agentSeaSourceManifest: \(map\.sourceManifests\?\.agentSea \?\? base\.agentSeaSourceManifest\)/);
assert.match(backup, /await yieldToUi\(\)/, 'large backup work must yield to the UI event loop');
assert.match(backup, /withTransactionAsync/, 'completed encrypted snapshot publication must be transactional');

console.log('PASS Build 445 Item 41 Save/Load routing: every primary Settings action opens the indexed encrypted workflow; declared domains, source manifests/caches, progress, preview, cancellation/resume, transaction, rollback, owner, and exact-readback contracts are present.');
