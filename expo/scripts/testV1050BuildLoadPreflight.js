const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), file), 'utf8'));
}

const pkg = readJson('package.json');
const app = readJson('app.json');
const expo = app.expo || {};

assert(pkg.version === '9.11.40', 'package.json version is 9.11.40');
assert(expo.version === pkg.version, 'expo.version matches package.json version');
assert(expo.ios && expo.ios.buildNumber === pkg.version, 'iOS buildNumber manifest value matches expo.version');
assert(expo.android && expo.android.versionCode === 91140, 'Android versionCode updated for 9.11.40');
assert(expo.extra && expo.extra.eas && expo.extra.eas.projectId === 'ec1e9b5a-face-45ad-8dc2-b95c780654f7', 'EAS project ID is configured');
assert(fs.existsSync('eas.json'), 'eas.json exists');
const eas = readJson('eas.json');
assert(eas.submit && eas.submit.production && eas.submit.production.ios && eas.submit.production.ios.ascAppId === '6758175890', 'EAS submit profile includes ASC App ID');
assert(Array.isArray(expo.plugins), 'Expo plugins array exists');
assert(JSON.stringify(expo.plugins).includes('expo-router'), 'expo-router plugin remains configured');
assert(fs.existsSync('app'), 'Expo Router app directory exists');
assert(fs.existsSync('state/AgentXProvider.tsx'), 'AgentXProvider exists');

const agentX = fs.readFileSync('state/AgentXProvider.tsx', 'utf8');
assert(agentX.includes('function buildCasinoIntelligenceContextText'), 'AgentX casino intelligence context helper is defined');
assert((agentX.match(/buildCasinoIntelligenceContextText\s*\(/g) || []).length >= 2, 'AgentX casino intelligence context helper is called');
assert(agentX.indexOf('function buildCasinoIntelligenceContextText') < agentX.indexOf('const detail = buildCasinoIntelligenceContextText'), 'AgentX helper is declared before first runtime call');

const analytics = fs.existsSync('app/(tabs)/analytics.tsx') ? fs.readFileSync('app/(tabs)/analytics.tsx', 'utf8') : '';
assert(analytics.includes('CasinoForecastingCard'), 'Analytics screen includes CasinoForecastingCard');
assert(analytics.includes('CasinoStrengthRatingCard'), 'Analytics screen includes CasinoStrengthRatingCard');
assert(analytics.includes('CompletedCruiseLedgerCard'), 'Analytics screen includes CompletedCruiseLedgerCard');
assert(analytics.includes('FutureValueWalletCard'), 'Analytics screen includes FutureValueWalletCard');

[
  'scripts/testV1049AgentXContextFix.js',
  'scripts/testV1048CasinoForecasting.js',
  'scripts/testV1047CasinoTabsDataFlow.js',
  'scripts/testV1046RemainingWiring.js',
  'scripts/testV1045DeficiencyClosures.ts',
  'scripts/testCasinoStrengthCompletedHistory.ts'
].forEach(file => assert(fs.existsSync(file), `${file} exists`));

console.log('\n✅ v1050 build/load preflight checks passed');
