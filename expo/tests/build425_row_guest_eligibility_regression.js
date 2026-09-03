const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const integrity = read('lib/cruiseRecordIntegrity.ts');
assert.match(integrity, /single\\s\+occupancy/);
assert.match(integrity, /double\\s\+occupancy/);
assert.match(integrity, /getCruiseGuestEligibility/);
assert.match(integrity, /Guest eligibility not stated/);

const pipeline = read('lib/certificates/certificatePdfPipeline.ts');
assert.ok((pipeline.match(/guestCount:/g) || []).length >= 4, 'all certificate parser paths must retain guestCount');
assert.ok((pipeline.match(/row\.guestCount \?\? ''/g) || []).length >= 2, 'guest count must be part of both material identities');

const offerDetails = read('app/offer-details.tsx');
assert.match(offerDetails, /formatGuestEligibility\(getCruiseGuestEligibility\(item\)\)/);
assert.doesNotMatch(offerDetails, /item\.guestsInfo \|\| offerData\.offer\?\.guestsInfo/);

const lookup = read('app/certificate-lookup.tsx');
assert.match(lookup, /level\.guestCount \? `\$\{level\.guestCount\} Guest/);
assert.match(lookup, /Guests not stated/);

const explorer = read('components/CertificateExplorerModal.tsx');
assert.match(explorer, /formatGuestEligibility\(sailing\.guestCount \?\? sailing\.occupancy/);

const app = JSON.parse(read('app.json')).expo;
assert.equal(app.version, '13.0.61');
assert.equal(String(app.ios.buildNumber), '427');
assert.equal(app.android.versionCode, 130093);

console.log('PASS Build 425 row-level certificate and offer guest eligibility regression');
