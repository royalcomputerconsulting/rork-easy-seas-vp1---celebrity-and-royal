#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}
function assert(cond, msg) {
  if (!cond) {
    console.error('❌ ' + msg);
    process.exit(1);
  }
}

const pkg = JSON.parse(read('package.json'));
const app = JSON.parse(read('app.json'));
assert(pkg.version === '9.11.41', 'package version should be 9.11.41');
assert(app.expo.version === '9.11.41', 'expo.version should be 9.11.41');
assert(app.expo.ios.buildNumber === '9.11.41', 'ios.buildNumber should be 9.11.41');
assert(app.expo.android.versionCode === 91141, 'android versionCode should be 91141');

const step1 = read('lib/royalCaribbean/step1_offers.ts');
assert(step1.includes('3 visible offers with 376 verified sailing rows'), 'step1 should document the valid 3-offer Royal catalog case');
assert(step1.includes("codes.length > 0 && codes.length < 3 && finalRows.length < 150"), 'step1 should only reject tiny 1-2 offer samples, not verified 3-offer catalogs');
assert(!step1.includes("codes.length > 0 && codes.length < 4) return 'Captured only '+codes.length+' Royal Club Royale offer code(s); likely partial discovery'"), 'old <4 Royal reject rule must be removed');

const syncProvider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert(syncProvider.includes('royalTinyPartialCapture'), 'sync provider should use royalTinyPartialCapture instead of broad partial capture');
assert(syncProvider.includes('royalVerifiedVisibleCatalogCapture'), 'sync provider should accept verified visible Royal catalogs');
assert(syncProvider.includes('Accepted current visible ${step1OfferCodes.length}-offer Club Royale catalog'), 'sync provider should log accepted smaller visible catalog');
assert(!syncProvider.includes('royalPartialMultiOfferCapture'), 'old royalPartialMultiOfferCapture guard should be removed');

const dataHealth = read('app/data-health.tsx');
assert(dataHealth.includes("import { useAuth } from '@/state/AuthProvider';"), 'Data Health screen must import useAuth');
assert(dataHealth.includes('if (!isAdmin)'), 'Data Health screen must gate non-admin users');
assert(dataHealth.includes('Admin Only'), 'Data Health screen should show admin-only fallback if directly opened');
assert(dataHealth.includes('current visible Club Royale catalog'), 'Data Health guardrail copy should not cite stale 5/1073 fixed catalog');
assert(!dataHealth.includes('5 offers / 1,073'), 'Data Health should not show stale fixed Royal catalog count');

const overview = read('app/(tabs)/(overview)/index.tsx');
assert(overview.includes('const { logout, isAdmin } = useAuth();'), 'Overview should read isAdmin');
assert(overview.includes('{isAdmin && (') && overview.includes('dashboard-data-health'), 'Overview Data Health tile should be admin-only');

const advisor = read('app/advisor.tsx');
assert(advisor.includes("import { useAuth } from '@/state/AuthProvider';"), 'Advisor should import useAuth');
assert(advisor.includes('const { isAdmin } = useAuth();'), 'Advisor should read isAdmin');
assert(advisor.includes('{isAdmin && (') && advisor.includes('Open Data Health'), 'Advisor Data Health button should be admin-only');

console.log('✅ v1051 sync/admin guard checks passed');
