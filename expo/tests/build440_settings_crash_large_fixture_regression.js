const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const settings = fs.readFileSync(path.join(root, 'app/(tabs)/settings.tsx'), 'utf8');

assert.doesNotMatch(settings, /import \* as XLSX from 'xlsx'/, 'Settings must not eagerly load the spreadsheet engine');
assert.doesNotMatch(settings, /import \{ exportCertificateResultsZip \}/, 'Settings must not eagerly load JSZip/certificate export');
assert.match(settings, /const XLSX = await import\('xlsx'\)/, 'spreadsheet actions must lazy-load XLSX after a user action');
assert.match(settings, /await import\('@\/lib\/certificates\/certificateCsvZipExport'\)/, 'certificate ZIP must lazy-load its compression engine');
assert.doesNotMatch(settings, /uniqueOfferInstances:\s*offerStats\.keys[,\s]/, 'Settings must not serialize thousands of offer keys into the runtime console');
assert.match(settings, /offerKeySample:\s*offerStats\.keys\.slice\(0, 5\)/, 'bounded offer diagnostics must remain available');
assert.match(settings, /const \[activeSettingsGroup, setActiveSettingsGroup\] = useState\('Security'\)/, 'Settings must default to a bounded secondary section while priority sections remain mounted');
assert.doesNotMatch(settings, /activeSettingsGroup === '(?:Account|Connections|Data Import & Backup|Data & Backup)'/, 'Profile, Connections, and Data Import & Backup must never be hidden behind the section selector');
assert.match(settings, /'Data Import & Backup', 'Import, export, reconcile & restore your data'/, 'Data import and backup controls must remain fully visible on first render');
assert.match(settings, /activeSettingsGroup === 'About \/ Legal'/, 'books, legal, and app information must remain reachable through the section selector');
assert.match(settings, /const \[isAccountDetailsVisible, setIsAccountDetailsVisible\] = useState\(true\)/, 'the full profile editor must be visible on first render');

for (const fixture of [
  '/Users/rcg/Downloads/Easy Seas - Backup 08.27.26.json',
  '/Users/rcg/Library/Mobile Documents/com~apple~CloudDocs/Easy Seas - Backup 08.19.26.json',
]) {
  if (!fs.existsSync(fixture)) continue;
  const backup = JSON.parse(fs.readFileSync(fixture, 'utf8'));
  assert.ok(Array.isArray(backup.cruises), `${fixture} must expose its cruise array`);
  assert.ok(Array.isArray(backup.bookedCruises), `${fixture} must expose its booked-cruise array`);
  assert.ok(Array.isArray(backup.casinoOffers), `${fixture} must expose its offer array`);
  assert.ok(backup.cruises.length >= 2500, `${fixture} must exercise the large-catalog Settings path`);
}

console.log('Build 440 Settings crash / large fixture regression passed.');
