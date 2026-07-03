const fs = require('fs');
const path = require('path');

const root = process.cwd();
function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const analytics = read('app/(tabs)/analytics.tsx');
assert(analytics.includes('CasinoStrengthRatingCard'), 'Analytics must render CasinoStrengthRatingCard.');
assert(analytics.includes('CompletedCruiseLedgerCard'), 'Analytics must render CompletedCruiseLedgerCard.');
assert(analytics.includes('FutureValueWalletCard'), 'Analytics must render FutureValueWalletCard.');
assert(analytics.includes('findCompletedCruiseDataGaps'), 'Analytics must expose completed-cruise missing-data gaps.');
assert(analytics.includes('getScottSignatureObcOverride'), 'Analytics must apply Scott Signature OBC override into wallet ledger items.');

const agentx = read('state/AgentXProvider.tsx');
assert(agentx.includes('casino-strength-completed-cruise-value'), 'AgentX must include casino strength/completed history/future wallet context block.');
assert(agentx.includes('buildCompletedCruiseCasinoValueRecords'), 'AgentX must build completed cruise casino records.');
assert(agentx.includes('calculateCasinoStrengthRating'), 'AgentX must calculate Casino Strength Rating.');
assert(agentx.includes('buildShipCasinoHistory'), 'AgentX must include ship casino history summaries.');
assert(agentx.includes('Future Value Wallet'), 'AgentX must expose Future Value Wallet language.');

const dailyRoute = read('backend/trpc/routes/daily-luck.ts');
assert(dailyRoute.includes('buildFullDailyLuckRecord'), 'Daily Luck route must use full luck calendar engine.');
assert(dailyRoute.includes('exportDailyLuckRecordToCsvRow'), 'Daily Luck route must expose CSV export row.');
assert(dailyRoute.includes('exportDailyLuckRecordToIcs'), 'Daily Luck route must expose ICS event export.');

const dailyUi = read('components/DailyLuckSection.tsx');
assert(dailyUi.includes('fullRecord.luckyScore100'), 'Daily Luck UI must show 0-100 score.');
assert(dailyUi.includes('fullRecord.disclaimer'), 'Daily Luck UI must show safety disclaimer.');
assert(dailyUi.includes('fullRecord.casinoGuidance'), 'Daily Luck UI must show casino guidance when present.');

const certModal = read('components/CertificateMonthListModal.tsx');
assert(certModal.includes('D certificates'), 'Certificate month list must expose D-bank filtering when available.');
assert(certModal.includes("IT LOOKS LIKE THE NEXT MONTH'S CERTIFICATES ARE NOT AVAILABLE YET."), 'Certificate month list must show exact next-month unavailable message.');

const localCertReader = read('lib/royalCaribbean/localCertificateMonthList.ts');
assert(localCertReader.includes("['A', 'C', 'D']"), 'Local certificate month reader must attempt A/C/D banks.');

const bestPlay = read('lib/casino/bestPlayToday.ts');
assert(bestPlay.includes("from './pointsEarning'"), 'Best Play Today must use centralized points engine for coin-in estimates.');

console.log('✅ v1046 remaining wiring checks passed');
