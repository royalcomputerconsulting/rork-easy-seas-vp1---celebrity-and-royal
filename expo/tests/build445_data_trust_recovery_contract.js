const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const trust = read('app/data-trust-center.tsx');
const settings = read('app/(tabs)/settings.tsx');
const exportEngine = read('lib/integrity/integrityIssueExport.ts');

assert.match(settings, /Load Encrypted Backup/, 'Settings must name the restore operation explicitly.');
assert.match(trust, /title="Load Encrypted Backup"/, 'Data Trust must expose an explicit load action.');
assert.match(trust, /selectable selectionColor=/, 'The recovery key must remain selectable.');
assert.match(trust, /data-trust-copy-recovery-key/, 'The recovery key must have a first-class Copy action.');
assert.match(trust, /data-trust-paste-recovery-key/, 'Restore must allow pasting a recovery key.');
assert.match(trust, /data-trust-load-with-saved-recovery-key/, 'A saved key must directly launch backup selection.');
assert.match(trust, /data-trust-recover-all-data/, 'A previewed backup must expose a recovery action.');
assert.match(trust, /\['all', 'warnings', 'errors'\]/, 'Integrity findings must expose All, Warnings, and Errors filters.');
assert.match(trust, /data-trust-filter-\$\{filter\}/, 'Every integrity severity filter must have a stable control ID.');
assert.match(trust, /data-trust-issue-search/, 'Integrity findings must be searchable.');
assert.match(trust, /data-trust-export-current-list/, 'The currently filtered issue list must be downloadable.');
assert.match(trust, /exportIntegrityReport\(issueView, visibleIssues, '(?:csv|json)'\)/, 'Current-list export must honor the complete visible issue filter set.');
assert.match(trust, /setIssueView\('warnings'\).*exportIntegrityReport\('warnings'\)/s, 'The warning metric must reveal and download the same contributing rows.');
assert.match(trust, /setIssueView\('errors'\).*exportIntegrityReport\('errors'\)/s, 'The error metric must reveal and download the same contributing rows.');
assert.doesNotMatch(trust, /styles\.intentTitle/, 'Workflow context must not add a second section title.');

for (const header of ['Owner', 'Source', 'Domain', 'Record IDs', 'Detected At', 'Evidence', 'Proposed Repair']) {
  assert.ok(exportEngine.includes(`'${header}'`), `Integrity CSV must include ${header}.`);
}

console.log('Build 445 Data Trust, recovery, issue export, and single-title contract passed.');
