const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
const eas = JSON.parse(read('eas.json'));
const resolved = require(path.join(root, 'app.config.js'))({ config: {} });

assert.equal(app.version, '13.0.44');
assert.equal(String(app.ios.buildNumber), '410');
assert.equal(app.android.versionCode, 130067);
assert.equal(pkg.version, '13.0.44');
assert.equal(resolved.version, '13.0.44');
assert.equal(resolved.ios.infoPlist.CFBundleShortVersionString, '13.0.44');
assert.equal(String(resolved.ios.buildNumber), '410');
assert.equal(resolved.android.versionCode, 130067);
assert.equal(resolved.ios.infoPlist.CFBundleVersion, undefined, 'EAS must remain free to assign a unique remote build number');
assert.equal(eas.cli.appVersionSource, 'remote');
assert.equal(eas.build.production.autoIncrement, true);

const ignore = read('.easignore');
for (const pattern of ['node_modules', '.DS_Store', '._*', '__MACOSX', '*.log', 'tests/fixtures/royal-august-2026-live', 'tests/fixtures/royal-april-2026-uploaded']) assert.ok(ignore.includes(pattern), `missing EAS exclusion ${pattern}`);

const layout = read('app/(tabs)/_layout.tsx');
for (const tab of ['(overview)', 'scheduling', 'booked', 'events', 'analytics', 'machines', 'settings']) assert.ok(layout.includes(`name="${tab}"`), `stable tab ${tab} must remain registered`);
assert.match(read('app/(tabs)/analytics.tsx'), /casino-relationship-intelligence/);
assert.match(read('state/AgentXProvider.tsx'), /casino-relationship-intelligence/);
assert.match(read('lib/casino/casinoRelationshipIntelligence.ts'), /Marketing codes are not deduplicated/);
assert.match(read('CHANGELOG_BUILD396.md'), /certificate/i);
assert.match(read('CHANGELOG_BUILD396.md'), /weather/i);

console.log('PASS build417_finalized_release_identity_regression — Easy Seas 13.0.44 (410), EAS remote auto-increment, stable tabs, clean packaging rules, and casino truth release verified');
