const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const settings = fs.readFileSync(path.join(root, 'app/(tabs)/settings.tsx'), 'utf8');

assert.match(settings, /useState\(true\).*isAccountDetailsVisible|isAccountDetailsVisible.*useState\(true\)/s, 'Traveler profile must be expanded on first render.');
assert.match(settings, /'Connections'.*Sync Royal \/ Celebrity Casino.*Sync Carnival Cruises.*Sync to cloud.*Get all current pricing/s, 'Connections must remain visible and retain core sync/pricing actions.');
assert.match(settings, /'Data Import & Backup'.*Offers CSV.*Booked Cruises CSV.*Completed Cruises Casino History CSV\/XLSX.*Crew Registry & CSV Import/s, 'Data import must remain visible with its domain actions.');
assert.match(settings, /settings-save-all/, 'Save All must remain directly reachable.');
assert.match(settings, /settings-load-all/, 'Load All must remain directly reachable.');
assert.match(settings, /Export Certificates \(\.ZIP\)/, 'Certificate export must remain directly reachable.');
assert.match(settings, /Export All App Data/, 'Complete app export must remain directly reachable.');
assert.match(settings, /\['Security', 'Notifications', 'Integrations', 'Appearance', 'Help', 'About \/ Legal', 'Purchases', 'Danger Zone'/, 'Category shortcuts must be limited to uncommon settings.');

const booksIndex = settings.indexOf('testID="settings-scott-astin-books"');
const dataImportIndex = settings.indexOf("'Data Import & Backup', 'Import, export, reconcile & restore your data'", booksIndex);
assert.ok(booksIndex > 0 && dataImportIndex > booksIndex, 'Books by Scott Astin must render above Data Import & Backup.');
assert.match(settings, /only-on-a-cruise-ship\.png/, 'Only On a Cruise Ship cover must be bundled.');
assert.match(settings, /smooth-sailing-in-rough-waters\.png/, 'Smooth Sailing cover must be bundled.');
assert.match(settings, /amazon\.com\/dp\/B0GYRDTS6L/, 'Only On a Cruise Ship must have a direct product link.');
assert.match(settings, /amazon\.com\/dp\/B0G4NG1L2M/, 'Smooth Sailing must have a direct product link.');
assert.match(settings, /amazon\.com\/stores\/author\/B0GCQ1S8MH\/allbooks/, 'The Scott Astin author-page link must remain available.');

for (const asset of ['only-on-a-cruise-ship.png', 'smooth-sailing-in-rough-waters.png']) {
  assert.ok(fs.statSync(path.join(root, 'assets/images/books', asset)).size > 0, `${asset} must be a non-empty bundled asset.`);
}

console.log('Build 445 always-visible Settings and Scott Astin books contract passed.');
