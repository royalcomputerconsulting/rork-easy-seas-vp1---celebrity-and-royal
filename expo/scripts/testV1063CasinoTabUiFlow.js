const fs = require('fs');
const path = require('path');

const root = process.cwd();
const analyticsPath = path.join(root, 'app/(tabs)/analytics.tsx');
const pkgPath = path.join(root, 'package.json');
const appPath = path.join(root, 'app.json');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const analytics = fs.readFileSync(analyticsPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));

[
  'renderWorkflowHeroCard',
  'renderWorkflowSectionHeader',
  'Casino Portfolio',
  'Cruise Value',
  'Play Sessions',
  'Casino Forecasting',
  'Offer attribution and true make-out',
  'Portfolio snapshot',
  'Completed cruise records',
  'Data quality',
  'Value ledgers',
  'Projection charts',
  'Session value created',
  'Session controls and summary',
  'Points-per-hour performance',
  'Goals and casino intelligence',
  'Recent sessions',
  'Decision tools',
  'Calculation lab',
].forEach((needle) => assert(analytics.includes(needle), `Missing UI flow marker: ${needle}`));

[
  'OfferAttributionLedgerCard',
  'TrueMakeoutLedgerCard',
  'CertificateCreatedByPlayCard',
  'KeepPlayingDecisionCard',
  'SessionsSummaryCard',
  'PPHHistoryChart',
  'ROIProjectionChart',
  'RiskAnalysisChart',
  'CasinoForecastingCard',
  'HostViewCard',
].forEach((needle) => assert(analytics.includes(needle), `Missing preserved card/calculation component: ${needle}`));

assert(analytics.includes("Portfolio"), 'Portfolio tab label missing');
assert(analytics.includes("Value"), 'Value tab label missing');
assert(analytics.includes("Play"), 'Play tab label missing');
assert(analytics.includes("Forecast"), 'Forecast tab label missing');
assert(pkg.version === '9.11.54', `Expected package version 9.11.54, got ${pkg.version}`);
assert(app.expo.version === '9.11.54', `Expected expo version 9.11.54, got ${app.expo.version}`);
assert(app.expo.ios.buildNumber === '9.11.54', `Expected iOS buildNumber 9.11.54, got ${app.expo.ios.buildNumber}`);
assert(app.expo.android.versionCode === 91154, `Expected Android versionCode 91154, got ${app.expo.android.versionCode}`);

console.log('✅ v1063 casino tab UI flow checks passed');
