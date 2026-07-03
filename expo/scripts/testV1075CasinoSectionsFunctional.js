const fs = require('fs');
const path = require('path');
const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'app/(tabs)/analytics.tsx'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
}

const requiredPages = [
  'CasinoPortfolioPage',
  'CruiseValuePage',
  'ActionCenterPage',
  'HistorySimulatorPage',
];
for (const page of requiredPages) {
  assert(new RegExp(`function\\s+${page}\\s*\\(`).test(route), `${page} exists`);
}

const requiredTabs = [
  "{ key: 'portfolio', label: 'Casino Portfolio' }",
  "{ key: 'value', label: 'Cruise Value' }",
  "{ key: 'action', label: 'Action Center' }",
  "{ key: 'history', label: 'History & Simulator' }",
];
for (const tab of requiredTabs) {
  assert(route.includes(tab), `${tab} tab is wired`);
}

assert(route.includes("activeTab === 'portfolio'") && route.includes('<CasinoPortfolioPage'), 'Portfolio tab renders its page');
assert(route.includes("activeTab === 'value'") && route.includes('<CruiseValuePage'), 'Cruise Value tab renders its page');
assert(route.includes("activeTab === 'action'") && route.includes('<ActionCenterPage'), 'Action Center tab renders its page');
assert(route.includes("activeTab === 'history'") && route.includes('<HistorySimulatorPage'), 'History tab renders its page');
assert(route.includes('setActiveTab(tab.key)'), 'Tab buttons change the active section');
assert(route.includes('buildSafeCruiseRows') && route.includes('safeRun('), 'Casino data build uses safe fallback wrapper');
assert(route.includes('buildTotals(rows)') && route.includes('buildShipPerformance(rows)'), 'Casino totals and ship performance are computed');
assert(route.includes('sessionRows') && route.includes('slice(0, 80)'), 'Session rendering is capped to avoid oversized native render payloads');
assert(route.includes('rows.slice(0, 8)') && route.includes('ships.slice(0, 6)'), 'Dense casino rows are capped for native safety');
assert(route.includes('onOpenDetail') && route.includes('buildMetricDetail') && route.includes('buildShipDetail'), 'Drill-down detail actions are functional');
assert(route.includes('RefreshControl') && route.includes('onRefresh'), 'Pull-to-refresh remains wired');
assert(!route.includes('PlaceholderPage title='), 'No active casino section is a placeholder page');
assert(!route.includes('CasinoAnalyticsScreenFull'), 'Legacy heavy casino analytics screen is not imported');
assert(!route.includes('expo-linear-gradient'), 'Casino route does not use native gradient module');
assert(!route.includes('diagnosticLogger'), 'Casino route does not use diagnostic logger');
assert(!/\.split\s*\(/.test(route), 'Casino route avoids direct .split calls linked to Hermes crash report');

if (process.exitCode) process.exit(1);
console.log('✅ v1075 Casino sections functional QA checks passed');
