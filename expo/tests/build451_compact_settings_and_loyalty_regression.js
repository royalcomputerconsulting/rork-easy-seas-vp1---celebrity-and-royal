const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const offers = read('app/(tabs)/(overview)/index.tsx');
const loyalty = read('components/CompactDashboardHeader.tsx');
const settings = read('app/(tabs)/settings.tsx');

assert.match(offers, /easyseas-scott-astin-logo\.jpeg/);
assert.match(offers, /offersLogoHeader/);
assert.doesNotMatch(offers, /Your next voyage starts here/);
assert.match(offers, /<CompactDashboardHeader[\s\S]*?compact[\s\S]*?\/>/);

assert.match(loyalty, /compact\?: boolean/);
assert.match(loyalty, /compact \? displayName\.toUpperCase\(\) : loyaltyHeadline/);
assert.match(loyalty, /styles\.achievedCard, compact && styles\.compactHidden/);
assert.match(loyalty, /styles\.quickStatsPillRow, compact && styles\.compactHidden/g);
assert.match(loyalty, /styles\.statsRow, compact && styles\.statsRowCompact/g);

const shortcutBlock = settings.match(/const settingsShortcutItems = \[([\s\S]*?)\n  \];/);
assert.ok(shortcutBlock, 'Settings must define its compact shortcut grid');
assert.equal((shortcutBlock[1].match(/emoji:/g) || []).length, 9, 'Settings must expose exactly nine small action shortcuts');
assert.ok(settings.lastIndexOf("'Security', 'Protect local reservations") > settings.indexOf("'Data Import & Backup', 'Import, export"), 'Security must follow Connections and Data Import');
assert.match(settings, /<UserProfileCard[\s\S]*?compact/);

console.log('PASS Build 451 compact Settings, logo-only Offers identity, and screenshot-aligned loyalty hierarchy are locked.');
