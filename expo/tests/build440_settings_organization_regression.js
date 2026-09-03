const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const screen = fs.readFileSync(path.join(root, 'app/(tabs)/settings.tsx'), 'utf8');

for (const group of [
  'Account',
  'Security',
  'Notifications',
  'Connections',
  'Data Import & Backup',
  'Integrations',
  'Appearance & Data Trust',
  'Help',
  'About · Books by Scott Astin',
  'Purchases & Legal',
]) {
  assert.match(screen, new RegExp(group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing settings group ${group}`);
}

assert.match(screen, /settings-search-input/);
assert.match(screen, /settings-search-results/);
assert.match(screen, /settings-group-summary/);
assert.match(screen, /\['Security', 'Notifications', 'Integrations', 'Appearance', 'Help', 'About \/ Legal', 'Purchases', 'Danger Zone'/);
assert.doesNotMatch(screen, /activeSettingsGroup === ['"](?:Account|Connections|Data Import & Backup|Data & Backup)['"]/);
assert.match(screen, /<View style=\{styles\.section\} testID="settings-account-section">/);
assert.match(screen, /'Connections', 'Cruise-line sync, pricing & cloud shortcuts'/);
assert.match(screen, /'Data Import & Backup', 'Import, export, reconcile & restore your data'/);
assert.match(screen, /settings-search-result-\$\{item\.id\}/);
assert.match(screen, /settings-save-all/);
assert.match(screen, /settings-load-all/);
assert.match(screen, /settings-export-certificates-zip/);
assert.match(screen, /settings-export-all-app-data/);
assert.match(screen, /settings-restore-from-backup/);
assert.match(screen, /Crew Registry & CSV Import/);
assert.match(screen, /\/crew-recognition/);
assert.match(screen, /handleImportOffersCSV/);
assert.match(screen, /handleImportBookedCSV/);
assert.match(screen, /handleImportCompletedCruisesXLSX/);
assert.match(screen, /handleExportCertificates/);
assert.match(screen, /handleExportAllData/);
assert.match(screen, /handleImportAllData/);
assert.match(screen, /settings-book-only-on-a-cruise-ship/);
assert.match(screen, /settings-book-smooth-sailing/);
assert.match(screen, /settings-view-all-scott-astin-books/);
assert.match(screen, /https:\/\/www\.amazon\.com\/dp\/B0GYRDTS6L/);
assert.match(screen, /https:\/\/www\.amazon\.com\/dp\/B0G4NG1L2M/);
assert.match(screen, /https:\/\/www\.amazon\.com\/stores\/author\/B0GCQ1S8MH\/allbooks/);
assert.doesNotMatch(screen, /Save as Mock Data/);
assert.doesNotMatch(screen, /handleSaveMockData/);

console.log('PASS build440_settings_organization_regression');
