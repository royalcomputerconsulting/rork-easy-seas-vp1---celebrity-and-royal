const fs = require('fs');
const path = require('path');
function read(p){ return fs.readFileSync(path.join(process.cwd(), p), 'utf8'); }
function assert(c,m){ if(!c) throw new Error(m); }
const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));
const analytics = read('app/(tabs)/analytics.tsx');
const provider = read('state/RoyalCaribbeanSyncProvider.tsx');
assert(app.expo.version === '12.4.2', 'app version must be 12.4.2');
assert(app.expo.ios.buildNumber === '314', 'iOS build must be 314');
assert(app.expo.android.versionCode === 120405, 'Android versionCode must be 120405');
assert(pkg.version === '12.4.2', 'package version must be 12.4.2');
assert(!analytics.includes('expo-linear-gradient'), 'Casino route must not import expo-linear-gradient');
[
  'BestPlayTodayCard',
  'HostViewCard',
  'OfferAttributionLedgerCard',
  'TrueMakeoutLedgerCard',
  'CasinoOpportunityBadge',
  'CertificateExpirationBadge',
  'KeepPlayingDecisionCard'
].forEach(name => assert(analytics.includes(name), `${name} must be wired into casino route`));
assert(analytics.includes('casino-best-play-today-section'), 'Best Play Today section testID missing');
assert(analytics.includes('casino-host-view-card-section'), 'Host View section testID missing');
assert(analytics.includes('casino-value-attribution-makeout-section'), 'Value attribution/makeout section testID missing');
assert(provider.includes('Royal offer rows are staged for Apply Sync'), 'Royal sync apply staging marker must remain in baseline');
console.log('PASS testV1231CasinoSectionWiring');
