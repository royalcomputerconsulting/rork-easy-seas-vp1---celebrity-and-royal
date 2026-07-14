const fs = require('fs');
const path = require('path');
function read(p){ return fs.readFileSync(path.join(process.cwd(), p), 'utf8'); }
function assert(c,m){ if(!c) throw new Error(m); }
const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
const filters = read('lib/intelligenceFilters.ts');
const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
const modal = read('components/AddBookedCruiseModal.tsx');
const booked = read('app/(tabs)/booked.tsx');
assert(app.expo.version === '12.4.2', 'app version must be 12.4.2');
assert(app.expo.ios.buildNumber === '311', 'iOS build must be 311');
assert(app.expo.android.versionCode === 120402, 'Android versionCode must be 120402');
assert(pkg.version === '12.4.2', 'package version must be 12.4.2');
assert(filters.includes('isSharedCruiseOrOfferRecord'), 'shared cruise/offer profile filter missing');
assert(filters.includes('travel inventory'), 'shared travel inventory comment missing');
assert(provider.includes('Travel inventory is shared'), 'sync log must explain shared travel inventory');
assert(provider.includes('const targetProfile = requestedProfile ?? primaryProfile ?? currentUser'), 'secondary target must not fall back to primary when blank');
assert(provider.includes('targetOwnerProfileId: undefined'), 'sync apply must treat travel inventory as shared');
assert(provider.includes('includeUnownedRecords: true'), 'shared sync must include unowned existing records');
assert(modal.includes("type ManualCruiseType = 'booked' | 'available'"), 'manual add must ask booked vs available');
assert(modal.includes('KeyboardAvoidingView'), 'manual add modal must support keyboard avoidance');
assert(modal.includes('contentContainerStyle={styles.modalContentInner}'), 'manual add modal must have scroll content padding');
assert(modal.includes('onSaveAvailable'), 'manual add modal must support available cruise save');
assert(booked.includes('onSaveAvailable={handleSaveAvailableCruise}'), 'booked screen must wire available cruise save');
assert(booked.includes('addCruise(cruise)'), 'booked screen must save available cruise to cruise inventory');
console.log('PASS testV1234SharedProfilesManualAdd');
