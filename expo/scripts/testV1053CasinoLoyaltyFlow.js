const fs = require('fs');
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const sync = fs.readFileSync('state/RoyalCaribbeanSyncProvider.tsx', 'utf8');
const flow = fs.readFileSync('lib/analytics/casinoTabDataFlow.ts', 'utf8');
const analytics = fs.readFileSync('app/(tabs)/analytics.tsx', 'utf8');
const loyalty = fs.readFileSync('state/LoyaltyProvider.tsx', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
assert(pkg.version === '9.11.43', 'package version must be 9.11.43');
assert(app.expo.version === '9.11.43' && app.expo.ios.buildNumber === '9.11.43' && app.expo.android.versionCode === 91143, 'app versions must be bumped to 9.11.43');
assert(sync.includes('royalVerifiedVisibleCatalogCapture') && sync.includes('royalRowsWithShipDate'), 'Royal sync must verify ship/date rows');
assert(sync.includes('const step1IsAuthoritative = step1OfferRows.length > 0 && (royalCompletedVisibleCatalog || nonRoyalCompletedCapture);'), 'Royal valid row captures must not be blocked by stale failure text');
assert(flow.includes('derivedCruiseSessionCount') && flow.includes('basePoints > 0 || winLoss !== 0 ? 1 : 0'), 'Completed cruises with points/win-loss must become derived session coverage');
assert(analytics.includes('buildDerivedSessionsFromCasinoFlow') && analytics.includes('analyticsSessions'), 'Analytics tabs must use derived sessions from completed cruises');
assert(analytics.includes('currentSeasonCoinIn: currentYearPoints * 5'), 'Current-season casino total must show points × $5 coin-in estimate');
assert(analytics.includes('SessionsSummaryCard') && analytics.includes('sessions={analyticsSessions}'), 'Session tab cards must receive analyticsSessions');
assert(loyalty.includes('candidatePoints') && loyalty.includes("{ source: 'api' as const") && loyalty.includes("{ source: 'manual' as const"), 'Loyalty must choose highest verified API/manual/app source');
assert(loyalty.includes('Math.max(0, hasLiveCrownAnchorPoints ? liveCrownAnchorPoints : 0, manualCrownAnchorPoints ?? 0'), 'Crown & Anchor must update from live/manual/profile sources');
console.log('✅ v1053 casino loyalty flow checks passed');
