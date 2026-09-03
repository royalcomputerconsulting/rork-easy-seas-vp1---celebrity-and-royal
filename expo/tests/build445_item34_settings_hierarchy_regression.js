const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const screen = fs.readFileSync(path.join(root, 'app/(tabs)/settings.tsx'), 'utf8');

assert.equal((screen.match(/<TabIdentityBand tab="settings"/g) || []).length, 1, 'Settings must render one compact top identity treatment');
assert.match(screen, /<Stack\.Screen options=\{\{ headerShown: false \}\}/, 'a second native title bar must stay disabled');
assert.equal((screen.match(/<Text style=\{styles\.dataOverviewTitle\}>Data Overview<\/Text>/g) || []).length, 1, 'Settings must have one Data Overview');
assert.match(screen, /settings-search-input/);
assert.match(screen, /settings-search-results/);
assert.match(screen, /settings-always-visible-hint/);
assert.match(screen, /Traveler profile · Connections · Data import & backup/);
assert.match(screen, /settingsGroupSummaryTitle}>More settings/);

for (const group of [
  'Account',
  'Security',
  'Notifications',
  'Connections',
  'Data Import & Backup',
  'Integrations',
  'Appearance',
  'Help',
  'About / Legal',
  'Purchases',
]) {
  assert.ok(screen.includes(group), `missing Settings category ${group}`);
}

assert.match(screen, /<View style=\{styles\.section\} testID="settings-account-section">/, 'profile must remain fully visible');
assert.doesNotMatch(screen, /activeSettingsGroup === ['"](?:Account|Connections|Data Import & Backup|Data & Backup)['"]/, 'high-frequency Profile, Connections, and Data Import must not be hidden behind a category chip');
assert.match(screen, /isAdmin && activeSettingsGroup === 'Admin'/, 'admin controls must be gated by real admin state');
assert.match(screen, /isAdmin && renderSettingRow\([\s\S]*?Download SeaPass Generator/, 'developer-only generator download must be admin gated');
assert.doesNotMatch(screen, /Save as Mock Data|handleSaveMockData|Load Mock Data/, 'mock-data controls must stay out of production Settings');

console.log('PASS Build 445 Item 34 Settings hierarchy regression.');
