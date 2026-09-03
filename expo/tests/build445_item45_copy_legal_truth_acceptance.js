#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const primaryFiles = [
  'app/(tabs)/analytics.tsx',
  'app/(tabs)/booked.tsx',
  'app/(tabs)/events.tsx',
  'app/(tabs)/(overview)/cruise-details.tsx',
  'app/offer-details.tsx',
  'app/certificate-summary-results.tsx',
  'components/casino/CasinoCommandCenter.tsx',
  'lib/agentSea/directAnswers.ts',
  'lib/importReconciliationReview.ts',
];

const format = read('lib/format.ts');
assert.match(format, /export function formatCount/);
for (const file of primaryFiles) {
  const source = read(file);
  assert.doesNotMatch(source, /(?:day|night|cruise|guest|row|item)\(s\)/, `${file} contains developer-style count copy`);
  assert.doesNotMatch(source, />\s*(?:Retry|TRY AGAIN|ERROR|FAILED)\s*</, `${file} contains vague or shouted primary action copy`);
}

const operations = read('components/ui/OperationStatusCard.tsx');
assert.match(operations, /Retry \{operation\.title\.toLowerCase\(\)\}/, 'operation retry copy must identify the operation');
assert.match(operations, /Existing app data was preserved; no final commit was reported/);

const offers = read('app/offer-details.tsx');
assert.match(offers, /Reload sailings/);
assert.match(offers, /Reload eligible sailings/);
assert.match(offers, /Soonest expiring/);
assert.match(offers, /Highest value/);

const casino = read('components/casino/CasinoCommandCenter.tsx');
for (const marker of ['SESSION ACTUAL', 'PROVIDER REPORTED', 'DERIVED', 'ESTIMATED', 'UNAVAILABLE', 'estimates never replace provider or user-entered facts', 'does not predict a cruise-line offer']) assert(casino.includes(marker));

const settings = read('app/(tabs)/settings.tsx');
for (const legalMarker of ['Legal disclaimer', 'does not provide gambling advice', 'National Council on Problem Gambling', 'TRADEMARK NOTICE', 'Royal Caribbean', 'Celebrity Cruises', 'Blue Chip Club', 'Club Royale']) assert(settings.includes(legalMarker));
assert.match(settings, /isAdmin && activeSettingsGroup === 'Admin'/, 'developer/admin controls must remain outside the normal production path');

const manual = read('components/UserManualModal.tsx');
assert.match(manual, /does not provide gambling advice, financial advice, tax advice, legal advice, or guaranteed outcomes/);
assert.match(manual, /trademarks are property of their respective owners/i);

console.log('PASS build445_item45_copy_legal_truth_acceptance');
