const fs = require('fs');
const path = require('path');
const root = process.cwd();
function read(p){ return fs.readFileSync(path.join(root,p),'utf8'); }
function assert(cond,msg){ if(!cond){ console.error('❌ '+msg); process.exit(1);} }
const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
const step4 = read('lib/royalCaribbean/step4_loyalty.ts');
const pkg = JSON.parse(read('package.json'));
const app = JSON.parse(read('app.json'));
assert(provider.includes("loyaltyPageUrl: 'https://www.royalcaribbean.com/myaccount/'"), 'Royal loyalty page should navigate to My Account root, not only loyalty-programs');
assert(provider.includes('hasProfileLoyaltyTotals(existing)'), 'direct fetch JS must validate cached loyalty payload before accepting it');
assert(provider.includes('Ignoring existing loyalty payload for Step 3 because it is not profile totals'), 'direct fetch must ignore loyalty/history cached payloads');
assert(provider.includes('Step 3 still waiting: captured payload was not profile loyalty totals'), 'network handler must not auto-complete Step 3 for loyalty/history');
assert(provider.includes('if (hasProfileLoyalty) {\n                addLog(`✅ Step 3 auto-completing with profile loyalty totals'), 'Step 3 auto-completion must be gated on profile totals');
assert(step4.includes('function hasProfileLoyaltyTotals(payload)'), 'Step4 must include profile-total validator');
assert(step4.includes('Captured loyalty payload exists but is not profile totals'), 'Step4 must ignore history-only captured payload and continue fallback');
assert(step4.includes('Testing multiple loyalty endpoints'), 'older v963-style direct loyalty endpoint fallback must remain present');
assert(step4.includes('extractLoyaltyFromDOM'), 'DOM fallback must remain present for My Account visible card');
assert(pkg.version === '9.11.49', 'package version should be 9.11.49');
assert(app.expo.version === '9.11.49', 'app expo.version should be 9.11.49');
assert(app.expo.ios.buildNumber === '9.11.49', 'iOS buildNumber should be 9.11.49');
assert(app.expo.android.versionCode === 91149, 'android versionCode should be 91149');
console.log('✅ v1059 My Account loyalty sync restoration checks passed');
