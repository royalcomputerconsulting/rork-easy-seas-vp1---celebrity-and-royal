const fs = require('fs');
const path = require('path');
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
function assert(condition, message) { if (!condition) throw new Error(message); }
const mustExist = [
  'lib/value/futureCredits.ts',
  'lib/value/onboardValue.ts',
  'lib/value/annualCruiseBenefits.ts',
  'lib/value/userBenefitOverrides.ts',
  'lib/value/index.ts',
  'lib/agentXCasinoValueContext.ts',
  'app/casino/future-value-wallet.tsx',
];
for (const file of mustExist) assert(fs.existsSync(path.join(root, file)), `Missing V1077 file: ${file}`);
const models = read('types/models.ts');
for (const marker of ['interface NextCruiseCertificate', 'interface FutureCruiseCredit', 'interface UserBenefitOverride', 'interface AnnualCruiseBenefit', 'interface CrownAnchorCruiseCertificate', 'interface InternetValueItem', 'interface SpecialtyDiningValueItem', 'interface SpaValueItem']) {
  assert(models.includes(marker), `Missing model marker: ${marker}`);
}
const onboard = read('lib/value/onboardValue.ts');
for (const marker of ['DEFAULT_VOOM_PRICE_PER_DEVICE_PER_DAY = 30', 'buildInternetValueItem', 'buildOnboardValueLedgerItems', 'obc']) {
  assert(onboard.includes(marker), `Missing onboard marker: ${marker}`);
}
const settings = read('state/CasinoSettingsProvider.tsx');
assert(settings.includes("signatureObcEndDate: '2026-02-28'"), 'Scott Signature OBC default must end 2026-02-28.');
const ledger = read('lib/value/cruiseValueLedger.ts');
for (const marker of ['club-royale-annual-cruise', 'crown-anchor-milestone-cruise', 'nextcruise-instant-savings', 'SCOTT_SIGNATURE_OBC_OVERRIDE', 'buildOnboardValueLedgerItems']) {
  assert(ledger.includes(marker), `Ledger missing marker: ${marker}`);
}
const agent = read('state/AgentXProvider.tsx');
assert(agent.includes('buildCasinoValueAgentXContext'), 'AgentX must include casino value/future wallet context.');
const futureCredits = read('lib/value/futureCredits.ts');
for (const marker of ['applyFutureCruiseCredit', 'nextCruiseCertificateToWalletItem', 'futureCruiseCreditToWalletItem', 'buildFutureCreditWalletItems']) {
  assert(futureCredits.includes(marker), `Future credits missing marker: ${marker}`);
}
console.log('PASS testV1077RemainingRecommendationChanges');
