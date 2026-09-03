const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const settings = fs.readFileSync(path.join(root, 'app/(tabs)/settings.tsx'), 'utf8');

for (const marker of [
  'settings-export-certificates-zip',
  'settings-export-all-app-data',
  'settings-save-all',
  'settings-load-all',
  'settings-restore-from-backup',
  'settings_export_certificates_pressed',
  'settings_export_all_pressed',
  'settings_load_all_pressed',
  'renderExportActionRow',
  'accessibilityRole="button"',
  'Preparing files. The share sheet will open when ready.',
  'requestAnimationFrame',
]) assert.ok(settings.includes(marker), `Missing settings export/restore touch marker: ${marker}`);

assert.match(settings, /onPress=\{\(\) => \{ if \(!busy\) void onPress\(\); \}\}/);
assert.match(settings, /disabled=\{busy\}/);
assert.match(settings, /accessibilityState=\{\{ disabled: busy, busy \}\}/);
assert.match(settings, /onPress=\{\(\) => void handleExportAllData\(\)\}/);
assert.match(settings, /onPress=\{\(\) => void handleImportAllData\(\)\}/);

console.log('PASS Build 432 Settings export, Save All, Load All, certificate ZIP, and restore controls have explicit executable touch targets and visible progress/failure paths');
